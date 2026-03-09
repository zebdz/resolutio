'use server';

import { getTranslations } from 'next-intl/server';
import { prisma } from '@/infrastructure/index';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { IpBlockRepository } from '@/infrastructure/repositories/IpBlockRepository';
import { invalidateIpBlockCache } from '@/infrastructure/rateLimit/ipBlockCheck';
import { requireSuperadmin } from '@/web/actions/superadminAuth';
import { isError } from '@/web/actions/superadminAuthUtils';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface BlockedIpEntry {
  ipAddress: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  statusChangedBy: { id: string; firstName: string; lastName: string };
}

export interface IpBlockHistoryEntry {
  id: string;
  ipAddress: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  statusChangedBy: { firstName: string; lastName: string };
}

const ipBlockRepo = new IpBlockRepository(prisma);

export async function blockIpAction(input: {
  ipAddress: string;
  reason: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const t = await getTranslations('superadmin.blockedIps');

  if (!input.reason.trim()) {
    return { success: false, error: t('reasonRequired') };
  }

  await ipBlockRepo.blockIp(input.ipAddress, auth.userId, input.reason);
  invalidateIpBlockCache();

  console.log(
    `[IpBlock] ${new Date().toISOString()} blocked ip=${input.ipAddress} reason="${input.reason}" by superadmin=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function unblockIpAction(input: {
  ipAddress: string;
  reason: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const t = await getTranslations('superadmin.blockedIps');

  if (!input.reason.trim()) {
    return { success: false, error: t('reasonRequired') };
  }

  await ipBlockRepo.unblockIp(input.ipAddress, auth.userId, input.reason);
  invalidateIpBlockCache();

  console.log(
    `[IpBlock] ${new Date().toISOString()} unblocked ip=${input.ipAddress} reason="${input.reason}" by superadmin=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function getIpBlockStatusAction(input: {
  ipAddress: string;
}): Promise<
  ActionResult<{ blocked: boolean; reason?: string; blockedAt?: Date }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const status = await ipBlockRepo.getBlockStatus(input.ipAddress);

  return { success: true, data: status ?? { blocked: false } };
}

export async function getIpBlockHistoryAction(input: {
  ipAddress: string;
}): Promise<ActionResult<IpBlockHistoryEntry[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const history = await ipBlockRepo.getBlockHistory(input.ipAddress);

  return { success: true, data: history };
}

export async function searchBlockedIpsAction(input: {
  query: string;
}): Promise<ActionResult<BlockedIpEntry[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  if (input.query.length < 3) {
    return { success: false, error: 'Query must be at least 3 characters' };
  }

  const results = await ipBlockRepo.searchBlockedIps(input.query);

  return { success: true, data: results };
}

export async function getBlockedIpsAction(input: {
  page?: number;
  pageSize?: number;
}): Promise<ActionResult<{ items: BlockedIpEntry[]; totalCount: number }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  // Get latest status per IP, paginated
  const items = await prisma.ipBlockStatus.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['ipAddress'],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      ipAddress: true,
      status: true,
      reason: true,
      createdAt: true,
      statusChangedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return { success: true, data: { items, totalCount: items.length } };
}
