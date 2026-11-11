/** Decodes external report commands before authorization and domain behavior.
 * Identity/time dependencies keep persistence and lifecycle changes deterministic. */
import { ReportUseCaseFailure } from './ReportErrors';
import { z } from 'zod';
import {
  ReportId,
  OrganizationId,
  UserId,
  BoardId,
  PollId,
  ReportAttachmentId,
} from '../../domain/shared/EntityIds';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import {
  ReportAttachment,
  parseReportAttachmentMetadata,
  REPORT_ATTACHMENT_COUNT_LIMIT,
} from '../../domain/report/ReportAttachment';
import { ReportAttachmentRepository } from '../../domain/report/ReportAttachmentRepository';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForAddAttachment {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForAddAttachment {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface AddReportAttachmentInput {
  reportId: string;
  callerId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface AddReportAttachmentOutput {
  id: ReportAttachmentId;
}

export class AddReportAttachmentUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForAddAttachment,
    private users: UserRepoForAddAttachment,
    private attachmentRepo: ReportAttachmentRepository,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    input: AddReportAttachmentInput
  ): Promise<Result<AddReportAttachmentOutput, ReportUseCaseFailure>> {
    const decoded = z
      .object({ reportId: ReportId, callerId: UserId })
      .safeParse(input);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...input, ...decoded.data };
    const lookup = await this.reports.findByIdWithRelations(command.reportId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(ReportErrors.REPORT_NOT_FOUND);
    }

    const report = lookup.value;

    const isAuthor = report.createdById === command.callerId;
    const isAdmin =
      !isAuthor &&
      (await this.orgs.isUserAdmin(command.callerId, report.organizationId));
    const isSuper =
      !isAuthor &&
      !isAdmin &&
      (await this.users.isSuperAdmin(command.callerId));

    if (!isAuthor && !isAdmin && !isSuper) {
      return failure(ReportErrors.NOT_AUTHOR_OR_ADMIN);
    }

    // Fail fast for published reports before any I/O or file validation.
    if (!report.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const countResult = await this.attachmentRepo.countByReportId(
      command.reportId
    );

    if (!countResult.success) {
      return failure(countResult.error);
    }

    if (countResult.value >= REPORT_ATTACHMENT_COUNT_LIMIT) {
      return failure(ReportDomainCodes.REPORT_ATTACHMENT_LIMIT_REACHED);
    }

    const metadata = parseReportAttachmentMetadata({
      fileName: command.fileName,
      mimeType: command.mimeType,
      sizeBytes: command.bytes.length,
    });

    if (!metadata.success) {
      return metadata;
    }

    const attachmentResult = ReportAttachment.createWithBytes(
      {
        reportId: command.reportId,
        fileName: metadata.value.fileName,
        mimeType: metadata.value.mimeType,
        bytes: command.bytes,
      },
      entityCreation(ReportAttachmentId, this.ids, this.clock)
    );

    if (!attachmentResult.success) {
      return failure(attachmentResult.error);
    }

    const saveResult = await this.attachmentRepo.save(
      attachmentResult.value,
      command.bytes
    );

    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    const savedId = saveResult.value.id;

    // We already verified isDraft() above, so attachAttachment cannot fail
    // with REPORT_CANNOT_EDIT_PUBLISHED. Propagate any unexpected error anyway.
    const domainResult = report.attachAttachment(savedId, this.clock.now());

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
