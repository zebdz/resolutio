import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { OrganizationMembershipService } from '../../domain/organization/OrganizationMembershipService';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
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
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
  profanityChecker: ProfanityChecker;
}

export class UpdateOrganizationUseCase {
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;
  private profanityChecker: ProfanityChecker;

  constructor(dependencies: UpdateOrganizationDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
    this.profanityChecker = dependencies.profanityChecker;
  }

  async execute(input: UpdateOrganizationInput): Promise<Result<void, string>> {
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check authorization: org admin or superadmin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(input.userId);
    const isOrgAdmin = await this.organizationRepository.isUserAdmin(
      input.userId,
      input.organizationId
    );

    if (!isOrgAdmin && !isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Check name uniqueness only if name changed
    if (input.name.trim() !== organization.name) {
      const existingOrg = await this.organizationRepository.findByName(
        input.name.trim()
      );

      if (existingOrg && existingOrg.id !== organization.id) {
        return failure(OrganizationErrors.NAME_EXISTS);
      }
    }

    const oldName = organization.name;

    const nameResult = organization.updateName(
      input.name,
      this.profanityChecker
    );

    if (!nameResult.success) {
      return failure(nameResult.error);
    }

    const descResult = organization.updateDescription(
      input.description,
      this.profanityChecker
    );

    if (!descResult.success) {
      return failure(descResult.error);
    }

    await this.organizationRepository.update(organization);

    // Notify members if name changed (fire-and-forget)
    if (oldName !== organization.name) {
      new NotifyOrgNameChangedUseCase({
        organizationRepository: this.organizationRepository,
        notificationRepository: this.notificationRepository,
      })
        .execute({
          organizationId: input.organizationId,
          oldName,
          newName: organization.name,
        })
        .catch((err) =>
          console.error('Failed to notify org name change:', err)
        );
    }

    // Handle allowMultiTreeMembership toggle (root orgs only)
    if (input.allowMultiTreeMembership !== undefined) {
      if (organization.parentId !== null) {
        return failure(OrganizationErrors.NOT_ROOT_ORG);
      }

      const currentValue = organization.allowMultiTreeMembership ?? false;
      const newValue = input.allowMultiTreeMembership;

      if (currentValue !== newValue) {
        if (!newValue) {
          const conflictingUsers =
            await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
              input.organizationId,
              this.organizationRepository
            );

          if (conflictingUsers.length > 0) {
            return failure(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICTS_EXIST);
          }
        }

        await this.organizationRepository.setAllowMultiTreeMembership(
          input.organizationId,
          newValue
        );

        // Notify all tree members (fire-and-forget)
        new NotifyMultiMembershipSettingChangedUseCase({
          organizationRepository: this.organizationRepository,
          notificationRepository: this.notificationRepository,
        })
          .execute({
            rootOrgId: input.organizationId,
            allowed: newValue,
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
