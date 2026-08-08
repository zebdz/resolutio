// Response headers for serving a stored attachment's bytes.
//
// Attachments are user-supplied files served from the application's own,
// cookie-bearing origin. Even though the upload path whitelists the MIME type
// and verifies magic bytes, the read path re-derives everything it can rather
// than trusting a stored value: a row written by a seed, a migration, or some
// future code path might not have gone through that validation.

// Types that may be handed to the browser as-is. Anything else is served as
// an opaque download. Note SVG is absent by design — it can carry script and
// would execute same-origin if rendered inline.
const INLINE_RENDERABLE = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Types allowed to keep their declared Content-Type. PDFs are included so the
// browser labels the download correctly, but they are never rendered inline.
const CONTENT_TYPE_ALLOWLIST = new Set([
  ...INLINE_RENDERABLE,
  'application/pdf',
]);

export interface AttachmentResponseInput {
  fileName: string;
  mimeType: string;
  /** True only for a live open poll, whose files any visitor may read. */
  publiclyReadable: boolean;
}

/**
 * RFC 5987 encoding: encodeURIComponent percent-encodes everything except
 * unreserved characters; single-quote and parens are escaped too, since they
 * are not safe inside the ext-value token.
 */
function encodeFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(
    /['()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

export function buildAttachmentResponseHeaders(
  input: AttachmentResponseInput
): Record<string, string> {
  const isInlineRenderable = INLINE_RENDERABLE.has(input.mimeType);

  // Images render inside the description, so they must be inline. Everything
  // else — PDFs included — is downloaded rather than rendered. Polls link to
  // PDFs rather than embedding them, so this costs no functionality, and it
  // removes the browser PDF viewer as a script-execution surface on a
  // cookie-bearing origin.
  const disposition = isInlineRenderable ? 'inline' : 'attachment';

  const contentType = CONTENT_TYPE_ALLOWLIST.has(input.mimeType)
    ? input.mimeType
    : 'application/octet-stream';

  return {
    'Content-Type': contentType,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeFileName(
      input.fileName
    )}`,
    // Stop the browser from second-guessing Content-Type and rendering a
    // polyglot file as markup.
    'X-Content-Type-Options': 'nosniff',
    // Neutralise anything script-bearing that survives the checks above:
    // no subresources may load and the response gets a unique opaque origin.
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': input.publiclyReadable
      ? 'public, max-age=300'
      : 'private, no-store',
  };
}
