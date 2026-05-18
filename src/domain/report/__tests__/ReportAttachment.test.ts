import { describe, it, expect } from 'vitest';
import {
  ReportAttachment,
  REPORT_ATTACHMENT_IMAGE_MAX_BYTES,
  REPORT_ATTACHMENT_PDF_MAX_BYTES,
} from '../ReportAttachment';
import { ReportDomainCodes } from '../ReportDomainCodes';

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF_HEADER = Buffer.from('%PDF-1.4');
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
]);
const OLE2_HEADER = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const XLS_MIME = 'application/vnd.ms-excel';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOC_MIME = 'application/msword';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('ReportAttachment', () => {
  it('accepts a valid PNG', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: Buffer.concat([PNG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid JPEG', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      bytes: Buffer.concat([JPEG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid WebP', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.webp',
      mimeType: 'image/webp',
      bytes: Buffer.concat([WEBP_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid PDF', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.concat([PDF_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid .xls (OLE2 magic)', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.xls',
      mimeType: XLS_MIME,
      bytes: Buffer.concat([OLE2_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid .xlsx (ZIP magic)', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.xlsx',
      mimeType: XLSX_MIME,
      bytes: Buffer.concat([ZIP_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid .doc (OLE2 magic)', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.doc',
      mimeType: DOC_MIME,
      bytes: Buffer.concat([OLE2_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid .docx (ZIP magic)', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.docx',
      mimeType: DOCX_MIME,
      bytes: Buffer.concat([ZIP_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(true);
  });

  it('rejects .xlsx declared with wrong bytes', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.xlsx',
      mimeType: XLSX_MIME,
      bytes: Buffer.concat([PDF_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_MAGIC_MISMATCH);
    }
  });

  it('rejects oversized .xlsx', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.xlsx',
      mimeType: XLSX_MIME,
      bytes: Buffer.concat([
        ZIP_HEADER,
        Buffer.alloc(REPORT_ATTACHMENT_PDF_MAX_BYTES + 1),
      ]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
    }
  });

  it('rejects oversized image', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: Buffer.concat([
        PNG_HEADER,
        Buffer.alloc(REPORT_ATTACHMENT_IMAGE_MAX_BYTES + 1),
      ]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
    }
  });

  it('rejects oversized PDF', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.concat([
        PDF_HEADER,
        Buffer.alloc(REPORT_ATTACHMENT_PDF_MAX_BYTES + 1),
      ]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_TOO_LARGE);
    }
  });

  it('rejects disallowed mime', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.gif',
      mimeType: 'image/gif',
      bytes: Buffer.from([0x47, 0x49, 0x46, 0x38]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        ReportDomainCodes.REPORT_ATTACHMENT_TYPE_NOT_ALLOWED
      );
    }
  });

  it('rejects magic-byte mismatch (PNG declared, JPEG bytes)', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: 'a.png',
      mimeType: 'image/png',
      bytes: Buffer.concat([JPEG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_MAGIC_MISMATCH);
    }
  });

  it('rejects empty filename', () => {
    const r = ReportAttachment.createWithBytes({
      reportId: 'r1',
      fileName: '   ',
      mimeType: 'image/png',
      bytes: Buffer.concat([PNG_HEADER, Buffer.alloc(10)]),
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(ReportDomainCodes.REPORT_ATTACHMENT_FILENAME_EMPTY);
    }
  });
});
