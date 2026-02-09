import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinOrganizationInput } from './JoinOrganizationSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface JoinOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  prisma: PrismaClient;
}

export class JoinOrganizationUseCase {
  constructor(private deps: JoinOrganizationDependencies) {}

  async execute(
    input: JoinOrganizationInput,
    userId: string
  ): Promise<Result<void, string>> {
    const { organizationId } = input;

    // Check if organization exists
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check if user is already a member or has a pending request
    const existingMembership =
      await this.deps.prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

    if (existingMembership) {
      if (existingMembership.status === 'accepted') {
        return failure(OrganizationErrors.ALREADY_MEMBER);
      }

      if (existingMembership.status === 'pending') {
        return failure(OrganizationErrors.PENDING_REQUEST);
      }

      if (existingMembership.status === 'rejected') {
        return failure(OrganizationErrors.REJECTED_REQUEST);
      }
    }

    // Check hierarchy constraints - block if pending request anywhere in hierarchy
    const ancestorIds =
      await this.deps.organizationRepository.getAncestorIds(organizationId);
    const descendantIds =
      await this.deps.organizationRepository.getDescendantIds(organizationId);
    const hierarchyIds = [...ancestorIds, ...descendantIds];

    const pendingOrgs =
      await this.deps.organizationRepository.findPendingRequestsByUserId(
        userId
      );

    for (const pendingOrg of pendingOrgs) {
      if (hierarchyIds.includes(pendingOrg.id)) {
        return failure(OrganizationErrors.PENDING_HIERARCHY_REQUEST);
      }
    }

    // Create membership request with pending status
    await this.deps.prisma.organizationUser.create({
      data: {
        organizationId,
        userId,
        status: 'pending',
      },
    });

    return success(undefined);
  }
}
