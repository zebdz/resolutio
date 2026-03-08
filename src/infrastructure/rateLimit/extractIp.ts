/**
 * Extract client IP from a Request object.
 * Edge Runtime compatible — uses standard Request.headers API.
 * Mirrors logic from src/web/lib/clientIp.ts but without next/headers dependency.
 */
export function extractIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    return normalizeIp(forwarded.split(',')[0].trim());
  }

  const realIp = request.headers.get('x-real-ip');

  if (realIp) {
    return normalizeIp(realIp.trim());
  }

  return '127.0.0.1';
}

/** Normalize IPv6 loopback variants to 127.0.0.1 */
function normalizeIp(ip: string): string {
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return ip;
}
