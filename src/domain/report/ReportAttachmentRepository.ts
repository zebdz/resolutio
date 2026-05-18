import { ReportAttachment } from './ReportAttachment';
import { Result } from '../shared/Result';

export interface ReportAttachmentMetadata {
  id: string;
  reportId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface ReportAttachmentBytes {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface ReportAttachmentRepository {
  save(
    attachment: ReportAttachment,
    bytes: Buffer
  ): Promise<Result<ReportAttachmentMetadata, string>>;
  findByReportId(
    reportId: string
  ): Promise<Result<ReportAttachmentMetadata[], string>>;
  findBytesById(
    id: string
  ): Promise<Result<ReportAttachmentBytes | null, string>>;
  findById(
    id: string
  ): Promise<Result<ReportAttachmentMetadata | null, string>>;
  countByReportId(reportId: string): Promise<Result<number, string>>;
  deleteById(id: string): Promise<Result<void, string>>;
}
