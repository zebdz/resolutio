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
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: '   ',
      mimeType: 'image/png',
      sizeBytes: 100,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_FILENAME_EMPTY
    );
  });

  it('rejects a MIME type outside the whitelist', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: 'clip.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 100,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED
    );
  });

  it('rejects Word documents, which reports allow but polls do not', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: 'doc.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 100,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TYPE_NOT_ALLOWED
    );
  });

  it('rejects an image over the image cap', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: 'big.png',
      mimeType: 'image/png',
      sizeBytes: POLL_ATTACHMENT_IMAGE_MAX_BYTES + 1,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE
    );
  });

  it('accepts a valid image and trims the file name', () => {
    const r = PollAttachment.create({
      pollId: 'p1',
      fileName: '  photo.png  ',
      mimeType: 'image/png',
      sizeBytes: 1000,
    });
    expect(r.success).toBe(true);
    expect(r.success === true && r.value.fileName).toBe('photo.png');
  });
});

describe('PollAttachment.createWithBytes', () => {
  it('accepts a PNG whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'photo.png',
      mimeType: 'image/png',
      bytes: PNG_HEAD,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a JPEG whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      bytes: JPEG_HEAD,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a PDF whose magic bytes match', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'survey.pdf',
      mimeType: 'application/pdf',
      bytes: PDF_HEAD,
    });
    expect(r.success).toBe(true);
  });

  it('rejects an executable renamed and declared as a PDF', () => {
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'evil.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_MAGIC_MISMATCH
    );
  });

  it('reports the size error before the magic error for an oversized file', () => {
    const oversized = Buffer.alloc(POLL_ATTACHMENT_IMAGE_MAX_BYTES + 1);
    const r = PollAttachment.createWithBytes({
      pollId: 'p1',
      fileName: 'big.png',
      mimeType: 'image/png',
      bytes: oversized,
    });
    expect(r.success).toBe(false);
    expect(r.success === false && r.error).toBe(
      PollDomainCodes.POLL_ATTACHMENT_TOO_LARGE
    );
  });
});
