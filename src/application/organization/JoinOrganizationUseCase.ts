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

    // Check hierarchy constraints
    // Get all ancestors of this organization
    const ancestorIds =
      await this.deps.organizationRepository.getAncestorIds(organizationId);
    // Get all descendants of this organization
    const descendantIds =
      await this.deps.organizationRepository.getDescendantIds(organizationId);
    // All related organizations in the hierarchy
    const hierarchyIds = [organizationId, ...ancestorIds, ...descendantIds];

    // Check if user is a member of any organization in this hierarchy
    const userOrganizations =
      await this.deps.organizationRepository.findMembershipsByUserId(userId);

    for (const userOrg of userOrganizations) {
      if (hierarchyIds.includes(userOrg.id)) {
        return failure(OrganizationErrors.HIERARCHY_CONFLICT);
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
