// Builds the markdown snippet inserted into the body when an upload
// succeeds.
//
// Only images get image syntax. Anything else — PDFs in particular — gets
// link syntax: emitting `![name](....pdf)` produces an <img> pointing at a
// PDF, which renders as a broken image.
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface AttachmentRefInput {
  fileName: string;
  mimeType: string;
  apiPrefix: string;
  id: string;
}

// A ']' or '[' in the file name would terminate the link label early and
// leave the remainder as stray text next to a broken link.
function escapeLabel(fileName: string): string {
  return fileName.replace(/([[\]])/g, '\\$1');
}

export function buildAttachmentRef(input: AttachmentRefInput): string {
  const url = `${input.apiPrefix}/${input.id}`;
  const label = escapeLabel(input.fileName);
  const marker = IMAGE_MIME_TYPES.has(input.mimeType) ? '!' : '';

  // Wrapped in blank lines so the ref becomes its own block rather than
  // joining the paragraph the caret happened to be in.
  return `\n\n${marker}[${label}](${url})\n`;
}
