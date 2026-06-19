import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Production domain — only this domain gets indexed
const PRODUCTION_HOST = 'zendbx.in';

// Paths that must never be indexed regardless of environment
const NOINDEX_PATH_PREFIXES = [
  '/dashboard',
  '/api',
  '/login',
  '/signup',
  '/onboarding',
  '/select-project',
  '/callback',
  '/forgot-password',
  '/reset-password',
];

function isNonProductionHost(host: string): boolean {
  // Strip port if present
  const hostname = host.split(':')[0];
  // Not production if it's not the exact production domain
  return hostname !== PRODUCTION_HOST && hostname !== `www.${PRODUCTION_HOST}`;
}

function pathRequiresNoIndex(pathname: string): boolean {
  return NOINDEX_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const host = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // ── 1. Development / staging / preview environments ─────────────────────
  // Block ALL indexing on non-production domains
  if (isNonProductionHost(host)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  // ── 2. Paths that must never be indexed (even on production) ─────────────
  if (pathRequiresNoIndex(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    // Prevent CDN caching of authenticated/private pages
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  }

  // ── 3. Add canonical header on production public pages ───────────────────
  if (!isNonProductionHost(host) && !pathRequiresNoIndex(pathname)) {
    const canonical = `https://${PRODUCTION_HOST}${pathname}`;
    response.headers.set('Link', `<${canonical}>; rel="canonical"`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimisation)
     * - favicon.ico / robots.txt / sitemap.xml / logo.png (public files)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|logo\\.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)).*)',
  ],
};
