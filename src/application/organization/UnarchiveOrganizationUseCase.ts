/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { NotifyOrgUnarchivedUseCase } from '../notification/NotifyOrgUnarchivedUseCase';

export interface UnarchiveOrganizationInput {
  organizationId: string;
  adminUserId: string;
}

export interface UnarchiveOrganizationDependencies {
  clock: Clock;
  ids: IdGenerator;
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class UnarchiveOrganizationUseCase {
  private clock: Clock;
  private ids: IdGenerator;
  private organizationRepository: OrganizationRepository;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: UnarchiveOrganizationDependencies) {
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
    this.organizationRepository = dependencies.organizationRepository;
    this.notificationRepository = dependencies.notificationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(
    input: UnarchiveOrganizationInput
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

    // Only superadmins can unarchive organizations
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      command.adminUserId
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
