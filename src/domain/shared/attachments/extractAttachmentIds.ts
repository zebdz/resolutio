// Inline attachment URLs look like:
//   ![alt](/api/<kind>-attachments/<id>)   — images
//   [name](/api/<kind>-attachments/<id>)   — PDFs and other downloads
// Both share the same path prefix. Ids are cuid/cuid2-style: lowercase
// letters + digits. We also accept hex/uppercase/underscore/hyphen to keep
// the extractor tolerant if the id scheme ever changes.

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractAttachmentIds(
  text: string,
  apiPrefix: string
): string[] {
  const pattern = new RegExp(
    `${escapeForRegex(apiPrefix)}/([A-Za-z0-9_-]+)`,
    'g'
  );
  const seen = new Set<string>();

  for (const m of text.matchAll(pattern)) {
    seen.add(m[1]);
  }

  return [...seen];
}
