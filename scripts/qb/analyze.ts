/**
 * Aggregate the QB invoice JSONL into spend-by-customer-by-year.
 *
 * Run:
 *   npx tsx scripts/qb/analyze.ts
 *
 * Reads ~/data/myattsfields/qb/invoices.jsonl
 * Writes ~/data/myattsfields/qb/spend_by_customer_year.csv
 * Prints a markdown summary to stdout.
 *
 * Note: TotalAmt is gross (includes VAT). Use TxnTaxDetail.TotalTax to derive net.
 * Currency is assumed homogeneous; mixed-currency totals would need FX conversion.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DATA_DIR = join(homedir(), 'data', 'myattsfields', 'qb')

interface Invoice {
  Id: string
  TxnDate: string
  CustomerRef: { value: string; name: string }
  TotalAmt: number
  Balance: number
  CurrencyRef?: { value: string; name?: string }
}

const lines = readFileSync(join(DATA_DIR, 'invoices.jsonl'), 'utf-8').trim().split('\n')
const invoices: Invoice[] = lines.map(l => JSON.parse(l))

// Aggregate
const byCustomerYear = new Map<string, Map<number, number>>()
const customerTotals = new Map<string, number>()
const currencies = new Set<string>()

for (const inv of invoices) {
  const customer = inv.CustomerRef.name
  const year = parseInt(inv.TxnDate.slice(0, 4), 10)
  const amount = inv.TotalAmt
  currencies.add(inv.CurrencyRef?.value ?? '?')

  if (!byCustomerYear.has(customer)) byCustomerYear.set(customer, new Map())
  const years = byCustomerYear.get(customer)!
  years.set(year, (years.get(year) ?? 0) + amount)
  customerTotals.set(customer, (customerTotals.get(customer) ?? 0) + amount)
}

const allYears = Array.from(new Set(invoices.map(i => parseInt(i.TxnDate.slice(0, 4), 10)))).sort()
const ranked = Array.from(customerTotals.entries()).sort(([, a], [, b]) => b - a)

const fmt = (n: number) => '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 })

// Markdown summary
const out: string[] = []
out.push(`# Myatt's Fields — QuickBooks invoice analysis`)
out.push('')
out.push(`Pulled **${invoices.length} invoices** across **${ranked.length} customers**, ${allYears[0]} → ${allYears[allYears.length - 1]}.`)
out.push(`Currencies: ${Array.from(currencies).join(', ')}.`)
out.push('')

out.push(`## Top 20 customers — lifetime spend`)
out.push(`| # | Customer | Lifetime |`)
out.push(`|---:|---|---:|`)
ranked.slice(0, 20).forEach(([n, t], i) => out.push(`| ${i + 1} | ${n} | ${fmt(t)} |`))
out.push('')

// Focus rows: all Cripps variants + Fortnum's + top 10
const focusNames = Array.from(new Set([
  ...ranked.filter(([n]) => /cripp/i.test(n)).map(([n]) => n),
  ...ranked.filter(([n]) => /fortnum/i.test(n)).map(([n]) => n),
  ...ranked.slice(0, 10).map(([n]) => n),
]))

out.push(`## Spend by year — focus accounts`)
out.push('| Customer | ' + allYears.map(String).join(' | ') + ' | Total |')
out.push('|---' + allYears.map(() => '|---:').join('') + '|---:|')
focusNames.forEach(n => {
  const years = byCustomerYear.get(n) ?? new Map<number, number>()
  const cells = [
    n,
    ...allYears.map(y => years.has(y) ? fmt(years.get(y)!) : '—'),
    fmt(customerTotals.get(n) ?? 0),
  ]
  out.push('| ' + cells.join(' | ') + ' |')
})
out.push('')

// Cripps merge note
const crippsVariants = ranked.filter(([n]) => /cripp/i.test(n))
if (crippsVariants.length > 1) {
  out.push(`## Note: Cripps appears as ${crippsVariants.length} separate records`)
  crippsVariants.forEach(([n, t]) => out.push(`- ${n} → ${fmt(t)}`))
  const combined = crippsVariants.reduce((s, [, t]) => s + t, 0)
  out.push(`- **Combined: ${fmt(combined)}**`)
  out.push(`These should likely be merged into a single Customer object in the CRM.`)
  out.push('')
}

console.log(out.join('\n'))

// CSV export — every customer, every year
const csvHeader = ['Customer', ...allYears.map(String), 'Total']
const csvRows = ranked.map(([n, t]) => {
  const years = byCustomerYear.get(n) ?? new Map<number, number>()
  return [
    `"${n.replace(/"/g, '""')}"`,
    ...allYears.map(y => (years.get(y) ?? 0).toFixed(2)),
    t.toFixed(2),
  ].join(',')
})
const csv = [csvHeader.join(','), ...csvRows].join('\n') + '\n'
const csvPath = join(DATA_DIR, 'spend_by_customer_year.csv')
writeFileSync(csvPath, csv)
console.log(`\nCSV written: ${csvPath}`)
