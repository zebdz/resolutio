/** Deployment origin for absolute evidence links, report sharing and the sitemap. */
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL ?? 'https://resolutio.site'
).replace(/\/+$/, '');
