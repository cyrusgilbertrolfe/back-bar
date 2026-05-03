/**
 * Pull all historical Customers and Orders from Shopify.
 *
 * Run from back-bar repo root:
 *   npx tsx scripts/shopify/pull-history.ts
 *
 * Reads SHOPIFY_* credentials from .env.production.local
 * (pulled via `vercel env pull`). Auth pattern matches
 * src/app/api/shopify/theme-asset/route.ts: client_credentials grant
 * → X-Shopify-Access-Token.
 *
 * Writes raw line-delimited JSON to ~/data/myattsfields/shopify/ —
 * unprocessed GraphQL nodes so the future CRM can reshape them
 * without re-pulling.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { config } from 'dotenv'

config({ path: '.env.production.local', quiet: true })

const {
  SHOPIFY_STORE_DOMAIN,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
} = process.env

if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
  console.error('Missing SHOPIFY_* env vars. Run `vercel env pull .env.production.local`.')
  process.exit(1)
}

const API_VERSION = '2025-01'
const PAGE_SIZE = 250
const DATA_DIR = join(homedir(), 'data', 'myattsfields', 'shopify')

mkdirSync(DATA_DIR, { recursive: true })

async function getAccessToken(): Promise<string> {
  const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID!,
      client_secret: SHOPIFY_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Shopify token failed (${res.status}): ${await res.text()}`)
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('No access_token in Shopify response')
  return data.access_token
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json() as { data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> }
  if (!res.ok || json.errors?.length) {
    const errMsg = json.errors?.map(e => e.message).join('; ') ?? `HTTP ${res.status}`
    throw new Error(`GraphQL error: ${errMsg}`)
  }
  if (!json.data) throw new Error('No data in GraphQL response')
  return json.data
}

const CUSTOMER_QUERY = `
  query Customers($cursor: String) {
    customers(first: ${PAGE_SIZE}, after: $cursor) {
      edges {
        node {
          id
          email
          displayName
          firstName
          lastName
          phone
          createdAt
          updatedAt
          numberOfOrders
          amountSpent { amount currencyCode }
          tags
          state
          defaultAddress { city country countryCodeV2 province zip }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

const ORDER_QUERY = `
  query Orders($cursor: String) {
    orders(first: ${PAGE_SIZE}, after: $cursor, sortKey: PROCESSED_AT) {
      edges {
        node {
          id
          name
          processedAt
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalShippingPriceSet { shopMoney { amount currencyCode } }
          totalTaxSet { shopMoney { amount currencyCode } }
          customer { id email displayName }
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                originalUnitPriceSet { shopMoney { amount currencyCode } }
                discountedUnitPriceSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`

interface Page<T> {
  edges: Array<{ node: T }>
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

async function pullAll<T>(
  token: string,
  query: string,
  rootKey: string,
  label: string,
): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null
  let page = 0
  while (true) {
    page++
    const data = await gql<Record<string, Page<T>>>(token, query, { cursor })
    const pageData = data[rootKey]
    const nodes = pageData.edges.map(e => e.node)
    all.push(...nodes)
    process.stdout.write(`  page ${page.toString().padStart(3)} → ${nodes.length.toString().padStart(4)} ${label} (total: ${all.length})\n`)
    if (!pageData.pageInfo.hasNextPage) break
    cursor = pageData.pageInfo.endCursor
    // Light throttle — Shopify GraphQL has cost-based limits but burst is fine
    await new Promise(r => setTimeout(r, 100))
  }
  return all
}

function writeJsonl(path: string, records: unknown[]): void {
  const content = records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '')
  writeFileSync(path, content)
}

async function main() {
  console.log(`Shop: ${SHOPIFY_STORE_DOMAIN}`)
  console.log(`API version: ${API_VERSION}`)
  console.log(`Output: ${DATA_DIR}`)
  console.log('')

  console.log('Getting access token…')
  const token = await getAccessToken()
  console.log(`  ✓ token obtained (prefix: ${token.slice(0, 8)}…)`)
  console.log('')

  console.log('Pulling Customers:')
  const customers = await pullAll<Record<string, unknown>>(token, CUSTOMER_QUERY, 'customers', 'customers')
  writeJsonl(join(DATA_DIR, 'customers.jsonl'), customers)
  console.log(`  → wrote ${customers.length} customers`)
  console.log('')

  console.log('Pulling Orders:')
  const orders = await pullAll<Record<string, unknown>>(token, ORDER_QUERY, 'orders', 'orders')
  writeJsonl(join(DATA_DIR, 'orders.jsonl'), orders)
  console.log(`  → wrote ${orders.length} orders`)
  console.log('')

  // Quick spot-check
  const orderDates = orders
    .map(o => (o as { processedAt?: string }).processedAt)
    .filter((d): d is string => !!d)
    .sort()

  const meta = {
    pulled_at: new Date().toISOString(),
    shop_domain: SHOPIFY_STORE_DOMAIN,
    api_version: API_VERSION,
    customer_count: customers.length,
    order_count: orders.length,
    order_date_range: orderDates.length
      ? { oldest: orderDates[0], newest: orderDates[orderDates.length - 1] }
      : null,
  }
  writeFileSync(join(DATA_DIR, '_meta.json'), JSON.stringify(meta, null, 2))

  console.log('Done.')
  console.log(`  order date range: ${meta.order_date_range?.oldest ?? '—'} → ${meta.order_date_range?.newest ?? '—'}`)
  console.log(`  meta: ${join(DATA_DIR, '_meta.json')}`)
}

main().catch(err => {
  console.error('FATAL:', err.message ?? err)
  process.exit(1)
})
