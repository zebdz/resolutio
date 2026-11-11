/** Membership-authorized property projection validates caller identities before
 * returning only the fields members may see. */
import { OrganizationUseCaseFailure } from './OrganizationErrors';
import {
  OrganizationId,
  PropertyId,
  UserId,
} from '../../domain/shared/EntityIds';
import {
  PropertyName,
  PropertyAddress,
} from '../../domain/organization/PropertyValues';
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
  id: PropertyId;
  name: PropertyName;
  address: PropertyAddress | null;
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
  ): Promise<Result<SafePropertyView[], OrganizationUseCaseFailure>> {
    const userId = UserId.safeParse(input.userId);
    const organizationId = OrganizationId.safeParse(input.organizationId);

    if (!userId.success || !organizationId.success) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const [isMember, isAdmin, isSuper] = await Promise.all([
      this.deps.organizationRepository.isUserMember(
        userId.data,
        organizationId.data
      ),
      this.deps.organizationRepository.isUserAdmin(
        userId.data,
        organizationId.data
      ),
      this.deps.userRepository.isSuperAdmin(userId.data),
    ]);

    if (!(isMember || isAdmin || isSuper)) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const res = await this.deps.propertyRepository.findByOrganization(
      organizationId.data
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
