/** Resolve results in an authenticated HTTP request to keep private database and
 * session diagnostics outside React Flight. Every response is viewer-specific. */
import { resultsViewerAccess } from '@/web/lib/resultsViewerAccess';
import { PollId } from '@/domain/shared/EntityIds';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { readPollResults } from '@/web/lib/readPollResults';
import { resultsPageDetails } from '@/web/lib/resultsPageDetails';
import { getCurrentUser } from '@/web/lib/session';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

function denied(error: string, status: number, next?: string) {
  return Response.json({ error, next }, { status, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    const limited = await checkRateLimit();

    if (limited) {
      return denied('rateLimit.tooManyRequests', 429);
    }

    const user = await getCurrentUser();

    if (!user) {
      return denied('common.errors.unauthorized', 401, '/login');
    }

    const access = await resultsViewerAccess(user);

    if (!access.success) {
      return denied(access.error.code, access.error.status, access.error.next);
    }

    const id = PollId.safeParse((await params).pollId);

    if (!id.success) {
      return denied('poll.errors.pollNotFound', 404);
    }

    const result = await readPollResults(id.data, user.id);

    if (!result.success) {
      switch (result.error) {
        case PollDomainCodes.POLL_RESULTS_ADMIN_ONLY:
        case PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER:
          return denied(result.error, 403);
        case 'poll.errors.pollNotFound':
          return denied(result.error, 404);
        default:
          return denied(result.error, 500);
      }
    }

    const page = await resultsPageDetails(id.data, user, result.value);

    return page.success
      ? Response.json(page.value, { headers })
      : denied(page.error, 500);
  } catch (error) {
    console.error(
      'Results request failed',
      error instanceof Error ? error.name : 'unknown'
    );

    return denied('common.errors.unexpected', 500);
  }
}
