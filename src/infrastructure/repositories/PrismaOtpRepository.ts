/** Persists assigned OTP identities and maps validated records and explicit cutoffs.
 * The adapter never chooses domain identity, verification state or evaluation time. */
import { UserId, OtpVerificationId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { ClientIp } from '@/domain/auth/AuthValues';
import { OtpDestination, OtpCount } from '@/domain/otp/OtpValues';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import {
  OtpVerification,
  type RawOtpVerificationProps,
  type OtpPurpose,
} from '@/domain/otp/OtpVerification';
import type { PrismaClient } from '@/generated/prisma/client';

export class PrismaOtpRepository implements OtpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(otp: OtpVerification): Promise<OtpVerification> {
    const saved = await this.prisma.otpVerification.create({
      data: {
        id: otp.id,
        identifier: otp.identifier,
        channel: otp.channel,
        purpose: otp.purpose,
        code: otp.code,
        clientIp: otp.clientIp,
        userId: otp.userId,
        attempts: otp.attempts,
        maxAttempts: otp.maxAttempts,
        expiresAt: Instant.toDate(otp.expiresAt),
        verifiedAt:
          otp.verifiedAt === null ? null : Instant.toDate(otp.verifiedAt),
        createdAt: Instant.toDate(otp.createdAt),
      },
    });

    return this.toDomain(saved);
  }

  async findById(id: OtpVerificationId): Promise<OtpVerification | null> {
    const record = await this.prisma.otpVerification.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findLatestByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    const record = await this.prisma.otpVerification.findFirst({
      where: { ...destination, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findLatestByUserId(
    userId: UserId,
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
        verifiedAt:
          otp.verifiedAt === null ? null : Instant.toDate(otp.verifiedAt),
      },
    });

    return this.toDomain(updated);
  }

  async countRecentByClientIp(ip: ClientIp, since: Instant): Promise<OtpCount> {
    const count = await this.prisma.otpVerification.count({
      where: {
        clientIp: ip,
        createdAt: { gte: Instant.toDate(since) },
      },
    });

    return OtpCount.parse(count);
  }

  async countRecentByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose,
    since: Instant
  ): Promise<OtpCount> {
    const count = await this.prisma.otpVerification.count({
      where: {
        ...destination,
        purpose,
        createdAt: { gte: Instant.toDate(since) },
      },
    });

    return OtpCount.parse(count);
  }

  async deleteAllForUser(userId: UserId): Promise<OtpCount> {
    const result = await this.prisma.otpVerification.deleteMany({
      where: { userId },
    });

    return OtpCount.parse(result.count);
  }

  async deleteExpired(now: Instant): Promise<void> {
    await this.prisma.otpVerification.deleteMany({
      where: {
        expiresAt: { lt: Instant.toDate(now) },
      },
    });
  }

  private toDomain(record: RawOtpVerificationProps): OtpVerification {
    return OtpVerification.reconstitute(record);
  }
}
