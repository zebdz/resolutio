import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { defaultLocale, locales } from '@/src/i18n/locales';
import {
  prisma,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { ReportDetail } from '@/web/components/report/ReportDetail';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { GetReportForViewerUseCase } from '@/application/report/GetReportForViewerUseCase';
import { serializeReport } from '@/web/actions/report/serializeReport';
import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'https://resolutio.site';

const reportRepo = new PrismaReportRepository(prisma);
const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);

const visibilitySvc = new ResolveReportVisibilityService(
  orgRepo,
  boardRepo,
  userRepo
);

const getReportUC = new GetReportForViewerUseCase(
  reportRepo,
  visibilitySvc,
  attachmentRepo,
  pollRepo
);

interface AnonReportPageProps {
  params: Promise<{ id: string }>;
}

function resolveLocale(acceptLanguage: string | null) {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  for (const tag of acceptLanguage.split(',')) {
    const lang = tag.split(';')[0].trim().slice(0, 2).toLowerCase();

    if (locales.includes(lang as (typeof locales)[number])) {
      return lang as (typeof locales)[number];
    }
  }

  return defaultLocale;
}

export async function generateMetadata({
  params,
}: AnonReportPageProps): Promise<import('next').Metadata> {
  const { id } = await params;
  const result = await getReportUC.execute({ reportId: id, viewerId: null });

  if (!result.success) {
    return { title: 'Report' };
  }

  const { report, attachments } = result.value;

  // Only emit rich OG metadata for public-anon reports; other visibilities
  // shouldn't leak descriptions or images to unauthenticated scrapers.
  if (report.visibility !== 'PUBLIC_ANON') {
    return { title: report.title };
  }

  const description = stripMarkdownToPlainText(report.body).slice(0, 160);
  const firstImage = attachments.find((a) => a.mimeType.startsWith('image/'));
  const imageUrl = firstImage
    ? `${SITE_ORIGIN}/api/report-attachments/${firstImage.id}`
    : undefined;

  const headerStore = await headers();
  const locale = resolveLocale(headerStore.get('accept-language'));

  return {
    title: report.title,
    description,
    openGraph: {
      title: report.title,
      description,
      type: 'article',
      url: `${SITE_ORIGIN}/r/${id}`,
      locale,
      publishedTime: report.lastPublishedAt?.toISOString(),
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function AnonReportPage({ params }: AnonReportPageProps) {
  const headerStore = await headers();
  const locale = resolveLocale(headerStore.get('accept-language'));
  setRequestLocale(locale);

  const { id } = await params;

  const user = await getCurrentUser();
  const result = await getReportUC.execute({
    reportId: id,
    viewerId: user?.id ?? null,
  });

  if (!result.success) {
    notFound();
  }

  const { report, attachments, polls } = result.value;

  const authorUser = await userRepo.findById(report.createdById);
  const author = authorUser
    ? {
        firstName: authorUser.firstName,
        lastName: authorUser.lastName,
        middleName: authorUser.middleName ?? null,
      }
    : { firstName: '?', lastName: '?', middleName: null };

  const serialized = serializeReport(report);

  const serializedAttachments = attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  }));

  const serializedPolls = polls.map((p) => ({
    id: p.id,
    title: p.title,
    state: p.state,
    archivedAt: p.archivedAt?.toISOString() ?? null,
  }));

  const viewer = user
    ? {
        id: user.id,
        isAuthor: report.createdById === user.id,
        isAdmin: false,
        isSuperAdmin: false,
      }
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ReportDetail
        report={serialized}
        author={author}
        attachments={serializedAttachments}
        polls={serializedPolls}
        viewer={viewer}
      />
    </main>
  );
}
