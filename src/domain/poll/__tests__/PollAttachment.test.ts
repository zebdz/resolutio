import { AttachmentFileName } from '@/domain/shared/attachments/AttachmentValues';
import { AttachmentByteCount } from '@/domain/shared/attachments/AttachmentValues';
import { PollId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PollAttachmentId } from '@/domain/shared/EntityIds';
import { describe, it, expect } from 'vitest';
import {
  PollAttachment,
  POLL_ATTACHMENT_IMAGE_MAX_BYTES,
} from '../PollAttachment';
import { PollDomainCodes } from '../PollDomainCodes';

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEAD = Buffer.from('%PDF-1.7', 'ascii');
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe('PollAttachment.create', () => {
  it('rejects an empty file name', () => {
    const r = PollAttachment.create(
      {
        pollId: PollId.parse('p1'),
        // @ts-expect-error Deliberately malformed runtime filename.
        fileName: '   ',
        mimeType: 'image/png',
        sizeBytes: AttachmentByteCount.parse(100),
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_FILENAME_EMPTY
    );
  });

  it('rejects a MIME type outside the whitelist', () => {
    const r = PollAttachment.create(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('clip.mp3'),
        // @ts-expect-error Deliberately disallowed runtime MIME type.
        mimeType: 'audio/mpeg',
        sizeBytes: AttachmentByteCount.parse(100),
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED
    );
  });

  it('rejects Word documents, which reports allow but polls do not', () => {
    const r = PollAttachment.create(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('doc.docx'),
        // @ts-expect-error Deliberately disallowed runtime MIME type.
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: AttachmentByteCount.parse(100),
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED
    );
  });

  it('rejects an image over the image cap', () => {
    const r = PollAttachment.create(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('big.png'),
        mimeType: 'image/png',
        sizeBytes: AttachmentByteCount.parse(
          POLL_ATTACHMENT_IMAGE_MAX_BYTES + 1
        ),
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE
    );
  });

  it('accepts a valid image and trims the file name', () => {
    const r = PollAttachment.create(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('  photo.png  '),
        mimeType: 'image/png',
        sizeBytes: AttachmentByteCount.parse(1000),
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(true);
    expect(r.success === true && r.value.fileName).toBe('photo.png');
  });
});

describe('PollAttachment.createWithBytes', () => {
  it('accepts a PNG whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('photo.png'),
        mimeType: 'image/png',
        bytes: PNG_HEAD,
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(true);
  });

  it('accepts a JPEG whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('photo.jpg'),
        mimeType: 'image/jpeg',
        bytes: JPEG_HEAD,
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(true);
  });

  it('accepts a PDF whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('survey.pdf'),
        mimeType: 'application/pdf',
        bytes: PDF_HEAD,
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(true);
  });

  it('rejects an executable renamed and declared as a PDF', () => {
    const r = PollAttachment.createWithBytes(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('evil.pdf'),
        mimeType: 'application/pdf',
        bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_MAGIC_MISMATCH
    );
  });

  it('reports the size error before the magic error for an oversized file', () => {
    const oversized = Buffer.alloc(POLL_ATTACHMENT_IMAGE_MAX_BYTES + 1);
    const r = PollAttachment.createWithBytes(
      {
        pollId: PollId.parse('p1'),
        fileName: AttachmentFileName.parse('big.png'),
        mimeType: 'image/png',
        bytes: oversized,
      },
      testCreation(PollAttachmentId, 'att-1')
    );
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE
    );
  });
});
