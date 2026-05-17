import { Report } from '../../domain/report/Report';
import { ReportVisibility } from '../../domain/report/ReportVisibility';

export interface PollAudienceDescriptor {
  organizationId: string;
  boardId: string | null;
}

/**
 * Audience-superset rule: returns true only when the poll's audience is
 * guaranteed to be a subset of (or equal to) the report's audience.
 *
 * PUBLIC_ANON / PUBLIC_AUTH: always false — polls have no equivalent public
 * flag in v1, so we cannot guarantee coverage.
 *
 * WITHIN_ORG_ONLY: poll must belong to the same org AND be org-wide (no board
 * restriction), otherwise it covers a narrower slice than the report needs.
 *
 * WITHIN_ORG_ANCESTORS / WITHIN_ORG_DESCENDANTS / WITHIN_ORG_TREE: always
 * false in v1 — polls have no hierarchy-aware audience flag.
 *
 * WITHIN_BOARDS: poll must belong to the same org AND its boardId must be null
 * (org-wide, satisfies any board) or be one of the boards in the report.
 */
export function canPollSatisfyReportAudience(
  poll: PollAudienceDescriptor,
  report: Report
): boolean {
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
      // v1: no hierarchy-aware poll audience flag — cannot guarantee coverage.
      return false;

    case ReportVisibility.WITHIN_BOARDS:
      if (poll.organizationId !== report.organizationId) {
        return false;
      }

      // Org-wide poll covers every board, so it satisfies any WITHIN_BOARDS
      // report. Board-scoped poll satisfies only if its board is in the list.
      return poll.boardId === null || report.boardIds.includes(poll.boardId);

    default:
      return false;
  }
}
