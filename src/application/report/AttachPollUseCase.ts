/** Decodes external report commands before authorization and domain behavior.
 * Identity/time dependencies keep persistence and lifecycle changes deterministic. */
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
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
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { PollState } from '../../domain/poll/PollState';
import { ReportErrors } from './ReportErrors';
import { canPollSatisfyReportAudience } from './canPollSatisfyReportAudience';

export interface OrgRepoForAttachPoll {
  isUserAdmin(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForAttachPoll {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface PollRepoForAttachPoll {
  getPollById(pollId: PollId): Promise<
    Result<
      {
        organizationId: OrganizationId;
        boardId: BoardId | null;
        state: PollState;
      } | null,
      PollWriteFailure
    >
  >;
}

export interface AttachPollInput {
  reportId: string;
  callerId: string;
  pollId: string;
}

export class AttachPollUseCase {
  constructor(
    private reports: ReportRepository,
    private orgs: OrgRepoForAttachPoll,
    private users: UserRepoForAttachPoll,
    private polls: PollRepoForAttachPoll,
    private clock: Clock
  ) {}

  async execute(
    input: AttachPollInput
  ): Promise<Result<void, ReportUseCaseFailure | PollWriteFailure>> {
    const decoded = z
      .object({ reportId: ReportId, callerId: UserId, pollId: PollId })
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

    const pollLookup = await this.polls.getPollById(command.pollId);

    if (!pollLookup.success) {
      return failure(pollLookup.error);
    }

    if (!pollLookup.value) {
      return failure(ReportDomainCodes.REPORT_POLL_NOT_FOUND);
    }

    const poll = pollLookup.value;

    if (!canPollSatisfyReportAudience(poll, report)) {
      return failure(ReportDomainCodes.REPORT_POLL_AUDIENCE_TOO_NARROW);
    }

    const domainResult = report.attachPoll(command.pollId, this.clock.now());

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return this.reports.update(report);
  }
}
