// src/lib/cors.ts
//
// One allowlist for every public, browser-facing API in this app.
//
// WHY THIS EXISTS: on 13 Jul 2026 the Choose Six box builder and Dick the AI
// bartender were both found dead on the live shop. Both had
// `Access-Control-Allow-Origin: 'https://mfc.london'` hardcoded. The shop had
// moved to myattsfields.london, so the browser blocked every fetch and the
// customer got an apology box instead of a product. Nobody noticed, because a
// CORS failure is invisible from the server: the API returns 200, and only the
// browser refuses the response.
//
// The lesson is NOT "swap one hardcoded domain for another". It is: never
// hardcode a single origin. Reflect a known-good origin from an allowlist, and
// always send `Vary: Origin` so a CDN cannot cache one origin's header and
// serve it to another.
//
// It happened again on 19 Aug 2026 when the shop moved to myattsfields.com and
// this list was not updated. Add the new origin here in the same change as any
// future domain move.

const ALLOWED_ORIGINS = new Set([
  // current shop, live since 19 Aug 2026
  'https://myattsfields.com',
  'https://www.myattsfields.com',
  'https://myattsfields.london',
  'https://www.myattsfields.london',
  'https://mfc.london', // legacy: still redirects, and it is printed on the bottle labels
  'https://www.mfc.london',
  'https://mfclondon.myshopify.com', // Shopify's own preview/admin origin
])

const DEFAULT_ORIGIN = 'https://myattsfields.com'

/**
 * Build CORS headers for a request, reflecting the caller's origin when it is
 * on the allowlist. Always sets Vary: Origin so the CDN keys its cache on it.
 */
export function corsHeaders(
  origin: string | null,
  opts: { methods: string; cacheControl?: string } = { methods: 'GET, OPTIONS' },
): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': opts.methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }

  if (opts.cacheControl) headers['Cache-Control'] = opts.cacheControl

  return headers
}

export { ALLOWED_ORIGINS, DEFAULT_ORIGIN }
