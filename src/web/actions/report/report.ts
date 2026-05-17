'use server';

import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaReportRepository,
  PrismaReportAttachmentRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaPollRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { reportCreateLimiter } from '@/infrastructure/rateLimit/registry';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';

import { CreateReportUseCase } from '@/application/report/CreateReportUseCase';
import { UpdateReportUseCase } from '@/application/report/UpdateReportUseCase';
import { SetReportVisibilityUseCase } from '@/application/report/SetReportVisibilityUseCase';
import { AttachPollUseCase } from '@/application/report/AttachPollUseCase';
import { DetachPollUseCase } from '@/application/report/DetachPollUseCase';
import { RemoveReportAttachmentUseCase } from '@/application/report/RemoveReportAttachmentUseCase';
import { PublishReportUseCase } from '@/application/report/PublishReportUseCase';
import { DowngradeReportToDraftUseCase } from '@/application/report/DowngradeReportToDraftUseCase';
import { ArchiveReportUseCase } from '@/application/report/ArchiveReportUseCase';
import { GetReportForViewerUseCase } from '@/application/report/GetReportForViewerUseCase';
import { ListReportsForViewerUseCase } from '@/application/report/ListReportsForViewerUseCase';
import { NotifyReportPublishedUseCase } from '@/application/report/NotifyReportPublishedUseCase';
import { ResolveReportVisibilityService } from '@/application/report/ResolveReportVisibilityService';
import { ReportVisibility } from '@/domain/report/ReportVisibility';
import { Report } from '@/domain/report/Report';

// ---------------------------------------------------------------------------
// Shared ActionResult discriminated union
// ---------------------------------------------------------------------------

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Serialization shape (safe to cross the Server→Client boundary)
// ---------------------------------------------------------------------------

export interface SerializedReport {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  body: string;
  visibility: string;
  state: string;
  publishedById: string | null;
  lastPublishedAt: string | null;
  notifyAudience: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  boardIds: string[];
  pollIds: string[];
  attachmentIds: string[];
}

// ---------------------------------------------------------------------------
// Module-level repository + use-case singletons
// ---------------------------------------------------------------------------

const reportRepo = new PrismaReportRepository(prisma);
const attachmentRepo = new PrismaReportAttachmentRepository(prisma);
const orgRepo = new PrismaOrganizationRepository(prisma);
const boardRepo = new PrismaBoardRepository(prisma);
const pollRepo = new PrismaPollRepository(prisma);
const userRepo = new PrismaUserRepository(prisma);
const notificationRepo = new PrismaNotificationRepository(prisma);
const profanity = LeoProfanityChecker.getInstance();

const visibilitySvc = new ResolveReportVisibilityService(
  orgRepo,
  boardRepo,
  userRepo
);

const notifyPublished = new NotifyReportPublishedUseCase({
  orgRepo,
  boardRepo,
  notificationRepository: notificationRepo,
});

const createReport = new CreateReportUseCase(
  reportRepo,
  orgRepo,
  boardRepo,
  profanity
);

const updateReport = new UpdateReportUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  profanity
);

const setReportVisibility = new SetReportVisibilityUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  boardRepo
);

// Actual ctor: (reports, orgs, users, polls)
const attachPoll = new AttachPollUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  pollRepo
);

// Actual ctor: (reports, orgs, users) — no pollRepo
const detachPoll = new DetachPollUseCase(reportRepo, orgRepo, userRepo);

// Actual ctor: (reports, orgs, users, attachmentRepo)
const removeAttachment = new RemoveReportAttachmentUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  attachmentRepo
);

const publishReport = new PublishReportUseCase(
  reportRepo,
  orgRepo,
  userRepo,
  notifyPublished
);

const downgradeReport = new DowngradeReportToDraftUseCase(
  reportRepo,
  orgRepo,
  userRepo
);

const archiveReport = new ArchiveReportUseCase(reportRepo, orgRepo, userRepo);

const getReport = new GetReportForViewerUseCase(
  reportRepo,
  visibilitySvc,
  attachmentRepo,
  pollRepo
);

const listReports = new ListReportsForViewerUseCase(
  reportRepo,
  orgRepo,
  boardRepo,
  userRepo
);

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireUser(): Promise<{ error: string } | { userId: string }> {
  const u = await getCurrentUser();

  if (!u) {
    const t = await getTranslations('common.errors');

    return { error: t('unauthorized') as string };
  }

  return { userId: u.id };
}

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

