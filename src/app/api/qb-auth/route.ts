/**
 * QuickBooks OAuth start
 *
 * Visit https://admin.myattsfields.com/api/qb-auth (behind the Back Bar
 * password gate) whenever the QuickBooks link has died. Intuit's consent
 * screen sends you back to /api/qb-callback, which stores the refresh token
 * in system_settings. Nothing needs copying anywhere.
 */

import { NextRequest, NextResponse } from 'next/server'

const CLIENT_ID = process.env.QB_CLIENT_ID!
const REDIRECT_URI = 'https://admin.myattsfields.com/api/qb-callback'

// Step 1: Redirect to Intuit OAuth
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  if (!searchParams.has('start')) {
    // Show a simple page to start the flow
    return new NextResponse(
      `<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:40px">
        <h2>QuickBooks OAuth Setup</h2>
        <p>Click below to connect your QuickBooks account.</p>
        <p style="color:#888;font-size:12px">Needed only when the link has died. The token is saved for you.</p>
        <a href="/api/qb-auth?start=1" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px">
          Connect QuickBooks →
        </a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const scopes = ['com.intuit.quickbooks.accounting']
  const state = crypto.randomUUID()

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('qb-oauth-state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/qb-callback',
  })
  return response
}
