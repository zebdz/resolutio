import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /* config options here */
  // Uncomment only if can't configure nginx to serve _next/static properly:
  // Ensure static files are served correctly
  // assetPrefix: process.env.NODE_ENV === 'production' ? '' : undefined,
  // Disable static optimization to ensure all files go through the server
  // This helps when nginx isn't configured to serve _next/static properly
  // generateEtags: true,
  // compress: true,
};

export default withNextIntl(nextConfig);
