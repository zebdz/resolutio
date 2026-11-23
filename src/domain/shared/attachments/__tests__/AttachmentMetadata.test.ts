/** Raw upload metadata is decoded before typed attachment creation.
 * Each context retains its whitelist, filename normalization and failure precedence. */
import { expect, it } from 'vitest';
import { parsePollAttachmentMetadata } from '../../../poll/PollAttachment';
import { parseReportAttachmentMetadata } from '../../../report/ReportAttachment';
import { parsePropertyClaimAttachmentMetadata } from '../../../organization/PropertyClaimAttachment';
import { PollDomainCodes } from '../../../poll/PollDomainCodes';
import { ReportDomainCodes } from '../../../report/ReportDomainCodes';
import { OrganizationDomainCodes } from '../../../organization/OrganizationDomainCodes';
import { SharedDomainCodes } from '../../SharedDomainCodes';
import { failure, success } from '../../Result';

it.each([
  {
    name: 'poll',
    decode: parsePollAttachmentMetadata,
    empty: PollDomainCodes.POLL_ATTACHMENT_FILENAME_EMPTY,
    precedence: PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED,
  },
  {
    name: 'report',
    decode: parseReportAttachmentMetadata,
    empty: ReportDomainCodes.REPORT_ATTACHMENT_FILENAME_EMPTY,
    precedence: ReportDomainCodes.REPORT_ATTACHMENT_TYPE_NOT_ALLOWED,
  },
  {
    name: 'claim',
    decode: parsePropertyClaimAttachmentMetadata,
    empty: OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_FILENAME_EMPTY,
    precedence: OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TOO_LARGE,
  },
])(
  'decodes $name metadata with its established error order',
  ({ decode, empty, precedence }) => {
    expect(
      decode({
        fileName: ' proof.pdf ',
        mimeType: 'application/pdf',
        sizeBytes: 12,
      })
    ).toEqual(
      success({
        fileName: 'proof.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
      })
    );
    expect(
      decode({
        fileName: ' ',
        mimeType: 'unknown',
        sizeBytes: 11 * 1024 * 1024,
      })
    ).toEqual(failure(empty));
    expect(
      decode({
        fileName: 'proof.pdf',
        mimeType: 'unknown',
        sizeBytes: 11 * 1024 * 1024,
      })
    ).toEqual(failure(precedence));

    for (const sizeBytes of [-1, 0.5, NaN]) {
      expect(
        decode({
          fileName: 'proof.pdf',
          mimeType: 'application/pdf',
          sizeBytes,
        })
      ).toEqual(failure(SharedDomainCodes.INVALID_ATTACHMENT_METADATA));
    }
  }
);
