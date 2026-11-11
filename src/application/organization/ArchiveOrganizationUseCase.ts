/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { Clock, IdGenerator } from '../shared/EntityCreation';

import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { NotifyOrgArchivedUseCase } from '../notification/NotifyOrgArchivedUseCase';

export interface ArchiveOrganizationInput {
  organizationId: string;
  adminUserId: string;
}

export interface ArchiveOrganizationDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class ArchiveOrganizationUseCase {
  private ids: IdGenerator;
  private clock: Clock;
  private organizationRepository: OrganizationRepository;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: ArchiveOrganizationDependencies) {
    this.ids = dependencies.ids;
    this.clock = dependencies.clock;
    this.organizationRepository = dependencies.organizationRepository;
    this.notificationRepository = dependencies.notificationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(
    input: ArchiveOrganizationInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedAdminUserId = UserId.safeParse(input.adminUserId);

    if (!parsedAdminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      adminUserId: parsedAdminUserId.data,
    };

    const organization = await this.organizationRepository.findById(
      command.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Only superadmins can archive organizations
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      command.adminUserId
    );

    if (!isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const archiveResult = organization.archive(this.clock.now());

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    await this.organizationRepository.update(organization);

    // Notify members of org + descendants
    const notifyUseCase = new NotifyOrgArchivedUseCase({
      ids: this.ids,
      clock: this.clock,
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    });
    const delivery = await notifyUseCase.execute({
      organizationId: command.organizationId,
    });

    if (!delivery.success) {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }
}
