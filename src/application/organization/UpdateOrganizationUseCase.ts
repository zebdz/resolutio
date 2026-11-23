/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import {
  parseOrganizationName,
  parseOrganizationDescription,
} from '../../domain/organization/OrganizationValues';

import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { OrganizationMembershipService } from './OrganizationMembershipService';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { NotifyMultiMembershipSettingChangedUseCase } from '../notification/NotifyMultiMembershipSettingChangedUseCase';
import { NotifyOrgNameChangedUseCase } from '../notification/NotifyOrgNameChangedUseCase';

export interface UpdateOrganizationInput {
  organizationId: string;
  userId: string;
  name: string;
  description: string;
  allowMultiTreeMembership?: boolean;
}

export interface UpdateOrganizationDependencies {
  clock: Clock;
  ids: IdGenerator;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
  profanityChecker: ProfanityChecker;
}

export class UpdateOrganizationUseCase {
  private clock: Clock;
  private ids: IdGenerator;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;
  private profanityChecker: ProfanityChecker;

  constructor(dependencies: UpdateOrganizationDependencies) {
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
    this.profanityChecker = dependencies.profanityChecker;
  }

  async execute(
    input: UpdateOrganizationInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedUserId = UserId.safeParse(input.userId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      userId: parsedUserId.data,
    };

    const organization = await this.organizationRepository.findById(
      command.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check authorization: org admin or superadmin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(command.userId);
    const isOrgAdmin = await this.organizationRepository.isUserAdmin(
      command.userId,
      command.organizationId
    );

    if (!isOrgAdmin && !isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const parsedDescription = parseOrganizationDescription(command.description);

    if (!parsedDescription.success) {
      return parsedDescription;
    }

    const oldName = organization.name;
    const nameChanged = command.name.trim() !== organization.name;

    // Validate only a name the admin actually typed. Names stored before the
    // current rules existed may no longer satisfy them, and re-checking one
    // that did not change would make those organizations uneditable — the
    // admin could not even fix the description.
    if (nameChanged) {
      const parsedName = parseOrganizationName(command.name);

      if (!parsedName.success) {
        return parsedName;
      }

      const existingOrg = await this.organizationRepository.findByName(
        parsedName.value
      );

      if (existingOrg && existingOrg.id !== organization.id) {
        return failure(OrganizationErrors.NAME_EXISTS);
      }

      const nameResult = organization.updateName(
        parsedName.value,
        this.profanityChecker
      );

      if (!nameResult.success) {
        return failure(nameResult.error);
      }
    }

    const descResult = organization.updateDescription(
      parsedDescription.value,
      this.profanityChecker
    );

    if (!descResult.success) {
      return failure(descResult.error);
    }

    await this.organizationRepository.update(organization);

    // Notify members if name changed (fire-and-forget)
    if (oldName !== organization.name) {
      new NotifyOrgNameChangedUseCase({
        ids: this.ids,
        clock: this.clock,
        organizationRepository: this.organizationRepository,
        notificationRepository: this.notificationRepository,
      })
        .execute({
          organizationId: command.organizationId,
          oldName,
          newName: organization.name,
        })
        .then((outcome) => {
          if (!outcome.success) {
            console.error(
              'Notification delivery failed (NotifyOrgNameChangedUseCase):',
              outcome.error
            );
          }
        })
        .catch((err) =>
          console.error('Failed to notify org name change:', err)
        );
    }

    // Handle allowMultiTreeMembership toggle (root orgs only)
    if (command.allowMultiTreeMembership !== undefined) {
      if (organization.parentId !== null) {
        return failure(OrganizationErrors.NOT_ROOT_ORG);
      }

      const currentValue = organization.allowMultiTreeMembership ?? false;
      const newValue = command.allowMultiTreeMembership;

      if (currentValue !== newValue) {
        if (!newValue) {
          const conflictingUsers =
            await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
              command.organizationId,
              this.organizationRepository
            );

          if (conflictingUsers.length > 0) {
            return failure(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICTS_EXIST);
          }
        }

        await this.organizationRepository.setAllowMultiTreeMembership(
          command.organizationId,
          newValue
        );

        // Notify all tree members (fire-and-forget)
        new NotifyMultiMembershipSettingChangedUseCase({
          ids: this.ids,
          clock: this.clock,
          organizationRepository: this.organizationRepository,
          notificationRepository: this.notificationRepository,
        })
          .execute({
            rootOrgId: command.organizationId,
            allowed: newValue,
          })
          .then((outcome) => {
            if (!outcome.success) {
              console.error(
                'Notification delivery failed (NotifyMultiMembershipSettingChangedUseCase):',
                outcome.error
              );
            }
          })
          .catch((err) =>
            console.error(
              'Failed to notify multi-membership setting change:',
              err
            )
          );
      }
    }

    return success(undefined);
  }
}
