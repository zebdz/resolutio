import { ReportVisibility } from '@/domain/report/ReportVisibility';
import { PollState } from '@/domain/poll/PollState';

export interface PollShapeForAttach {
  organizationId: string;
  boardId: string | null;
  state: PollState;
}

export interface ReportShapeForAttach {
  visibility: ReportVisibility;
  organizationId: string;
  boardIds: string[];
}

/**
 * Client-side mirror of canPollSatisfyReportAudience.
 * Operates on plain shapes instead of Report domain object so it can run
 * in Client Components (domain classes cannot cross the server/client boundary).
 * Logic must stay in sync with the application-layer original.
 */
export function canAttachPollToReportShape(
  poll: PollShapeForAttach,
  report: ReportShapeForAttach
): boolean {
  if (poll.state !== PollState.FINISHED) {
    return false;
  }

  switch (report.visibility) {
    case ReportVisibility.PUBLIC_ANON:
    case ReportVisibility.PUBLIC_AUTH:
      return false;

    case ReportVisibility.WITHIN_ORG_ONLY:
      return (
        poll.organizationId === report.organizationId && poll.boardId === null
      );

    case ReportVisibility.WITHIN_ORG_ANCESTORS:
    case ReportVisibility.WITHIN_ORG_DESCENDANTS:
    case ReportVisibility.WITHIN_ORG_TREE:
      return false;

    case ReportVisibility.WITHIN_BOARDS:
      if (poll.organizationId !== report.organizationId) {
        return false;
      }

      return poll.boardId === null || report.boardIds.includes(poll.boardId);

    default:
      return false;
  }
}
