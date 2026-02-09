import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { CancelJoinRequestInput } from './CancelJoinRequestSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface CancelJoinRequestDependencies {
  prisma: PrismaClient;
  organizationRepository: OrganizationRepository;
}

export class CancelJoinRequestUseCase {
  constructor(private deps: CancelJoinRequestDependencies) {}

  async execute(input: CancelJoinRequestInput): Promise<Result<void, string>> {
    const { organizationId, userId } = input;

    // Find the join request
    const request = await this.deps.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!request) {
      return failure(OrganizationErrors.REQUEST_NOT_FOUND);
    }

    if (request.status !== 'pending') {
      return failure(OrganizationErrors.NOT_PENDING);
    }

    // Delete the OrganizationUser row
    await this.deps.organizationRepository.removeUserFromOrganization(
      userId,
      organizationId
    );

    return success(undefined);
  }
}
