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
import { ReportAttachmentRepository } from '../../domain/report/ReportAttachmentRepository';
import { ReportErrors } from './ReportErrors';

export interface OrgRepoForRemoveAttachment {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForRemoveAttachment {
  isSuperAdmin(userId: UserId): Promise<boolean>;
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
    private attachmentRepo: ReportAttachmentRepository,
    private clock: Clock
  ) {}

  async execute(
    input: RemoveReportAttachmentInput
  ): Promise<Result<void, ReportUseCaseFailure>> {
    const decoded = z
      .object({
        reportId: ReportId,
        callerId: UserId,
        attachmentId: ReportAttachmentId,
      })
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

    const attLookup = await this.attachmentRepo.findById(command.attachmentId);

    if (!attLookup.success) {
      return failure(attLookup.error);
    }

    if (!attLookup.value || attLookup.value.reportId !== command.reportId) {
      return failure(ReportErrors.ATTACHMENT_NOT_FOUND);
    }

    // Validate via the domain before any destructive I/O.
    const domainResult = report.detachAttachment(
      command.attachmentId,
      this.clock.now()
    );

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    const deleteResult = await this.attachmentRepo.deleteById(
      command.attachmentId
    );

    if (!deleteResult.success) {
      return failure(deleteResult.error);
    }

    return this.reports.update(report);
  }
}
