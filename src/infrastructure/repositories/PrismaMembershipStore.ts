/** Maps typed membership transitions to the existing linking-table writes.
 * Partial updates retain historical fields; invitation acceptance remains an atomic upsert. */
import { PrismaClient } from '@/generated/prisma/client';
import { MembershipStore } from '../../application/organization/MembershipStore';
import {
  MembershipReference,
  MembershipRequestChange,
  MembershipStatus,
  MembershipDecision,
  MembershipAcceptance,
} from '../../domain/organization/MembershipPolicy';
import { Instant } from '../../domain/shared/Instant';
import { failure, success } from '../../domain/shared/Result';

export class PrismaMembershipStore implements MembershipStore {
  constructor(private readonly prisma: PrismaClient) {}

  async saveDecision(
    reference: MembershipReference,
    decision: MembershipDecision
  ): ReturnType<MembershipStore['saveDecision']> {
    try {
      const decoded = MembershipDecision.parse(decision);
      const data =
        decoded.status === 'accepted'
          ? {
              status: decoded.status,
              acceptedAt: Instant.toDate(decoded.acceptedAt),
              acceptedByUserId: decoded.acceptedByUserId,
            }
          : {
              status: decoded.status,
              rejectedAt: Instant.toDate(decoded.rejectedAt),
              rejectedByUserId: decoded.rejectedByUserId,
              rejectionReason: decoded.rejectionReason,
            };
      await this.prisma.organizationUser.update({
        where: { organizationId_userId: reference },
        data,
      });

      return success(undefined);
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async acceptInvitation(
    reference: MembershipReference,
    acceptance: MembershipAcceptance
  ): ReturnType<MembershipStore['acceptInvitation']> {
    try {
      const decoded = MembershipAcceptance.parse(acceptance);
      const acceptedAt = Instant.toDate(decoded.acceptedAt);
      const data = {
        status: decoded.status,
        acceptedAt,
        acceptedByUserId: decoded.acceptedByUserId,
      };
      // Existing pending/rejected memberships retain their original creation and history fields.
      await this.prisma.organizationUser.upsert({
        where: { organizationId_userId: reference },
        create: { ...reference, ...data, createdAt: acceptedAt },
        update: data,
      });

      return success(undefined);
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async findStatus(
    reference: MembershipReference
  ): ReturnType<MembershipStore['findStatus']> {
    try {
      const row = await this.prisma.organizationUser.findUnique({
        where: { organizationId_userId: reference },
        select: { status: true },
      });

      return success(row === null ? null : MembershipStatus.parse(row.status));
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async saveRequest(
    reference: MembershipReference,
    change: MembershipRequestChange
  ): ReturnType<MembershipStore['saveRequest']> {
    try {
      const decoded = MembershipRequestChange.parse(change);

      switch (decoded.kind) {
        case 'new':
          await this.prisma.organizationUser.create({
            data: {
              ...reference,
              status: decoded.status,
              createdAt: Instant.toDate(decoded.requestedAt),
              joinTokenId: decoded.joinTokenId,
            },
          });
          break;
        case 'renewed':
          // Re-request: reset rejection metadata without changing the original request time.
          await this.prisma.organizationUser.update({
            where: { organizationId_userId: reference },
            data: {
              status: decoded.status,
              rejectedAt: decoded.rejection,
              rejectedByUserId: decoded.rejection,
              rejectionReason: decoded.rejection,
              joinTokenId: decoded.joinTokenId,
            },
          });
          break;

        default: {
          const exhaustive: never = decoded;
          throw new Error(`Invalid request transition: ${exhaustive}`);
        }
      }

      return success(undefined);
    } catch {
      return failure('common.errors.unexpected');
    }
  }
}
