export function slugifyOrgName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || 'org';
}
