import { PollAttachment } from './PollAttachment';
import { Result } from '../shared/Result';

export interface PollAttachmentMetadata {
  id: string;
  pollId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface PollAttachmentBytes {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface PollAttachmentRepository {
  save(
    attachment: PollAttachment,
    bytes: Buffer
  ): Promise<Result<PollAttachmentMetadata, string>>;
  findByPollId(
    pollId: string
  ): Promise<Result<PollAttachmentMetadata[], string>>;
  findBytesById(
    id: string
  ): Promise<Result<PollAttachmentBytes | null, string>>;
  findById(id: string): Promise<Result<PollAttachmentMetadata | null, string>>;
  countByPollId(pollId: string): Promise<Result<number, string>>;
  deleteById(id: string): Promise<Result<void, string>>;
}
