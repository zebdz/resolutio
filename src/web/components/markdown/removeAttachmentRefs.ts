// Strips every markdown ref pointing at one attachment.
//
// Needed when an author deletes an attached file: the description would
// otherwise keep a ref to an id that no longer exists, and saving would fail
// the domain's own-attachments check on something the author cannot see.

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function removeAttachmentRefs(
  text: string,
  apiPrefix: string,
  attachmentId: string
): string {
  // `!?` covers both image and link syntax. The trailing (?![A-Za-z0-9_-])
  // stops `abc123` from also matching `abc123extra`, which matters because
  // cuids can share a prefix.
  const pattern = new RegExp(
    `!?\\[[^\\]]*\\]\\(${escapeForRegex(apiPrefix)}/${escapeForRegex(
      attachmentId
    )}(?![A-Za-z0-9_-])[^)]*\\)`,
    'g'
  );

  return (
    text
      .replace(pattern, '')
      // The ref usually sat alone between blank lines; without this the gap
      // it leaves grows every time a file is removed.
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
  );
}
