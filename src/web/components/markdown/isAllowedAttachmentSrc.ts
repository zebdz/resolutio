// Only same-origin attachment routes may render as inline images.
//
// The prefix always starts with a single slash, which is what makes the
// `startsWith` check safe: a protocol-relative URL (`//evil.example/...`) or
// an absolute one (`https://evil.example/...`) cannot match it, even when the
// prefix appears later in the string. Requiring the trailing slash also stops
// `/api/poll-attachments-evil/x` from passing.
export function isAllowedAttachmentSrc(
  src: string,
  apiPrefix: string
): boolean {
  return src.startsWith(`${apiPrefix}/`);
}