function serializeReport(r: Report): SerializedReport {
  return {
    id: r.id,
    organizationId: r.organizationId,
    createdById: r.createdById,
    title: r.title,
    body: r.body,
    visibility: r.visibility,
    state: r.state,
    publishedById: r.publishedById,
    lastPublishedAt: r.lastPublishedAt?.toISOString() ?? null,
    notifyAudience: r.notifyAudience,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    archivedAt: r.archivedAt?.toISOString() ?? null,
    boardIds: r.boardIds,
    pollIds: r.pollIds,
    attachmentIds: r.attachmentIds,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createReportAction(input: {
  organizationId: string;
  title: string;
  body: string;
  visibility: ReportVisibility;
  boardIds: string[];
}): Promise<ActionResult<{ reportId: string }>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  // Additional per-user daily cap on report creation
  const dailyLimit = reportCreateLimiter.check(`user:${auth.userId}`);

  if (!dailyLimit.allowed) {
    return {
      success: false,
      error: await translateErrorCode('report.errors.rateLimitedDaily'),
    };
  }

  const result = await createReport.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
    title: input.title,
    body: input.body,
    visibility: input.visibility,
    boardIds: input.boardIds,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: { reportId: result.value.id } };
}

export async function updateReportAction(input: {
  reportId: string;
  title: string;
  body: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await updateReport.execute({
    reportId: input.reportId,
    callerId: auth.userId,
    title: input.title,
    body: input.body,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function setReportVisibilityAction(input: {
  reportId: string;
  visibility: ReportVisibility;
  boardIds: string[];
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await setReportVisibility.execute({
    reportId: input.reportId,
    callerId: auth.userId,
    visibility: input.visibility,
    boardIds: input.boardIds,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function attachPollAction(input: {
  reportId: string;
  pollId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await attachPoll.execute({
    reportId: input.reportId,
    callerId: auth.userId,
    pollId: input.pollId,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function detachPollAction(input: {
  reportId: string;
  pollId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await detachPoll.execute({
    reportId: input.reportId,
    callerId: auth.userId,
    pollId: input.pollId,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function removeReportAttachmentAction(input: {
  reportId: string;
  attachmentId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await removeAttachment.execute({
    reportId: input.reportId,
    callerId: auth.userId,
    attachmentId: input.attachmentId,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function publishReportAction(input: {
  reportId: string;
  notifyAudience: boolean;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await publishReport.execute({
    reportId: input.reportId,
    callerId: auth.userId,
    notifyAudience: input.notifyAudience,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function downgradeReportToDraftAction(input: {
  reportId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await downgradeReport.execute({
    reportId: input.reportId,
    callerId: auth.userId,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function archiveReportAction(input: {
  reportId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await archiveReport.execute({
    reportId: input.reportId,
    callerId: auth.userId,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}

export async function getReportAction(input: { reportId: string }): Promise<
  ActionResult<{
    report: SerializedReport;
    attachments: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
    }>;
    polls: Array<{
      id: string;
      title: string;
      state: string;
      archivedAt: string | null;
    }>;
  }>
> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await getReport.execute({
    reportId: input.reportId,
    viewerId: auth.userId,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  const { report, attachments, polls } = result.value;

  return {
    success: true,
    data: {
      report: serializeReport(report),
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      polls: polls.map((p) => ({
        id: p.id,
        title: p.title,
        state: p.state,
        archivedAt: p.archivedAt?.toISOString() ?? null,
      })),
    },
  };
}

export async function listReportsAction(input: {
  organizationIds?: string[];
  page?: number;
  pageSize?: number;
}): Promise<
  ActionResult<{
    reports: SerializedReport[];
    totalCount: number;
    page: number;
    pageSize: number;
  }>
> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const result = await listReports.execute({
    viewerId: auth.userId,
    organizationIds: input.organizationIds,
    page: input.page,
    pageSize: input.pageSize,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return {
    success: true,
    data: {
      reports: result.value.reports.map(serializeReport),
      totalCount: result.value.totalCount,
      page: result.value.page,
      pageSize: result.value.pageSize,
    },
  };
}
