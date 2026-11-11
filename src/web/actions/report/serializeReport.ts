/** Explicit report transport mapping. Domain behavior and private references stay server-side. */
import type { Report } from '@/domain/report/Report';
import type { GetReportForViewerResult } from '@/application/report/GetReportForViewerUseCase';
import type { ListReportsForViewerResult } from '@/application/report/ListReportsForViewerUseCase';

export function serializeReport(r: Report) {
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

export type SerializedReport = ReturnType<typeof serializeReport>;

/** Explicit nested metadata mapping excludes attachment bytes and aggregate methods. */
export function serializeReportDetails({
  report,
  attachments,
  polls,
}: GetReportForViewerResult) {
  return {
    report: serializeReport(report),
    attachments: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt,
    })),
    polls: polls.map((p) => ({
      id: p.id,
      title: p.title,
      state: p.state,
      archivedAt: p.archivedAt?.toISOString() ?? null,
    })),
  };
}

export type SerializedReportDetails = ReturnType<typeof serializeReportDetails>;
export type SerializedReportList = Omit<
  ListReportsForViewerResult,
  'reports'
> & {
  reports: SerializedReport[];
};
