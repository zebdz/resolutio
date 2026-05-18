import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import {
  ReportAttachment,
  REPORT_ATTACHMENT_COUNT_LIMIT,
} from '../../domain/report/ReportAttachment';
import { ReportAttachmentRepository } from '../../domain/report/ReportAttachmentRepository';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForAddAttachment {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForAddAttachment {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface AddReportAttachmentInput {
  reportId: string;
  callerId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface AddReportAttachmentOutput {
  id: string;
}

export class AddReportAttachmentUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForAddAttachment,
    private users: UserRepoForAddAttachment,
    private attachmentRepo: ReportAttachmentRepository
  ) {}

  async execute(
    input: AddReportAttachmentInput
  ): Promise<Result<AddReportAttachmentOutput, string>> {
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

    // Fail fast for published reports before any I/O or file validation.
    if (!report.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const countResult = await this.attachmentRepo.countByReportId(
      input.reportId
    );

    if (!countResult.success) {
      return failure(countResult.error);
    }

    if (countResult.value >= REPORT_ATTACHMENT_COUNT_LIMIT) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_LIMIT_REACHED);
    }

    const attachmentResult = ReportAttachment.createWithBytes({
      reportId: input.reportId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });

    if (!attachmentResult.success) {
      return failure(attachmentResult.error);
    }

    const saveResult = await this.attachmentRepo.save(
      attachmentResult.value,
      input.bytes
    );

    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    const savedId = saveResult.value.id;

    // We already verified isDraft() above, so attachAttachment cannot fail
    // with REPORT_CANNOT_EDIT_PUBLISHED. Propagate any unexpected error anyway.
    const domainResult = report.attachAttachment(savedId);

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    const updateResult = await this.reports.update(report);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return { success: true, value: { id: savedId } };
  }
}
