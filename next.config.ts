import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { getGitVersion, getBuildId } from './build/version-helper';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const appVersion = getGitVersion();
const buildIdValue = getBuildId();

const nextConfig: NextConfig = {
  // Log route dependency tracing walks the project root. Legacy inputs are operator-only files.
  outputFileTracingExcludes: {
    '/*': [
      './u1037625_decision_community.sql',
      './storage.2026-11-22_*.zip',
      './.berezka-private/**/*',
    ],
  },
  /* config options here */
  // Uncomment only if can't configure nginx to serve _next/static properly:
  // Ensure static files are served correctly
  // assetPrefix: process.env.NODE_ENV === 'production' ? '' : undefined,
  // Disable static optimization to ensure all files go through the server
  // This helps when nginx isn't configured to serve _next/static properly
  // generateEtags: true,
  // compress: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_ID: buildIdValue,
  },
  experimental: {
    serverActions: {
      // Property-claim proof attachments cap at 10 MB (see
      // PropertyClaimAttachment). Headroom (12mb) covers FormData boundary
      // overhead + the JSON fields posted alongside the file.
      bodySizeLimit: '12mb',
    },
  },
};

export default withNextIntl(nextConfig);
