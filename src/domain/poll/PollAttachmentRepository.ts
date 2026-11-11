/** Typed attachment persistence projections. Metadata never contains content bytes;
 * adapters validate stored scalar values before they cross the port. */
import { Instant } from '../shared/Instant';
import { PollAttachmentId, PollId } from '../shared/EntityIds';
import {
  AttachmentFileName,
  AttachmentByteCount,
  AttachmentCount,
} from '../shared/attachments/AttachmentValues';
import { PollAttachmentMimeType } from './PollAttachment';
import { PollAttachment } from './PollAttachment';
import { Result } from '../shared/Result';

export interface PollAttachmentMetadata {
  id: PollAttachmentId;
  pollId: PollId;
  fileName: AttachmentFileName;
  mimeType: PollAttachmentMimeType;
  sizeBytes: AttachmentByteCount;
  createdAt: Instant;
}

export interface PollAttachmentBytes {
  fileName: AttachmentFileName;
  mimeType: PollAttachmentMimeType;
  bytes: Buffer;
}

export interface PollAttachmentRepository {
  save(
    attachment: PollAttachment,
    bytes: Buffer
  ): Promise<Result<PollAttachmentMetadata, 'common.errors.unexpected'>>;
  findByPollId(
    pollId: PollId
  ): Promise<Result<PollAttachmentMetadata[], 'common.errors.unexpected'>>;
  findBytesById(
    id: PollAttachmentId
  ): Promise<Result<PollAttachmentBytes | null, 'common.errors.unexpected'>>;
  findById(
    id: PollAttachmentId
  ): Promise<Result<PollAttachmentMetadata | null, 'common.errors.unexpected'>>;
  countByPollId(
    pollId: PollId
  ): Promise<Result<AttachmentCount, 'common.errors.unexpected'>>;
  deleteById(
    id: PollAttachmentId
  ): Promise<Result<void, 'common.errors.unexpected'>>;
}
