/** Compile-only report clients retain identities, attachment units and pagination meanings.
 * Verified by the complete source/test typecheck, without importing web I/O in domain unit tests. */
import type {
  createReportAction,
  getReportAction,
  listReportsAction,
} from '../report';
import type { SerializedReport } from '../serializeReport';
import { PollId } from '@/domain/shared/EntityIds';
import { PageSize } from '@/domain/shared/Pagination';

type Data<F extends (...args: never[]) => unknown> =
  Awaited<ReturnType<F>> extends infer Result
    ? Result extends { success: true; data: infer Value }
      ? Value
      : never
    : never;
// @ts-expect-error Serialized reports retain report identity.
const wrongReport: SerializedReport['id'] = PollId.parse('poll');
// @ts-expect-error Attached boards require their own validated identities.
const rawBoard: SerializedReport['boardIds'][number] = 'board';
// @ts-expect-error Created reports retain report identity.
const wrongCreatedReport: Data<typeof createReportAction>['reportId'] =
  PollId.parse('poll');
// @ts-expect-error Attachment sizes retain their byte unit.
const rawAttachmentSize: Data<
  typeof getReportAction
>['attachments'][number]['sizeBytes'] = -1;
// @ts-expect-error Related polls retain a closed lifecycle state.
const unknownPollState: Data<typeof getReportAction>['polls'][number]['state'] =
  'unknown';
// @ts-expect-error Requested page sizes cannot substitute for result counts.
const wrongCount: Data<typeof listReportsAction>['totalCount'] =
  PageSize.parse(10);
