import {
  prisma,
  PrismaSessionRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { registerSuperadminAccess } from './superadminWhitelist';

const NEGATIVE_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

/** Sessions confirmed as non-superadmin — avoids repeated DB queries from rate-limited attackers */
const notSuperadminCache = new Map<string, number>();

/**
 * DB fallback: check if a session belongs to a superadmin.
 * Only called when someone is actually rate-limited AND not in the in-memory whitelist.
 * Registers in whitelist if found, so subsequent requests bypass without DB.
 */
export async function checkSuperadminBySessionFallback(
  sessionId: string,
  ip: string
): Promise<boolean> {
  const cachedExpiry = notSuperadminCache.get(sessionId);

  if (cachedExpiry && cachedExpiry > Date.now()) {
    return false;
  }

  const sessionRepo = new PrismaSessionRepository(prisma);
  const session = await sessionRepo.findById(sessionId);

  if (!session || session.expiresAt < new Date()) {
    notSuperadminCache.set(sessionId, Date.now() + NEGATIVE_CACHE_TTL_MS);

    return false;
  }

  const userRepo = new PrismaUserRepository(prisma);
  const isSuperAdmin = await userRepo.isSuperAdmin(session.userId);

  if (!isSuperAdmin) {
    notSuperadminCache.set(sessionId, Date.now() + NEGATIVE_CACHE_TTL_MS);

    return false;
  }

  registerSuperadminAccess(ip, session.userId, sessionId);

  return true;
}
