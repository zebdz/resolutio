export function isAllowedAttachmentSrc(src: string): boolean {
  return src.startsWith('/api/report-attachments/');
}
