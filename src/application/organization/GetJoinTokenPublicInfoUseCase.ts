/** Join-link application boundary validates external values before invoking
 * domain behavior and typed authorization/persistence ports. */
import { OrganizationId } from '../../domain/shared/EntityIds';
import {
  MemberCount,
  OrganizationName,
  OrganizationDescription,
} from '../../domain/organization/OrganizationValues';

import { JoinTokenValue } from '../../domain/organization/JoinTokenValues';
import { OrganizationDirectory } from './OrganizationDirectory';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinTokenErrors, JoinTokenUseCaseFailure } from './JoinTokenErrors';
import { OrganizationErrors } from './OrganizationErrors';

export interface GetJoinTokenPublicInfoDependencies {
  joinTokenRepository: JoinTokenRepository;
  organizationRepository: OrganizationRepository;
  directory: Pick<OrganizationDirectory, 'countAcceptedMembers'>;
}

export interface JoinTokenPublicInfo {
  organizationId: OrganizationId;
  organizationName: OrganizationName;
  organizationDescription: OrganizationDescription;
  memberCount: MemberCount;
}

export class GetJoinTokenPublicInfoUseCase {
  constructor(private deps: GetJoinTokenPublicInfoDependencies) {}

  async execute(
    rawTokenValue: string
  ): Promise<Result<JoinTokenPublicInfo, JoinTokenUseCaseFailure>> {
    const parsedTokenValue = JoinTokenValue.safeParse(rawTokenValue);

    if (!parsedTokenValue.success) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    const tokenValue = parsedTokenValue.data;

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
    const count = await this.deps.directory.countAcceptedMembers(
      token.organizationId
    );

    if (!count.success) {
      return count;
    }

    return success({
      organizationId: org.id,
      organizationName: org.name,
      organizationDescription: org.description,
      memberCount: count.value,
    });
  }
}
