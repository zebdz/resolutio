import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinTokenErrors } from './JoinTokenErrors';
import { OrganizationErrors } from './OrganizationErrors';

export interface GetJoinTokenPublicInfoDependencies {
  joinTokenRepository: JoinTokenRepository;
  organizationRepository: OrganizationRepository;
  prisma: PrismaClient;
}

export interface JoinTokenPublicInfo {
  organizationId: string;
  organizationName: string;
  organizationDescription: string;
  memberCount: number;
}

export class GetJoinTokenPublicInfoUseCase {
  constructor(private deps: GetJoinTokenPublicInfoDependencies) {}

  async execute(
    tokenValue: string
  ): Promise<Result<JoinTokenPublicInfo, string>> {
    // 1. Find token by token value
    const token = await this.deps.joinTokenRepository.findByToken(tokenValue);

    if (!token) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    // 2. Check token can be used
    if (token.expiredAt !== null) {
      return failure(JoinTokenErrors.EXPIRED);
    }

    if (token.maxUses !== null && token.useCount >= token.maxUses) {
      return failure(JoinTokenErrors.EXHAUSTED);
    }

    // 3. Find org — check not archived
    const org = await this.deps.organizationRepository.findById(
      token.organizationId
    );

    if (!org || org.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // 4. Count accepted members
    const memberCount = await this.deps.prisma.organizationUser.count({
      where: {
        organizationId: token.organizationId,
        status: 'accepted',
      },
    });

    return success({
      organizationId: org.id,
      organizationName: org.name,
      organizationDescription: org.description,
      memberCount,
    });
  }
}
