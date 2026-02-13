import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgJoinedParentDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyOrgJoinedParentUseCase {
  constructor(private deps: NotifyOrgJoinedParentDependencies) {}

  async execute(input: {
    childOrgId: string;
    parentOrgId: string;
  }): Promise<void> {
    const { childOrgId, parentOrgId } = input;

    const [childOrg, parentOrg] = await Promise.all([
      this.deps.organizationRepository.findById(childOrgId),
      this.deps.organizationRepository.findById(parentOrgId),
    ]);

    if (!childOrg || !parentOrg) {
      return;
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        childOrgId
      );

    if (memberUserIds.length === 0) {
      return;
    }

    const notifications = memberUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'org_joined_parent',
          title: 'notification.types.orgJoinedParent.title',
          body: 'notification.types.orgJoinedParent.body',
          data: {
            childOrgId,
            parentOrgId,
            childOrgName: childOrg.name,
            parentOrgName: parentOrg.name,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
