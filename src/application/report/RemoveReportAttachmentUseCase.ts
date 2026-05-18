import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportAttachmentRepository } from '../../domain/report/ReportAttachmentRepository';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForRemoveAttachment {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForRemoveAttachment {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface RemoveReportAttachmentInput {
  reportId: string;
  callerId: string;
  attachmentId: string;
}

export class RemoveReportAttachmentUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForRemoveAttachment,
    private users: UserRepoForRemoveAttachment,
    private attachmentRepo: ReportAttachmentRepository
  ) {}

  async execute(
    input: RemoveReportAttachmentInput
  ): Promise<Result<void, string>> {
    const lookup = await this.reports.findByIdWithRelations(input.reportId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = lookup.value;

    const isAuthor = report.createdById === input.callerId;
    const isAdmin =
      !isAuthor &&
      (await this.orgs.isUserAdmin(input.callerId, report.organizationId));
    const isSuper =
      !isAuthor && !isAdmin && (await this.users.isSuperAdmin(input.callerId));

    if (!isAuthor && !isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }

    const attLookup = await this.attachmentRepo.findById(input.attachmentId);

    if (!attLookup.success) {
      return failure(attLookup.error);
    }

    if (!attLookup.value || attLookup.value.reportId !== input.reportId) {
      return failure(ReportErrors.ATTACHMENT_NOT_FOUND);
    }

    // Validate via the domain before any destructive I/O.
    const domainResult = report.detachAttachment(input.attachmentId);

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    const deleteResult = await this.attachmentRepo.deleteById(
      input.attachmentId
    );

    if (!deleteResult.success) {
      return failure(deleteResult.error);
    }

    return this.reports.update(report);
  }
}
