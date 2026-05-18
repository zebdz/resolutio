// Inline image URLs in report bodies look like:
//   ![alt](/api/report-attachments/<id>)
// or, less commonly, plain `<img src="/api/report-attachments/<id>">` HTML.
// Both share the same path prefix. Ids are cuid/cuid2-style: lowercase
// letters + digits. We also accept hex/uppercase to keep the extractor
// tolerant if the id scheme ever changes.

const ATTACHMENT_URL_PATTERN = /\/api\/report-attachments\/([A-Za-z0-9_-]+)/g;

export function extractReportAttachmentIdsFromBody(body: string): string[] {
  const seen = new Set<string>();

  for (const m of body.matchAll(ATTACHMENT_URL_PATTERN)) {
    seen.add(m[1]);
  }

  return [...seen];
}
