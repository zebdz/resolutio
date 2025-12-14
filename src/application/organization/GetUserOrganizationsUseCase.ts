import { PrismaClient } from '@prisma/client';
import { Result, success } from '../../domain/shared/Result';
import { Organization } from '../../domain/organization/Organization';

export interface MemberOrganization {
  organization: Organization;
  joinedAt: Date;
}

export interface PendingOrganization {
  organization: Organization;
  requestedAt: Date;
}

export interface RejectedOrganization {
  organization: Organization;
  rejectedAt: Date;
  rejectionReason: string | null;
  rejectedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface GetUserOrganizationsResult {
  member: MemberOrganization[];
  pending: PendingOrganization[];
  rejected: RejectedOrganization[];
}

export interface GetUserOrganizationsDependencies {
  prisma: PrismaClient;
}

export class GetUserOrganizationsUseCase {
  constructor(private deps: GetUserOrganizationsDependencies) {}

  async execute(
    userId: string
  ): Promise<Result<GetUserOrganizationsResult, string>> {
    const memberships = await this.deps.prisma.organizationUser.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const member: MemberOrganization[] = [];
    const pending: PendingOrganization[] = [];
    const rejected: RejectedOrganization[] = [];

    for (const membership of memberships) {
      const org = Organization.reconstitute({
        id: membership.organization.id,
        name: membership.organization.name,
        description: membership.organization.description,
        parentId: membership.organization.parentId,
        createdById: membership.organization.createdById,
        createdAt: membership.organization.createdAt,
        archivedAt: membership.organization.archivedAt,
      });

      if (membership.status === 'accepted' && membership.acceptedAt) {
        member.push({
          organization: org,
          joinedAt: membership.acceptedAt,
        });
      } else if (membership.status === 'pending') {
        pending.push({
          organization: org,
          requestedAt: membership.createdAt,
        });
      } else if (
        membership.status === 'rejected' &&
        membership.rejectedAt &&
        membership.rejectedBy
      ) {
        rejected.push({
          organization: org,
          rejectedAt: membership.rejectedAt,
          rejectionReason: membership.rejectionReason,
          rejectedBy: {
            id: membership.rejectedBy.id,
            firstName: membership.rejectedBy.firstName,
            lastName: membership.rejectedBy.lastName,
          },
        });
      }
    }

    return success({
      member,
      pending,
      rejected,
    });
  }
}
