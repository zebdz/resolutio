import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyOrgArchivedUseCase } from '../notification/NotifyOrgArchivedUseCase';

export interface ArchiveOrganizationInput {
  organizationId: string;
  adminUserId: string;
}

export interface ArchiveOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class ArchiveOrganizationUseCase {
  private organizationRepository: OrganizationRepository;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: ArchiveOrganizationDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.notificationRepository = dependencies.notificationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(input: ArchiveOrganizationInput): Promise<Result<void, string>> {
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Only superadmins can archive organizations
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.adminUserId
    );

    if (!isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const archiveResult = organization.archive();

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    await this.organizationRepository.update(organization);

    // Notify members of org + descendants
    const notifyUseCase = new NotifyOrgArchivedUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    });
    await notifyUseCase.execute({ organizationId: input.organizationId });

    return success(undefined);
  }
}
