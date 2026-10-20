/**
 * QuickBooks Online API client for MFC Dashboard
 *
 * Required environment variables:
 *   QB_CLIENT_ID       — From Intuit Developer Portal
 *   QB_CLIENT_SECRET   — From Intuit Developer Portal
 *   QB_REFRESH_TOKEN   — Seed only, see below
 *   QB_REALM_ID        — Your QuickBooks Company ID (seed only, as below)
 *
 * Setup: sign in to Back Bar and visit /api/qb-auth. Intuit's consent screen
 * sends you back to /api/qb-callback, which stores the refresh token and realm
 * in system_settings. Nothing needs copying into Vercel.
 *
 * Token refresh: access tokens last an hour. Intuit rotates the refresh token
 * when it hands out a new one, and the old one dies. So the live refresh
 * token lives in system_settings and is rewritten on every refresh; the env
 * var only seeds that row the first time. (Until 20 Oct 2026 the env var was
 * the only copy, never updated, which is why the link kept dying.)
 */

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { SETTING_KEYS, systemSettings } from '@/db/schema'

const QB_CLIENT_ID = process.env.QB_CLIENT_ID!
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET!
const QB_BASE_URL = 'https://quickbooks.api.intuit.com'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_MINOR_VERSION = 75

async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key))
  return row?.value ?? null
}

async function writeSetting(key: string, value: string): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } })
}

/** Store the tokens from Intuit's consent screen. Called by /api/qb-callback. */
export async function saveQBConnection(refreshToken: string, realmId: string): Promise<void> {
  await writeSetting(SETTING_KEYS.QB_REFRESH_TOKEN, refreshToken)
  await writeSetting(SETTING_KEYS.QB_REALM_ID, realmId)
}

export async function getQBRealmId(): Promise<string | null> {
  return (await readSetting(SETTING_KEYS.QB_REALM_ID)) ?? process.env.QB_REALM_ID ?? null
}

export interface QBInvoice {
  Id: string
  DocNumber: string
  TxnDate: string
  DueDate: string
  CustomerRef: { value: string; name: string }
  TotalAmt: number
  Balance: number // 0 = paid, >0 = outstanding
  Line: Array<{
    Description?: string
    Amount: number
    SalesItemLineDetail?: {
      ItemRef: { name: string; value: string }
      Qty: number
      UnitPrice: number
    }
  }>
}

export interface QBCustomer {
  Id: string
  DisplayName: string
  Balance: number
}

export interface QBRevenueData {
  ytdRevenue: number
  ytdInvoiceCount: number
  outstandingBalance: number
  overdueInvoices: QBInvoice[]
  recentInvoices: QBInvoice[]
  topCustomers: Array<{ name: string; revenue: number }>
  revenueByMonth: Record<string, number>
}

/**
 * Get a fresh access token, and keep whichever refresh token Intuit hands
 * back. The database copy wins; the env var is used only while the row is
 * empty, and is never fallen back to once a stored token has failed.
 */
export async function getAccessToken(): Promise<string | null> {
  const refreshToken =
    (await readSetting(SETTING_KEYS.QB_REFRESH_TOKEN)) ?? process.env.QB_REFRESH_TOKEN ?? null
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !refreshToken) {
    console.warn('[QuickBooks] Missing credentials — skipping QB data')
    return null
  }

  const credentials = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64')

  try {
    const res = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('[QuickBooks] Token refresh failed — re-auth at /api/qb-auth:', await res.text())
      return null
    }

    const data = await res.json()
    if (data.refresh_token) {
      await writeSetting(SETTING_KEYS.QB_REFRESH_TOKEN, data.refresh_token)
    }
    return data.access_token
  } catch (err) {
    console.error('[QuickBooks] Token error:', err)
    return null
  }
}

/** Run a QuickBooks query */
async function qbQuery<T>(accessToken: string, query: string): Promise<T | null> {
  const realmId = await getQBRealmId()
  const url = `${QB_BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=${QB_MINOR_VERSION}`

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      next: { revalidate: 1800 },
    })

    if (!res.ok) {
      console.error('[QuickBooks] Query error:', await res.text())
      return null
    }

    const json = await res.json()
    return json.QueryResponse as T
  } catch (err) {
    console.error('[QuickBooks] Query error:', err)
    return null
  }
}

/**
 * Call the QuickBooks Accounting API directly, uncached, and throw on any
 * error. For scripts and writes, where a silent null would hide a failure.
 * `path` is relative to /v3/company/{realm}/, e.g. "item" or "query?query=…".
 */
export async function qbRequest<T>(
  accessToken: string,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const realmId = await getQBRealmId()
  if (!realmId) throw new Error('[QuickBooks] No realm ID — re-auth at /api/qb-auth')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${QB_BASE_URL}/v3/company/${realmId}/${path}${sep}minorversion=${QB_MINOR_VERSION}`, {
    method: init.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`[QuickBooks] ${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

/** Main function: fetch QB revenue data for the current year */
export async function getQBRevenueData(): Promise<QBRevenueData | null> {
  const accessToken = await getAccessToken()
  if (!accessToken || !(await getQBRealmId())) return null

  const currentYear = new Date().getFullYear()
  const since = `${currentYear}-01-01`

  // Fetch all invoices for YTD
  const invoiceQuery = `SELECT * FROM Invoice WHERE TxnDate >= '${since}' ORDERBY TxnDate DESC MAXRESULTS 200`
  const invoiceResponse = await qbQuery<{ Invoice?: QBInvoice[] }>(accessToken, invoiceQuery)
  const invoices = invoiceResponse?.Invoice ?? []

  if (!invoices.length) return null

  // Calculate metrics
  const ytdRevenue = invoices.reduce((sum, inv) => sum + inv.TotalAmt, 0)
  const outstandingBalance = invoices.reduce((sum, inv) => sum + inv.Balance, 0)

  // Overdue: balance > 0 and due date in the past
  const today = new Date().toISOString().split('T')[0]
  const overdueInvoices = invoices
    .filter(inv => inv.Balance > 0 && inv.DueDate < today)
    .slice(0, 10)

  // Revenue by month
  const revenueByMonth: Record<string, number> = {}
  invoices.forEach(inv => {
    const month = inv.TxnDate.substring(0, 7)
    revenueByMonth[month] = (revenueByMonth[month] || 0) + inv.TotalAmt
  })

  // Top customers by YTD revenue
  const customerMap: Record<string, number> = {}
  invoices.forEach(inv => {
    const name = inv.CustomerRef.name
    customerMap[name] = (customerMap[name] || 0) + inv.TotalAmt
  })

  const topCustomers = Object.entries(customerMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    ytdRevenue,
    ytdInvoiceCount: invoices.length,
    outstandingBalance,
    overdueInvoices,
    recentInvoices: invoices.slice(0, 15),
    topCustomers,
    revenueByMonth,
  }
}
