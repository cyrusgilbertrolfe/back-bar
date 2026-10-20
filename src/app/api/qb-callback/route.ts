/**
 * QuickBooks OAuth callback — exchanges the code for a refresh token and
 * stores it, with the realm, in system_settings (see lib/quickbooks.ts).
 * REDIRECT_URI = https://admin.myattsfields.com/api/qb-callback must be
 * listed in the Intuit app's settings.
 */

import { NextRequest, NextResponse } from 'next/server'

import { saveQBConnection } from '@/lib/quickbooks'

const CLIENT_ID = process.env.QB_CLIENT_ID!
const CLIENT_SECRET = process.env.QB_CLIENT_SECRET!
const REDIRECT_URI = 'https://admin.myattsfields.com/api/qb-callback'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')

  if (!code || !realmId) {
    return new NextResponse('Missing code or realmId', { status: 400 })
  }

  const state = searchParams.get('state')
  if (!state || state !== request.cookies.get('qb-oauth-state')?.value) {
    return new NextResponse('State mismatch — start again at /api/qb-auth', { status: 400 })
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok) {
    return new NextResponse(`Token exchange failed: ${JSON.stringify(tokenData)}`, { status: 500 })
  }

  await saveQBConnection(tokenData.refresh_token, realmId)

  const response = new NextResponse(
    `<html><body style="background:#0a0a0a;color:#fff;font-family:monospace;padding:40px">
      <h2 style="color:#C9A84C">✓ QuickBooks Connected</h2>
      <p>Refresh token and realm ${realmId} saved to Back Bar. Nothing to copy.</p>
      <a href="/dashboard" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px">
        Go to Dashboard →
      </a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
  response.cookies.delete({ name: 'qb-oauth-state', path: '/api/qb-callback' })
  return response
}
