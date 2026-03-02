import { headers } from 'next/headers';

export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const forwarded = headersList.get('x-forwarded-for');

  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; first is the client
    return forwarded.split(',')[0].trim();
  }

  const realIp = headersList.get('x-real-ip');

  if (realIp) {
    return realIp.trim();
  }

  return '127.0.0.1';
}
