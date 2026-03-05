/**
 * Extract client IP from a Request object.
 * Edge Runtime compatible — uses standard Request.headers API.
 * Mirrors logic from src/web/lib/clientIp.ts but without next/headers dependency.
 */
export function extractIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');

  if (realIp) {
    return realIp.trim();
  }

  return '127.0.0.1';
}
