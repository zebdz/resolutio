'use server';

import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getClientIp } from '@/web/lib/clientIp';
import { getSessionCookie } from '@/web/lib/session';
import {
  serverActionLimiter as limiter,
  phoneSearchLimiter,
  loginLimiter,
  registrationIpLimiter,
  registrationDeviceLimiter,
} from '@/infrastructure/rateLimit/registry';
import {
  isSuperadminIp,
  isSuperadminSession,
} from '@/infrastructure/rateLimit/superadminWhitelist';

const LOGIN_WINDOW_MS = 15 * 60_000; // 15 minutes
const REGISTRATION_WINDOW_MS = 60 * 60_000; // 1 hour

/**
 * Check rate limit: session key (authenticated) or IP (unauthenticated).
 * Returns a failed ActionResult if rate-limited, null otherwise.
 *
 * Usage (at the top of every server action):
 *   const rateLimited = await checkRateLimit();
 *   if (rateLimited) return rateLimited;
 */
export async function checkRateLimit(): Promise<{
  success: false;
  error: string;
} | null> {
  const ip = await getClientIp();
  const sessionId = await getSessionCookie();

  if (sessionId) {
    // Authenticated: rate limit by session only — don't pollute IP counter
    const sessionResult = limiter.check(`session:${sessionId}`);

    // Session-based superadmin check — IP alone is not enough (shared network)
    if (!sessionResult.allowed && !isSuperadminSession(sessionId)) {
      const t = await getTranslations('rateLimit');

      return { success: false, error: t('tooManyRequests') };
    }
  } else {
    // Unauthenticated: rate limit by IP (fallback to IP-based superadmin check)
    const ipResult = limiter.check(ip);

    if (!ipResult.allowed && !isSuperadminIp(ip)) {
      const t = await getTranslations('rateLimit');

      return { success: false, error: t('tooManyRequests') };
    }
  }

  return null;
}

/**
 * Record a failed phone search attempt (not found).
 * Only failed attempts count toward the rate limit.
 */
export async function recordFailedPhoneSearch(userId: string): Promise<void> {
  phoneSearchLimiter.check(`user:${userId}`);
}

/**
 * Check if the user is rate-limited for phone searches.
 * Returns a failed ActionResult if rate-limited, null otherwise.
 */
export async function checkPhoneSearchRateLimit(userId: string): Promise<{
  success: false;
  error: string;
} | null> {
  const result = phoneSearchLimiter.peek(`user:${userId}`);

  if (!result.allowed) {
    const t = await getTranslations('rateLimit');

    return { success: false, error: t('tooManyPhoneSearches') };
  }

  return null;
}

/**
 * Check if an IP+phone combo is rate-limited for login attempts.
 * Uses peek() — does NOT record an attempt.
 */
export async function checkLoginRateLimit(
  phone: string,
  ip: string
): Promise<{
  success: false;
  error: string;
} | null> {
  const result = loginLimiter.peek(`login:${ip}:${phone}`);

  if (!result.allowed) {
    const t = await getTranslations('rateLimit');
    const minutes = LOGIN_WINDOW_MS / 60_000;

    return {
      success: false,
      error: t('tooManyLoginAttempts', { minutes }),
    };
  }

  return null;
}

/**
 * Record a failed login attempt for an IP+phone combo.
 */
export async function recordFailedLogin(
  phone: string,
  ip: string
): Promise<void> {
  loginLimiter.check(`login:${ip}:${phone}`);
}

/**
 * Reset login rate limit for an IP+phone combo (on successful login).
 */
export async function resetLoginRateLimit(
  phone: string,
  ip: string
): Promise<void> {
  loginLimiter.reset(`login:${ip}:${phone}`);
}

const DEVICE_COOKIE_NAME = 'device_id';
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

async function getOrCreateDeviceId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_COOKIE_NAME)?.value;

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  cookieStore.set(DEVICE_COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEVICE_COOKIE_MAX_AGE,
    path: '/',
  });

  return id;
}

/**
 * Check registration rate limit using dual keys: IP (50/hr) + device UUID (3/hr).
 * Every call counts as an attempt (uses check(), not peek()).
 */
export async function checkRegistrationRateLimit(ip: string): Promise<{
  success: false;
  error: string;
} | null> {
  if (!registrationIpLimiter.check(`register:${ip}`).allowed) {
    const t = await getTranslations('rateLimit');
    const minutes = REGISTRATION_WINDOW_MS / 60_000;

    return { success: false, error: t('tooManyRegistrations', { minutes }) };
  }

  const deviceId = await getOrCreateDeviceId();

  if (!registrationDeviceLimiter.check(`register:${deviceId}`).allowed) {
    const t = await getTranslations('rateLimit');
    const minutes = REGISTRATION_WINDOW_MS / 60_000;

    return { success: false, error: t('tooManyRegistrations', { minutes }) };
  }

  return null;
}
