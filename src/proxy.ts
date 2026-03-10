import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import {
  middlewareSessionLimiter,
  middlewareIpLimiter,
  getLimiterByLabel,
} from './infrastructure/rateLimit';
import { extractIpFromRequest } from './infrastructure/rateLimit/extractIp';
import { isIpBlocked } from './infrastructure/rateLimit/ipBlockCheck';
import {
  isSuperadminIp,
  isSuperadminSession,
} from './infrastructure/rateLimit/superadminWhitelist';
import { checkSuperadminBySessionFallback } from './infrastructure/rateLimit/superadminFallbackCheck';

const intlMiddleware = createMiddleware(routing);

// Matches /{locale}/rate-limited or /{locale}/ip-blocked to skip checks on error pages
const RATE_LIMITED_PATH = /^\/[a-z]{2}\/rate-limited/;
const IP_BLOCKED_PATH = /^\/[a-z]{2}\/ip-blocked/;

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

export default async function middleware(request: NextRequest) {
  // Don't rate-limit or IP-block the error pages themselves
  if (
    RATE_LIMITED_PATH.test(request.nextUrl.pathname) ||
    IP_BLOCKED_PATH.test(request.nextUrl.pathname)
  ) {
    return intlMiddleware(request);
  }

  // Server actions: skip rate limiting — they can't handle non-RSC responses.
  // Protected by page-level rate limiting, auth checks, and client-side debounce.
  if (request.headers.has('next-action')) {
    return intlMiddleware(request);
  }

  // Dev mode: skip general-purpose rate limiting (login/registration/phone limits still active)
  if (process.env.NODE_ENV === 'development') {
    return intlMiddleware(request);
  }

  const ip = extractIpFromRequest(request);

  const isSuperadmin = isSuperadminIp(ip);

  // Check if IP is blocked (synchronous — uses in-memory cache)
  // Superadmin IPs skip IP block checks
  if (!isSuperadmin && isIpBlocked(ip)) {
    if (isBrowserRequest(request)) {
      const locale = extractLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/ip-blocked`;

      return NextResponse.redirect(url, { status: 302 });
    }

    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionCookie = request.cookies.get('session')?.value;

  let blocked = false;
  let retryAfterSeconds = 0;

  if (sessionCookie) {
    // Authenticated: rate limit by session only — don't pollute IP counter
    const sessionResult = middlewareSessionLimiter.check(
      `mw-session:${sessionCookie}`
    );
    blocked = !sessionResult.allowed;
    retryAfterSeconds = sessionResult.retryAfterSeconds;
  } else {
    // Unauthenticated: rate limit by IP
    const ipResult = middlewareIpLimiter.check(ip);
    blocked = !ipResult.allowed;
    retryAfterSeconds = ipResult.retryAfterSeconds;
  }

  // Session-based superadmin check for rate limit bypass (IP alone not enough — shared network)
  const isSuperadminForRateLimit = sessionCookie
    ? isSuperadminSession(sessionCookie)
    : isSuperadminIp(ip);

  // DB fallback: check if rate-limited session belongs to a superadmin not yet in whitelist
  if (blocked && !isSuperadminForRateLimit && sessionCookie) {
    if (await checkSuperadminBySessionFallback(sessionCookie, ip)) {
      blocked = false;
    }
  }

  if (blocked && !isSuperadminForRateLimit) {
    // Browsers: redirect to error page
    if (isBrowserRequest(request)) {
      const locale = extractLocale(request);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/rate-limited`;
      url.searchParams.set('retryAfter', String(retryAfterSeconds));
      url.searchParams.set('from', request.nextUrl.pathname);

      return NextResponse.redirect(url, { status: 302 });
    }

    // API routes, curl, bots, scripts: return 429 JSON
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(
          getLimiterByLabel('middlewareIp')!.maxRequests
        ),
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
