import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { rateLimiter } from './infrastructure/rateLimit';
import { extractIpFromRequest } from './infrastructure/rateLimit/extractIp';

const intlMiddleware = createMiddleware(routing);

// Matches /{locale}/rate-limited to skip rate limiting on the error page itself
const RATE_LIMITED_PATH = /^\/[a-z]{2}\/rate-limited/;

function isBrowserRequest(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? '';

  return accept.includes('text/html');
}

function extractLocale(request: NextRequest): string {
  // Try to get locale from URL path (e.g. /ru/some-page)
  const pathLocale = request.nextUrl.pathname.split('/')[1];

  if (pathLocale && routing.locales.includes(pathLocale as never)) {
    return pathLocale;
  }

  return routing.defaultLocale;
}

export default function middleware(request: NextRequest) {
  // Don't rate-limit the error page itself
  if (RATE_LIMITED_PATH.test(request.nextUrl.pathname)) {
    return intlMiddleware(request);
  }

  // Server actions: skip rate limiting — they can't handle non-RSC responses.
  // Protected by page-level rate limiting, auth checks, and client-side debounce.
  if (request.headers.has('next-action')) {
    return intlMiddleware(request);
  }

  const ip = extractIpFromRequest(request);
  const result = rateLimiter.check(ip);

  if (!result.allowed) {
    // Browsers: redirect to error page
    if (isBrowserRequest(request)) {
      const locale = extractLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/rate-limited`;
      url.searchParams.set('retryAfter', String(result.retryAfterSeconds));
      url.searchParams.set('from', request.nextUrl.pathname);

      return NextResponse.redirect(url, { status: 302 });
    }

    // API routes, curl, bots, scripts: return 429 JSON
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  // API routes: skip intl middleware
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all routes except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*|dev-sw.js).*)'],
};
