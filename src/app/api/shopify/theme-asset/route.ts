// src/app/api/shopify/theme-asset/route.ts
// Internal one-shot tool for writing a single theme asset via the Shopify
// Admin REST API. Gated by the same AUTH_SECRET used by src/proxy.ts —
// either an auth-session cookie (logged-in in the Next.js UI) or an
// X-Auth-Secret header matching the env var.
//
// Request: POST with JSON body { themeId: number, key: string, value: string }
// Response: 200 { ok: true, asset } on success, 4xx/5xx on failure.

import { NextRequest, NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET
const AUTH_SECRET = process.env.AUTH_SECRET
const API_VERSION = '2024-01'

function authorize(req: NextRequest) {
  if (!AUTH_SECRET) return false
  const cookie = req.cookies.get('auth-session')?.value
  if (cookie === AUTH_SECRET) return true
  const header = req.headers.get('x-auth-secret')
  if (header === AUTH_SECRET) return true
  return false
}

async function getToken(): Promise<string | null> {
  if (!SHOPIFY_DOMAIN || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) return null
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token ?? null
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: { themeId?: number | string; key?: string; value?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const { themeId, key, value } = body
  if (!themeId || !key || typeof value !== 'string') {
    return NextResponse.json({ error: 'themeId, key, value required' }, { status: 400 })
  }

  const token = await getToken()
  if (!token) {
    return NextResponse.json({ error: 'Shopify token not available' }, { status: 500 })
  }

  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/themes/${themeId}/assets.json`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ asset: { key, value } }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Shopify API error', status: res.status, detail: text },
      { status: res.status },
    )
  }
  try {
    return NextResponse.json({ ok: true, asset: JSON.parse(text) })
  } catch {
    return NextResponse.json({ ok: true, raw: text })
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const themeId = url.searchParams.get('themeId')
  const key = url.searchParams.get('key')
  if (!themeId || !key) {
    return NextResponse.json({ error: 'themeId and key query params required' }, { status: 400 })
  }
  const token = await getToken()
  if (!token) {
    return NextResponse.json({ error: 'Shopify token not available' }, { status: 500 })
  }
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
    { headers: { 'X-Shopify-Access-Token': token }, cache: 'no-store' },
  )
  const text = await res.text()
  if (!res.ok) {
    return NextResponse.json({ error: 'Shopify API error', status: res.status, detail: text }, { status: res.status })
  }
  return new NextResponse(text, { headers: { 'Content-Type': 'application/json' } })
}
