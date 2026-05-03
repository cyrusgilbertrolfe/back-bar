/**
 * Pull all historical Invoices and Customers from QuickBooks Online.
 *
 * Run from back-bar repo root:
 *   npx tsx scripts/qb/pull-history.ts
 *
 * Reads QB_* credentials from .env.production.local (pulled via `vercel env pull`).
 * Writes raw line-delimited JSON to ~/data/myattsfields/qb/.
 *
 * The output is the unprocessed QB API response per record — preserves every
 * field so the future CRM can derive whatever shape it wants without re-pulling.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { config } from 'dotenv'

config({ path: '.env.production.local', quiet: true })

const {
  QB_CLIENT_ID,
  QB_CLIENT_SECRET,
  QB_REFRESH_TOKEN,
  QB_REALM_ID,
} = process.env

if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !QB_REFRESH_TOKEN || !QB_REALM_ID) {
  console.error('Missing QB env vars. Run `vercel env pull .env.production.local` from back-bar root.')
  process.exit(1)
}

const QB_BASE = 'https://quickbooks.api.intuit.com'
const PAGE_SIZE = 1000
const DATA_DIR = join(homedir(), 'data', 'myattsfields', 'qb')

mkdirSync(DATA_DIR, { recursive: true })

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: QB_REFRESH_TOKEN!,
    }),
  })
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`)
  }
  const data = await res.json() as { access_token: string; refresh_token?: string }
  // Note: Intuit may rotate refresh_token. For long-running automation we'd
  // persist data.refresh_token back to Vercel here. One-shot pulls don't need this.
  return data.access_token
}

async function qbQuery<T>(token: string, entity: string, query: string): Promise<T[]> {
  const url = `${QB_BASE}/v3/company/${QB_REALM_ID}/query?query=${encodeURIComponent(query)}&minorversion=65`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}) on "${query}": ${await res.text()}`)
  }
  const json = await res.json() as { QueryResponse?: Record<string, unknown> }
  const arr = json.QueryResponse?.[entity]
  return Array.isArray(arr) ? (arr as T[]) : []
}

async function pullAll<T>(token: string, entity: string): Promise<T[]> {
  const all: T[] = []
  let start = 1
  while (true) {
    const query = `SELECT * FROM ${entity} STARTPOSITION ${start} MAXRESULTS ${PAGE_SIZE}`
    const page = await qbQuery<T>(token, entity, query)
    all.push(...page)
    process.stdout.write(`  page @ position ${start.toString().padStart(5)} → ${page.length.toString().padStart(4)} records (total: ${all.length})\n`)
    if (page.length < PAGE_SIZE) break
    start += PAGE_SIZE
  }
  return all
}

function writeJsonl(path: string, records: unknown[]): void {
  const content = records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '')
  writeFileSync(path, content)
}

async function main() {
  console.log(`Realm: ${QB_REALM_ID}`)
  console.log(`Output: ${DATA_DIR}`)
  console.log('')

  console.log('Refreshing access token…')
  const token = await getAccessToken()
  console.log(`  ✓ access token (prefix: ${token.slice(0, 8)}…)`)
  console.log('')

  console.log('Pulling Invoices:')
  const invoices = await pullAll<Record<string, unknown>>(token, 'Invoice')
  writeJsonl(join(DATA_DIR, 'invoices.jsonl'), invoices)
  console.log(`  → wrote ${invoices.length} invoices`)
  console.log('')

  console.log('Pulling Customers:')
  const customers = await pullAll<Record<string, unknown>>(token, 'Customer')
  writeJsonl(join(DATA_DIR, 'customers.jsonl'), customers)
  console.log(`  → wrote ${customers.length} customers`)
  console.log('')

  // Quick spot-check: oldest and newest invoice dates
  const txnDates = invoices
    .map(inv => (inv as { TxnDate?: string }).TxnDate)
    .filter((d): d is string => !!d)
    .sort()

  const meta = {
    pulled_at: new Date().toISOString(),
    realm_id: QB_REALM_ID,
    invoice_count: invoices.length,
    customer_count: customers.length,
    invoice_date_range: txnDates.length
      ? { oldest: txnDates[0], newest: txnDates[txnDates.length - 1] }
      : null,
  }
  writeFileSync(join(DATA_DIR, '_meta.json'), JSON.stringify(meta, null, 2))

  console.log('Done.')
  console.log(`  invoice date range: ${meta.invoice_date_range?.oldest ?? '—'} → ${meta.invoice_date_range?.newest ?? '—'}`)
  console.log(`  meta: ${join(DATA_DIR, '_meta.json')}`)
}

main().catch(err => {
  console.error('FATAL:', err.message ?? err)
  process.exit(1)
})
