import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all routes except static files and API routes
  matcher: [
    // Match all pathnames except for
    // - … if they have a file extension
    // - … if they are in the /api or /_next folders
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|dev-sw.js).*)'
  ]
};
