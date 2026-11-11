/** Compile-only client contracts reject swapped references, unchecked values and missing time. */
import { Report, CreateReportInput } from '../Report';
import { ReportRepository, ReportSearchResult } from '../ReportRepository';
import { PageSize, ResultCount } from '../../shared/Pagination';
import { PollAttachment } from '../../poll/PollAttachment';
import { ReportAttachment } from '../ReportAttachment';
import { PropertyClaimAttachment } from '../../organization/PropertyClaimAttachment';
// @ts-expect-error Poll filenames must be validated before metadata creation.
const rawPollFileName: Parameters<typeof PollAttachment.create>[0]['fileName'] =
  'raw';
// @ts-expect-error Report filenames must be validated before metadata creation.
const rawReportFileName: Parameters<
  typeof ReportAttachment.create
>[0]['fileName'] = 'raw';
// @ts-expect-error Claim filenames must be validated before metadata creation.
const rawClaimFileName: Parameters<
  typeof PropertyClaimAttachment.create
>[0]['fileName'] = 'raw';
// @ts-expect-error Poll uploads accept only their context's allowed MIME types.
const wrongPollMime: Parameters<
  typeof PollAttachment.createWithBytes
>[0]['mimeType'] = 'application/zip';
// @ts-expect-error Report uploads accept only their context's allowed MIME types.
const wrongReportMime: Parameters<
  typeof ReportAttachment.createWithBytes
>[0]['mimeType'] = 'audio/mpeg';
// @ts-expect-error Claim uploads accept only their context's allowed MIME types.
const wrongClaimMime: Parameters<
  typeof PropertyClaimAttachment.createWithBytes
>[0]['mimeType'] = 'text/plain';
import { ReportTitle, ReportBody } from '../ReportValues';
import {
  ReportId,
  PollId,
  ReportAttachmentId,
  PollAttachmentId,
  UserId,
} from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import {
  AttachmentByteCount,
  AttachmentFileName,
} from '../../shared/attachments/AttachmentValues';
declare const report: Report;
declare const repository: ReportRepository;
declare const pollId: PollId;
declare const reportFile: ReportAttachmentId;
declare const userId: UserId;
declare const now: Instant;
// @ts-expect-error Report creation must retain the title's validated meaning.
const rawCreationTitle: CreateReportInput['title'] = 'Raw title';
// @ts-expect-error A report title cannot substitute for body content.
const wrongCreationBody: CreateReportInput['body'] = ReportTitle.parse('Title');
// @ts-expect-error Public title edits must require validated title content.
report.updateTitle('Unchecked', now);
// @ts-expect-error Body edits must not accept title content.
report.updateBody(ReportTitle.parse('Title'), now);
declare const search: ReportSearchResult;
const total: ResultCount = search.totalCount;
// @ts-expect-error A requested page size is not a validated search-result total.
const pageAsTotal: ReportSearchResult['totalCount'] = PageSize.parse(20);
// @ts-expect-error Reports and polls cannot identify one another.
repository.findById(pollId);
// @ts-expect-error IDs must be validated at the request boundary.
repository.findById('raw-report');
// @ts-expect-error Publishing requires an explicit immutable instant.
report.publish(userId, false);
// @ts-expect-error Poll evidence cannot substitute for report evidence.
const pollFile: PollAttachmentId = reportFile;
// @ts-expect-error Creation requires an identity/time input.
Report.create({
  title: ReportTitle.parse('Report'),
  body: ReportBody.parse('Body'),
  organizationId: report.organizationId,
  createdById: userId,
  visibility: 'PUBLIC_ANON',
  boardIds: [],
});
// @ts-expect-error A body is not a report title.
const title: ReportTitle = report.body;
// @ts-expect-error Free text must be validated before it becomes report body content.
const body: ReportBody = 'raw body';
// @ts-expect-error Byte counts are validated units.
const bytes: AttachmentByteCount = -1;
// @ts-expect-error Filenames require a nonblank validated value.
const fileName: AttachmentFileName = '';
PollAttachment.create(
  {
    // @ts-expect-error Report identities cannot own poll attachments.
    pollId: report.id,
    fileName: AttachmentFileName.parse('x.pdf'),
    mimeType: 'application/pdf',
    sizeBytes: AttachmentByteCount.parse(5),
  },
  { id: pollFile, now }
);
report.publish(userId, false, now);
// Application callers retain report error codes, query units and attachment identity.
import { CreateReportUseCase } from '../../../application/report/CreateReportUseCase';
import { UpdateReportUseCase } from '../../../application/report/UpdateReportUseCase';
import { PublishReportUseCase } from '../../../application/report/PublishReportUseCase';
import { ArchiveReportUseCase } from '../../../application/report/ArchiveReportUseCase';
import { DowngradeReportToDraftUseCase } from '../../../application/report/DowngradeReportToDraftUseCase';
import { SetReportVisibilityUseCase } from '../../../application/report/SetReportVisibilityUseCase';
import {
  AttachPollUseCase,
  PollRepoForAttachPoll,
} from '../../../application/report/AttachPollUseCase';
import { DetachPollUseCase } from '../../../application/report/DetachPollUseCase';
import {
  AddReportAttachmentUseCase,
  AddReportAttachmentOutput,
} from '../../../application/report/AddReportAttachmentUseCase';
import { RemoveReportAttachmentUseCase } from '../../../application/report/RemoveReportAttachmentUseCase';
import {
  GetReportForViewerUseCase,
  AttachmentRepoForGetReport,
  PollRepoForGetReport,
} from '../../../application/report/GetReportForViewerUseCase';
import {
  ListReportsForViewerUseCase,
  ListReportsForViewerResult,
} from '../../../application/report/ListReportsForViewerUseCase';
type ReportOperations =
  | CreateReportUseCase
  | UpdateReportUseCase
  | PublishReportUseCase
  | ArchiveReportUseCase
  | DowngradeReportToDraftUseCase
  | SetReportVisibilityUseCase
  | AttachPollUseCase
  | DetachPollUseCase
  | AddReportAttachmentUseCase
  | RemoveReportAttachmentUseCase
  | GetReportForViewerUseCase
  | ListReportsForViewerUseCase;
type FailureOf<T> = T extends { success: false; error: infer E } ? E : never;
type ApplicationFailure = FailureOf<
  Awaited<ReturnType<ReportOperations['execute']>>
>;
// @ts-expect-error Every report operation exposes known codes, never arbitrary messages.
const unknownReportFailure: ApplicationFailure = 'arbitrary failure';
type ReadFailure = FailureOf<
  Awaited<
    ReturnType<
      | PollRepoForAttachPoll['getPollById']
      | PollRepoForGetReport['getPollById']
      | AttachmentRepoForGetReport['findByReportId']
    >
  >
>;
// @ts-expect-error Narrow report read ports must preserve their repository failures.
const unknownReadFailure: ReadFailure = 'arbitrary failure';
// @ts-expect-error Uploaded attachment references cannot be report references.
const wrongAttachmentId: AddReportAttachmentOutput['id'] = report.id;
// @ts-expect-error A page size is not a report search total.
const wrongReportCount: ListReportsForViewerResult['totalCount'] =
  PageSize.parse(20);
// @ts-expect-error A page size is not a page number.
const wrongReportPage: ListReportsForViewerResult['page'] = PageSize.parse(20);
