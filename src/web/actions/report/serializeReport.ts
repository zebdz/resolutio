import { Report } from '@/domain/report/Report';

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

export function serializeReport(r: Report): SerializedReport {
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
