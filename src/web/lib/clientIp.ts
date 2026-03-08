import { headers } from 'next/headers';

/** Normalize IPv6 loopback variants to 127.0.0.1 */
function normalizeIp(ip: string): string {
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return ip;
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const forwarded = headersList.get('x-forwarded-for');

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; first is the client
    return normalizeIp(forwarded.split(',')[0].trim());
  }

  const realIp = headersList.get('x-real-ip');

  if (realIp) {
    return normalizeIp(realIp.trim());
  }

  return '127.0.0.1';
}
