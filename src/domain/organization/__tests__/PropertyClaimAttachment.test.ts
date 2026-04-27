import { describe, it, expect } from 'vitest';
import {
  PropertyClaimAttachment,
  PROPERTY_CLAIM_ATTACHMENT_MAX_BYTES,
  PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES,
} from '../PropertyClaimAttachment';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

const tinyBytes = Buffer.from([1, 2, 3]);

// Real magic-number prefixes for each allowed type. Padded with zeros to
// satisfy length checks where needed; full content isn't required because
// the magic check only inspects the first ~12 bytes.
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEAD = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]), // file size placeholder
  Buffer.from('WEBP', 'ascii'),
]);
const PDF_HEAD = Buffer.from('%PDF-1.4', 'ascii');
const ZIP_HEAD = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);

const VALID_HEADS_BY_MIME: Record<string, Buffer> = {
  'image/png': PNG_HEAD,
  'image/jpeg': JPEG_HEAD,
  'image/webp': WEBP_HEAD,
  'application/pdf': PDF_HEAD,
  'application/zip': ZIP_HEAD,
};

describe('PropertyClaimAttachment', () => {
  describe('create — validation', () => {
    it('rejects when fileName is empty / whitespace', () => {
      const r = PropertyClaimAttachment.create({
        claimId: 'c-1',
        fileName: '   ',
        mimeType: 'application/pdf',
        sizeBytes: tinyBytes.length,
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_FILENAME_EMPTY
      );
    });

    it('rejects when sizeBytes exceeds 10 MB', () => {
      const r = PropertyClaimAttachment.create({
        claimId: 'c-1',
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        sizeBytes: PROPERTY_CLAIM_ATTACHMENT_MAX_BYTES + 1,
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TOO_LARGE
      );
    });

    it('rejects when mimeType is not in the allowed set', () => {
      const r = PropertyClaimAttachment.create({
        claimId: 'c-1',
        fileName: 'evil.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: tinyBytes.length,
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TYPE_NOT_ALLOWED
      );
    });

    it.each(PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES.map((m) => [m]))(
      'accepts allowed mime type %s',
      (mime: string) => {
        const r = PropertyClaimAttachment.create({
          claimId: 'c-1',
          fileName: `proof.bin`,
          mimeType: mime,
          sizeBytes: tinyBytes.length,
        });
        expect(r.success).toBe(true);
      }
    );

    it('explicitly includes application/zip in the allowed set', () => {
      // Sanity check the user's explicit requirement that .zip is allowed
      // (e.g., a folder of scanned documents zipped together).
      expect(PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES).toContain(
        'application/zip'
      );
    });

    it('explicitly excludes image/gif (intentionally dropped)', () => {
      expect(PROPERTY_CLAIM_ATTACHMENT_ALLOWED_MIME_TYPES).not.toContain(
        'image/gif'
      );
    });

    it('accepts a valid attachment and exposes its props', () => {
      const r = PropertyClaimAttachment.create({
        claimId: 'c-1',
        fileName: 'deed.pdf',
        mimeType: 'application/pdf',
        sizeBytes: tinyBytes.length,
      });
      expect(r.success).toBe(true);

      if (!r.success) {
        return;
      }

      expect(r.value.claimId).toBe('c-1');
      expect(r.value.fileName).toBe('deed.pdf');
      expect(r.value.mimeType).toBe('application/pdf');
      expect(r.value.sizeBytes).toBe(tinyBytes.length);
    });

    it('trims surrounding whitespace from fileName before validation', () => {
      const r = PropertyClaimAttachment.create({
        claimId: 'c-1',
        fileName: '  deed.pdf  ',
        mimeType: 'application/pdf',
        sizeBytes: tinyBytes.length,
      });
      expect(r.success).toBe(true);

      if (!r.success) {
        return;
      }

      expect(r.value.fileName).toBe('deed.pdf');
    });
  });

  describe('createWithBytes — magic-number gate', () => {
    it.each(
      Object.entries(VALID_HEADS_BY_MIME).map(([mime, head]) => [mime, head])
    )(
      'accepts a real %s file (magic matches)',
      (mime: string, head: Buffer) => {
        const r = PropertyClaimAttachment.createWithBytes({
          claimId: 'c-1',
          fileName: 'proof.bin',
          mimeType: mime,
          bytes: head,
        });
        expect(r.success).toBe(true);

        if (!r.success) {
          return;
        }

        expect(r.value.sizeBytes).toBe(head.length);
      }
    );

    it('rejects when bytes start with MZ but mime claims application/pdf (rename attack)', () => {
      // 'MZ' is the DOS executable signature. Trying to upload an .exe
      // renamed to .pdf must fail the magic check.
      const r = PropertyClaimAttachment.createWithBytes({
        claimId: 'c-1',
        fileName: 'fake.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_MAGIC_MISMATCH
      );
    });

    it('rejects when bytes are PNG-shaped but mime claims application/zip', () => {
      // Mismatch between declared type and actual content — even if the
      // declared type is on the whitelist, the bytes betray the truth.
      const r = PropertyClaimAttachment.createWithBytes({
        claimId: 'c-1',
        fileName: 'sneaky.zip',
        mimeType: 'application/zip',
        bytes: PNG_HEAD,
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_MAGIC_MISMATCH
      );
    });

    it('still rejects too-large files before checking magic', () => {
      const r = PropertyClaimAttachment.createWithBytes({
        claimId: 'c-1',
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.alloc(PROPERTY_CLAIM_ATTACHMENT_MAX_BYTES + 1),
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TOO_LARGE
      );
    });

    it('still rejects disallowed mime even if bytes happen to look like one', () => {
      // image/gif was explicitly removed; even with valid GIF bytes the
      // factory must reject because the type isn't on the whitelist.
      const r = PropertyClaimAttachment.createWithBytes({
        claimId: 'c-1',
        fileName: 'anim.gif',
        mimeType: 'image/gif',
        bytes: Buffer.from('GIF89a', 'ascii'),
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TYPE_NOT_ALLOWED
      );
    });
  });
});
