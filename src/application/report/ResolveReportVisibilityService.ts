import { Report } from '../../domain/report/Report';
import { ReportVisibility } from '../../domain/report/ReportVisibility';

export interface OrgRepoForVisibility {
  isUserExactMember(userId: string, orgId: string): Promise<boolean>;
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
  getAncestorIds(orgId: string): Promise<string[]>;
  getDescendantIds(orgId: string): Promise<string[]>;
  getFullTreeOrgIds(orgId: string): Promise<string[]>;
}

export interface BoardRepoForVisibility {
  isUserMember(userId: string, boardId: string): Promise<boolean>;
}

export interface UserRepoForVisibility {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export class ResolveReportVisibilityService {
  constructor(
    private orgs: OrgRepoForVisibility,
    private boards: BoardRepoForVisibility,
    private users: UserRepoForVisibility
  ) {}

  async canRead(report: Report, viewerId: string | null): Promise<boolean> {
    // Overrides (logged-in only): author, admin, superadmin always read.
    if (viewerId) {
      if (report.createdById === viewerId) {
        return true;
      }

      if (await this.users.isSuperAdmin(viewerId)) {
        return true;
      }

      if (await this.orgs.isUserAdmin(viewerId, report.organizationId)) {
        return true;
      }
    }

    // Archived → only overrides apply.
    if (report.isArchived()) {
      return false;
    }

    // Draft → only overrides apply.
    if (report.isDraft()) {
      return false;
    }

    // Published audience rules.
    switch (report.visibility) {
      case ReportVisibility.PUBLIC_ANON:
        return true;
      case ReportVisibility.PUBLIC_AUTH:
        return !!viewerId;
      case ReportVisibility.WITHIN_ORG_ONLY:
        return (
          !!viewerId &&
          (await this.orgs.isUserExactMember(viewerId, report.organizationId))
        );

      case ReportVisibility.WITHIN_ORG_ANCESTORS: {
        if (!viewerId) {
          return false;
        }

        if (
          await this.orgs.isUserExactMember(viewerId, report.organizationId)
        ) {
          return true;
        }

        const ancestors = await this.orgs.getAncestorIds(report.organizationId);

        for (const a of ancestors) {
          if (await this.orgs.isUserExactMember(viewerId, a)) {
            return true;
          }
        }

        return false;
      }

      case ReportVisibility.WITHIN_ORG_DESCENDANTS: {
        if (!viewerId) {
          return false;
        }

        if (
          await this.orgs.isUserExactMember(viewerId, report.organizationId)
        ) {
          return true;
        }

        const desc = await this.orgs.getDescendantIds(report.organizationId);

        for (const d of desc) {
          if (await this.orgs.isUserExactMember(viewerId, d)) {
            return true;
          }
        }

        return false;
      }

      case ReportVisibility.WITHIN_ORG_TREE: {
        if (!viewerId) {
          return false;
        }

        if (
          await this.orgs.isUserExactMember(viewerId, report.organizationId)
        ) {
          return true;
        }

        const tree = await this.orgs.getFullTreeOrgIds(report.organizationId);

        for (const o of tree) {
          if (await this.orgs.isUserExactMember(viewerId, o)) {
            return true;
          }
        }

        return false;
      }

      case ReportVisibility.WITHIN_BOARDS: {
        if (!viewerId) {
          return false;
        }

        for (const b of report.boardIds) {
          if (await this.boards.isUserMember(viewerId, b)) {
            return true;
          }
        }

        return false;
      }

      default:
        return false;
    }
  }
}
