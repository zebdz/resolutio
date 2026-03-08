import type { PrismaClient } from '@/generated/prisma/client';

export interface IpBlockStatusResult {
  blocked: boolean;
  reason?: string;
  blockedAt?: Date;
}

export class IpBlockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isIpBlocked(ip: string): Promise<boolean> {
    const latest = await this.prisma.ipBlockStatus.findFirst({
      where: { ipAddress: ip },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    return latest?.status === 'blocked';
  }

  async blockIp(
    ip: string,
    superadminId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.ipBlockStatus.create({
      data: {
        ipAddress: ip,
        status: 'blocked',
        statusChangedBySuperadminId: superadminId,
        reason,
      },
    });
  }

  async unblockIp(
    ip: string,
    superadminId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.ipBlockStatus.create({
      data: {
        ipAddress: ip,
        status: 'unblocked',
        statusChangedBySuperadminId: superadminId,
        reason,
      },
    });
  }

  async getBlockStatus(ip: string): Promise<IpBlockStatusResult | null> {
    const latest = await this.prisma.ipBlockStatus.findFirst({
      where: { ipAddress: ip },
      orderBy: { createdAt: 'desc' },
      select: { status: true, reason: true, createdAt: true },
    });

    if (!latest) {
      return null;
    }

    if (latest.status === 'blocked') {
      return {
        blocked: true,
        reason: latest.reason ?? undefined,
        blockedAt: latest.createdAt,
      };
    }

    return { blocked: false };
  }

  async searchBlockedIps(query: string) {
    return this.prisma.ipBlockStatus.findMany({
      where: { ipAddress: { contains: query } },
      orderBy: { createdAt: 'desc' },
      distinct: ['ipAddress'],
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
  }

  async getAllBlockedIps(): Promise<string[]> {
    const entries = await this.prisma.ipBlockStatus.findMany({
      orderBy: { createdAt: 'desc' },
      distinct: ['ipAddress'],
      select: { ipAddress: true, status: true },
    });

    return entries
      .filter((e) => e.status === 'blocked')
      .map((e) => e.ipAddress);
  }

  async getBlockHistory(ip: string) {
    return this.prisma.ipBlockStatus.findMany({
      where: { ipAddress: ip },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        status: true,
        reason: true,
        createdAt: true,
        statusChangedBy: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }
}
