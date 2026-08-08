// Lightweight md → plaintext stripper, shared by reports and polls.
//
// Used wherever markdown source must be shown or examined as prose rather
// than rendered: profanity checking, list-card previews, PDF exports, and
// social-preview descriptions.
//
// NOT a full markdown parser; trades fidelity for zero deps + speed. It runs
// on every card in a list, so keep it cheap.
export function stripMarkdownToPlainText(md: string): string {
  let s = md;
  // Code fences (keep inner content but drop fences and language tag)
  s = s.replace(/```[\w-]*\n?/g, '');
  // Inline code
  s = s.replace(/`([^`]*)`/g, '$1');
  // Images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Bold/italic markers
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');
  // Headings, blockquotes, list markers at line start
  s = s.replace(/^[ \t]*(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)/gm, '');
  // Horizontal rules
  s = s.replace(/^[ \t]*([-*_]\s*){3,}[ \t]*$/gm, '');
  // Collapse whitespace
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}
