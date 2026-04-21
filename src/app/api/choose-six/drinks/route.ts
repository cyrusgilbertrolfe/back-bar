// src/app/api/choose-six/drinks/route.ts
// Public, CORS-open endpoint that feeds the Choose Six box builder on mfc.london/products/boxset.
// The widget script (served from /choose-six-widget.js) fetches this on page load.

import { NextResponse } from 'next/server'
import {
  CHOOSE_SIX_DRINKS,
  CHOOSE_SIX_PRESETS,
} from '@/data/choose-six-drinks'

const CORS = {
  'Access-Control-Allow-Origin': 'https://mfc.london',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

export async function GET() {
  return NextResponse.json(
    {
      drinks: CHOOSE_SIX_DRINKS,
      presets: CHOOSE_SIX_PRESETS,
    },
    { headers: CORS },
  )
}
