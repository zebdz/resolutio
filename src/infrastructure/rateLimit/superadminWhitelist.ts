const TTL_MS = 60 * 60_000; // 1 hour

interface SuperadminWhitelistGlobal {
  superadminWhitelist:
    | {
        /** IP → expiry timestamp */
        ips: Map<string, number>;
        /** session → expiry timestamp */
        sessions: Map<string, number>;
        userIds: Set<string>;
      }
    | undefined;
}

const globalForWhitelist = globalThis as unknown as SuperadminWhitelistGlobal;

const whitelist = (globalForWhitelist.superadminWhitelist ??= {
  ips: new Map<string, number>(),
  sessions: new Map<string, number>(),
  userIds: new Set<string>(),
});

if (process.env.NODE_ENV !== 'production') {
  globalForWhitelist.superadminWhitelist = whitelist;
}

/**
 * Register a superadmin's IP, userId, and session.
 * Called on every successful superadmin auth check to keep the whitelist fresh.
 */
export function registerSuperadminAccess(
  ip: string,
  userId: string,
  sessionId: string
): void {
  const expiry = Date.now() + TTL_MS;
  whitelist.ips.set(ip, expiry);
  whitelist.sessions.set(sessionId, expiry);
  whitelist.userIds.add(userId);
}

/** Check if IP belongs to a recently-active superadmin. */
export function isSuperadminIp(ip: string): boolean {
  const expiry = whitelist.ips.get(ip);

  if (expiry === undefined) {
    return false;
  }

  if (Date.now() > expiry) {
    whitelist.ips.delete(ip);

    return false;
  }

  return true;
}

/** Check if session belongs to a recently-active superadmin. */
export function isSuperadminSession(sessionId: string): boolean {
  const expiry = whitelist.sessions.get(sessionId);

  if (expiry === undefined) {
    return false;
  }

  if (Date.now() > expiry) {
    whitelist.sessions.delete(sessionId);

    return false;
  }

  return true;
}

/** Check if userId is a known superadmin. */
export function isSuperadminUserId(userId: string): boolean {
  return whitelist.userIds.has(userId);
}
