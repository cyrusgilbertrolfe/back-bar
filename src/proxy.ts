import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === '/login' ||
    pathname.startsWith('/api/dick') ||
    pathname.startsWith('/api/choose-six') ||
    pathname.startsWith('/api/shopify/theme-asset') ||
    pathname.startsWith('/choose-six-widget')
  ) {
    return NextResponse.next()
  }

  const session = request.cookies.get('auth-session')
  const secret = process.env.AUTH_SECRET

  if (!secret || !session || session.value !== secret) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}