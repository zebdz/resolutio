/** Typed attachment persistence projections. Metadata never contains content bytes;
 * adapters validate stored scalar values before they cross the port. */
import { Instant } from '../shared/Instant';
import { ReportAttachmentId, ReportId } from '../shared/EntityIds';
import {
  AttachmentFileName,
  AttachmentByteCount,
  AttachmentCount,
} from '../shared/attachments/AttachmentValues';
import { ReportAttachmentMimeType } from './ReportAttachment';
import { ReportAttachment } from './ReportAttachment';
import { Result } from '../shared/Result';

export interface ReportAttachmentMetadata {
  id: ReportAttachmentId;
  reportId: ReportId;
  fileName: AttachmentFileName;
  mimeType: ReportAttachmentMimeType;
  sizeBytes: AttachmentByteCount;
  createdAt: Instant;
}

export interface ReportAttachmentBytes {
  fileName: AttachmentFileName;
  mimeType: ReportAttachmentMimeType;
  bytes: Buffer;
}

export interface ReportAttachmentRepository {
  save(
    attachment: ReportAttachment,
    bytes: Buffer
  ): Promise<Result<ReportAttachmentMetadata, 'common.errors.unexpected'>>;
  findByReportId(
    reportId: ReportId
  ): Promise<Result<ReportAttachmentMetadata[], 'common.errors.unexpected'>>;
  findBytesById(
    id: ReportAttachmentId
  ): Promise<Result<ReportAttachmentBytes | null, 'common.errors.unexpected'>>;
  findById(
    id: ReportAttachmentId
  ): Promise<
    Result<ReportAttachmentMetadata | null, 'common.errors.unexpected'>
  >;
  countByReportId(
    reportId: ReportId
  ): Promise<Result<AttachmentCount, 'common.errors.unexpected'>>;
  deleteById(
    id: ReportAttachmentId
  ): Promise<Result<void, 'common.errors.unexpected'>>;
}
