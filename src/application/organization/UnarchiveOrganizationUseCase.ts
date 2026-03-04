import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyOrgUnarchivedUseCase } from '../notification/NotifyOrgUnarchivedUseCase';

export interface UnarchiveOrganizationInput {
  organizationId: string;
  adminUserId: string;
}

export interface UnarchiveOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class UnarchiveOrganizationUseCase {
  private organizationRepository: OrganizationRepository;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: UnarchiveOrganizationDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.notificationRepository = dependencies.notificationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(
    input: UnarchiveOrganizationInput
  ): Promise<Result<void, string>> {
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Only superadmins can unarchive organizations
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.adminUserId
    );

    if (!isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const unarchiveResult = organization.unarchive();

    if (!unarchiveResult.success) {
      return failure(unarchiveResult.error);
    }

    await this.organizationRepository.update(organization);

    // Notify members of org + descendants
    const notifyUseCase = new NotifyOrgUnarchivedUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    });
    await notifyUseCase.execute({ organizationId: input.organizationId });

    return success(undefined);
  }
}
