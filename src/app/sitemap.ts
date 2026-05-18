import { MetadataRoute } from 'next';
import { prisma, PrismaReportRepository } from '@/infrastructure/index';

export const dynamic = 'force-dynamic';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'https://resolutio.site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = new PrismaReportRepository(prisma);
  const r = await repo.listPublicAnonForSitemap();

  if (!r.success) {
    return [];
  }

  return r.value.map((entry) => ({
    url: `${SITE_ORIGIN}/r/${entry.id}`,
    lastModified: entry.lastPublishedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));
}
