import type { OtpRepository } from '@/domain/otp/OtpRepository';
import {
  OtpVerification,
  type OtpChannel,
  type OtpPurpose,
} from '@/domain/otp/OtpVerification';
import type { PrismaClient } from '@/generated/prisma/client';

export class PrismaOtpRepository implements OtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(otp: OtpVerification): Promise<OtpVerification> {
    const saved = await this.prisma.otpVerification.create({
      data: {
        identifier: otp.identifier,
        channel: otp.channel,
        purpose: otp.purpose,
        code: otp.code,
        clientIp: otp.clientIp,
        userId: otp.userId,
        attempts: otp.attempts,
        maxAttempts: otp.maxAttempts,
        expiresAt: otp.expiresAt,
        verifiedAt: otp.verifiedAt,
        createdAt: otp.createdAt,
      },
    });

    return this.toDomain(saved);
  }

  async findById(id: string): Promise<OtpVerification | null> {
    const record = await this.prisma.otpVerification.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    const record = await this.prisma.otpVerification.findFirst({
      where: { identifier, channel, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findLatestByUserId(
    userId: string,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    const record = await this.prisma.otpVerification.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    const updated = await this.prisma.otpVerification.update({
      where: { id: otp.id },
      data: {
        attempts: otp.attempts,
        verifiedAt: otp.verifiedAt,
      },
    });

    return this.toDomain(updated);
  }

  async countRecentByClientIp(ip: string, sinceHours: number): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return this.prisma.otpVerification.count({
      where: {
        clientIp: ip,
        createdAt: { gte: since },
      },
    });
  }

  async countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    sinceHours: number
  ): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return this.prisma.otpVerification.count({
      where: {
        identifier,
        channel,
        purpose,
        createdAt: { gte: since },
      },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.otpVerification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  private toDomain(record: {
    id: string;
    identifier: string;
    channel: string;
    purpose: string;
    code: string;
    clientIp: string;
    userId: string;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    verifiedAt: Date | null;
    createdAt: Date;
  }): OtpVerification {
    return OtpVerification.reconstitute({
      id: record.id,
      identifier: record.identifier,
      channel: record.channel as OtpChannel,
      purpose: record.purpose as OtpPurpose,
      code: record.code,
      clientIp: record.clientIp,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      expiresAt: record.expiresAt,
      verifiedAt: record.verifiedAt,
      createdAt: record.createdAt,
      userId: record.userId,
    });
  }
}
