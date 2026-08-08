import { describe, it, expect } from 'vitest';
import { buildAttachmentResponseHeaders } from '../attachmentResponseHeaders';

describe('buildAttachmentResponseHeaders', () => {
  describe('content type', () => {
    it('passes through an allowlisted image type', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'a.png',
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      expect(h['Content-Type']).toBe('image/png');
    });

    // Defence in depth: the upload path whitelists the MIME type, but a row
    // written by a seed, a migration, or a future code path might not have
    // gone through it. The read path re-derives rather than trusting.
    it('forces octet-stream for a type outside the allowlist', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'evil.html',
        mimeType: 'text/html',
        publiclyReadable: false,
      });

      expect(h['Content-Type']).toBe('application/octet-stream');
    });

    it('forces octet-stream for SVG, which can carry script', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'evil.svg',
        mimeType: 'image/svg+xml',
        publiclyReadable: false,
      });

      expect(h['Content-Type']).toBe('application/octet-stream');
    });
  });

  describe('disposition', () => {
    it('serves images inline so they render in the description', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'photo.png',
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      expect(h['Content-Disposition']).toMatch(/^inline;/);
    });

    // A PDF rendered inline from a cookie-bearing origin is a script-execution
    // surface via the browser's PDF viewer. Polls link to PDFs rather than
    // embedding them, so forcing download costs nothing.
    it('forces download for PDFs', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'survey.pdf',
        mimeType: 'application/pdf',
        publiclyReadable: false,
      });

      expect(h['Content-Disposition']).toMatch(/^attachment;/);
    });

    it('forces download for anything unrecognised', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'weird.bin',
        mimeType: 'application/x-msdownload',
        publiclyReadable: false,
      });

      expect(h['Content-Disposition']).toMatch(/^attachment;/);
    });

    it('RFC 5987-encodes a non-ASCII file name', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'Протокол.png',
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      expect(h['Content-Disposition']).toContain("filename*=UTF-8''");
      expect(h['Content-Disposition']).toContain('%D0%9F');
    });

    it('escapes quotes and parens in the encoded file name', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: "a'b(c).png",
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      // The `UTF-8''` prefix is RFC 5987 syntax and legitimately contains
      // quotes, so only the encoded name after it must be free of them.
      const encodedName = h['Content-Disposition'].split("UTF-8''")[1];

      expect(encodedName).toBe('a%27b%28c%29.png');
      expect(encodedName).not.toMatch(/['()]/);
    });
  });

  describe('hardening headers', () => {
    it('always sets nosniff', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'a.png',
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      expect(h['X-Content-Type-Options']).toBe('nosniff');
    });

    it('always sandboxes the response', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'a.png',
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      expect(h['Content-Security-Policy']).toContain('sandbox');
      expect(h['Content-Security-Policy']).toContain("default-src 'none'");
    });
  });

  describe('caching', () => {
    it('allows shared caching only when publicly readable', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'a.png',
        mimeType: 'image/png',
        publiclyReadable: true,
      });

      expect(h['Cache-Control']).toBe('public, max-age=300');
    });

    it('forbids storing an access-controlled file', () => {
      const h = buildAttachmentResponseHeaders({
        fileName: 'a.png',
        mimeType: 'image/png',
        publiclyReadable: false,
      });

      expect(h['Cache-Control']).toBe('private, no-store');
    });
  });
});
