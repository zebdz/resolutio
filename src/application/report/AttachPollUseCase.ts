import { Result, failure } from '../../domain/shared/Result';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { ReportDomainCodes } from '../../domain/report/ReportDomainCodes';
import { ReportErrors } from './ReportErrors';
import { canPollSatisfyReportAudience } from './canPollSatisfyReportAudience';

export interface OrgRepoForAttachPoll {
  isUserAdmin(userId: string, orgId: string): Promise<boolean>;
}

export interface UserRepoForAttachPoll {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface PollRepoForAttachPoll {
  getPollById(
    pollId: string
  ): Promise<
    Result<{ organizationId: string; boardId: string | null } | null, string>
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
    private polls: PollRepoForAttachPoll
  ) {}

  async execute(input: AttachPollInput): Promise<Result<void, string>> {
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

    const pollLookup = await this.polls.getPollById(input.pollId);

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

    const domainResult = report.attachPoll(input.pollId);

    if (!domainResult.success) {
      return failure(domainResult.error);
    }

    return this.reports.update(report);
  }
}
