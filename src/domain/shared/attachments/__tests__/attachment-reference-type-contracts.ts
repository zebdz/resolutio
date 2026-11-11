/** Attachment reference owners bind each URL namespace to its validated identity type. */
import { PollAttachmentId, ReportAttachmentId } from '../../EntityIds';
import { validateAttachmentRefs } from '../validateAttachmentRefs';
const poll = PollAttachmentId.parse('file-1');
const report = ReportAttachmentId.parse('file-1');
const reportIdsForPoll = {
  apiPrefix: '/api/poll-attachments' as const,
  ownIds: [report],
};
const pollIdsForReport = {
  apiPrefix: '/api/report-attachments' as const,
  ownIds: [poll],
};
const rawIds = {
  apiPrefix: '/api/poll-attachments' as const,
  ownIds: ['file-1'],
};
// @ts-expect-error Report identities cannot authorize a poll attachment URL.
validateAttachmentRefs('', reportIdsForPoll, 'invalid');
// @ts-expect-error Poll identities cannot authorize a report attachment URL.
validateAttachmentRefs('', pollIdsForReport, 'invalid');
// @ts-expect-error Raw strings cannot authorize ownership of attachment references.
validateAttachmentRefs('', rawIds, 'invalid');

validateAttachmentRefs(
  '',
  { apiPrefix: '/api/poll-attachments', ownIds: [poll] },
  'invalid'
);
validateAttachmentRefs(
  '',
  { apiPrefix: '/api/report-attachments', ownIds: [report] },
  'invalid'
);
