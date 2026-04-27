import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface ListOrgPropertiesForMemberInput {
  userId: string;
  organizationId: string;
}

export interface SafePropertyView {
  id: string;
  name: string;
  address: string | null;
}

export interface ListOrgPropertiesForMemberDependencies {
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ListOrgPropertiesForMemberUseCase {
  constructor(private deps: ListOrgPropertiesForMemberDependencies) {}

  async execute(
    input: ListOrgPropertiesForMemberInput
  ): Promise<Result<SafePropertyView[], string>> {
    const [isMember, isAdmin, isSuper] = await Promise.all([
      this.deps.organizationRepository.isUserMember(
        input.userId,
        input.organizationId
      ),
      this.deps.organizationRepository.isUserAdmin(
        input.userId,
        input.organizationId
      ),
      this.deps.userRepository.isSuperAdmin(input.userId),
    ]);

    if (!(isMember || isAdmin || isSuper)) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const res = await this.deps.propertyRepository.findByOrganization(
      input.organizationId
    );

    if (!res.success) {
      return failure(res.error);
    }

    // Explicit projection — never leak sizeUnit/archivedAt/relations through the client boundary.
    return success(
      res.value.map((p) => ({ id: p.id, name: p.name, address: p.address }))
    );
  }
}
