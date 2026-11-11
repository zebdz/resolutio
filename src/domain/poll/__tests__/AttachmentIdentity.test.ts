/** Upload metadata owns its identity before persistence and never exposes mutable dates.
 * These contracts protect upload/link callers from database-generated replacement values. */
import { AttachmentFileName } from '@/domain/shared/attachments/AttachmentValues';
import { AttachmentByteCount } from '@/domain/shared/attachments/AttachmentValues';
import { expect, it } from 'vitest';
import { PollAttachment } from '../PollAttachment';
import { PollId, PollAttachmentId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { ReportAttachment } from '../../report/ReportAttachment';
import { PropertyClaimAttachment } from '../../organization/PropertyClaimAttachment';
import {
  ReportId,
  ReportAttachmentId,
  PropertyClaimId,
  PropertyClaimAttachmentId,
} from '../../shared/EntityIds';

it('creates attachment metadata with the supplied identity and instant', () => {
  const creation = testCreation(PollAttachmentId, 'attachment-1');
  const result = PollAttachment.create(
    {
      pollId: PollId.parse('poll-1'),
      fileName: AttachmentFileName.parse('document.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: AttachmentByteCount.parse(12),
    },
    creation
  );
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.id).toBe(creation.id);
  expect(result.value.createdAt?.toISOString()).toBe(creation.now);
});

it.each([NaN, Infinity, -1, 1.5])(
  'rejects impossible byte counts %s',
  (sizeBytes) => {
    expect(
      PollAttachment.create(
        {
          pollId: PollId.parse('poll-1'),
          fileName: AttachmentFileName.parse('document.pdf'),
          mimeType: 'application/pdf',
          // @ts-expect-error Exercise malformed caller input despite the validated-size contract.
          sizeBytes,
        },
        testCreation(PollAttachmentId, 'attachment-1')
      ).success
    ).toBe(false);
  }
);

it('validates persisted metadata and detaches creation time', () => {
  const raw = {
    id: 'attachment-1',
    pollId: 'poll-1',
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 12,
    createdAt: new Date('2026-01-01'),
  };
  expect(() => PollAttachment.reconstitute({ ...raw, id: '' })).toThrow();
  const attachment = PollAttachment.reconstitute(raw);
  raw.createdAt.setUTCFullYear(2000);
  attachment.createdAt?.setUTCFullYear(2001);
  expect(attachment.createdAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
});

it('assigns identities before storing report and claim attachments', () => {
  const report = ReportAttachment.create(
    {
      reportId: ReportId.parse('report-1'),
      fileName: AttachmentFileName.parse('x.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: AttachmentByteCount.parse(12),
    },
    testCreation(ReportAttachmentId, 'report-file-1')
  );
  const claim = PropertyClaimAttachment.create(
    {
      claimId: PropertyClaimId.parse('claim-1'),
      fileName: AttachmentFileName.parse('x.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: AttachmentByteCount.parse(12),
    },
    testCreation(PropertyClaimAttachmentId, 'claim-file-1')
  );
  expect(report.success && report.value.id).toBe('report-file-1');
  expect(claim.success && claim.value.id).toBe('claim-file-1');
});
