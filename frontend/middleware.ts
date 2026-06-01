import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Force dynamic rendering for all dashboard routes - prevent static generation
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    response.headers.set('x-middleware-cache', 'no-cache');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  }
  
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/(dashboard)/:path*',
  ],
};
