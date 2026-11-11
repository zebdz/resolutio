/** Inline attachment namespaces are bound to the identity type of their owner.
 * These paths describe stored rich-text references, independent of any HTTP framework. */
import type { PollAttachmentId, ReportAttachmentId } from '../EntityIds';

export const POLL_ATTACHMENT_API_PREFIX = '/api/poll-attachments';
export const REPORT_ATTACHMENT_API_PREFIX = '/api/report-attachments';
export type AttachmentReferencePrefix =
  | typeof POLL_ATTACHMENT_API_PREFIX
  | typeof REPORT_ATTACHMENT_API_PREFIX;
export type AttachmentReferenceScope =
  | {
      readonly apiPrefix: typeof POLL_ATTACHMENT_API_PREFIX;
      readonly ownIds: readonly PollAttachmentId[];
    }
  | {
      readonly apiPrefix: typeof REPORT_ATTACHMENT_API_PREFIX;
      readonly ownIds: readonly ReportAttachmentId[];
    };
