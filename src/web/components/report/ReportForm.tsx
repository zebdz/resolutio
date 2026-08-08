'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/src/i18n/routing';
import { toast } from 'sonner';
import { Button } from '@/web/components/catalyst/button';
import { Input } from '@/web/components/catalyst/input';
import {
  Field,
  FieldGroup,
  Label,
  Description,
} from '@/web/components/catalyst/fieldset';
import { ReportVisibility } from '@/domain/report/ReportVisibility';
import { PollState } from '@/domain/poll/PollState';
import {
  createReportAction,
  updateReportAction,
  setReportVisibilityAction,
  attachPollAction,
  detachPollAction,
  removeReportAttachmentAction,
} from '@/web/actions/report/report';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import {
  REPORT_ATTACHMENT_API_PREFIX,
  REPORT_BODY_MAX_LENGTH,
} from '@/domain/report/Report';
import { VisibilityPicker } from './VisibilityPicker';
import { PollPicker } from './PollPicker';
import { AttachmentUploader } from './AttachmentUploader';

interface OrgBoard {
  id: string;
  name: string;
}

interface OrgPoll {
  id: string;
  title: string;
  organizationId: string;
  boardId: string | null;
  archivedAt: string | null;
  state: PollState;
}

interface AttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface ReportFormProps {
  mode: 'create' | 'edit';
  organizationId: string;
  orgBoards: OrgBoard[];
  orgPolls: OrgPoll[];
  existingReport?: {
    id: string;
    title: string;
    body: string;
    visibility: ReportVisibility;
    boardIds: string[];
    pollIds: string[];
    attachments: AttachmentMeta[];
  };
}

export function ReportForm({
  mode,
  organizationId,
  orgBoards,
  orgPolls,
  existingReport,
}: ReportFormProps) {
  const t = useTranslations('report.form');
  const router = useRouter();

  const [title, setTitle] = useState(existingReport?.title ?? '');
  const [body, setBody] = useState(existingReport?.body ?? '');
  const [visibility, setVisibility] = useState<ReportVisibility>(
    existingReport?.visibility ?? ReportVisibility.WITHIN_ORG_ONLY
  );
  const [boardIds, setBoardIds] = useState<string[]>(
    existingReport?.boardIds ?? []
  );
  const [pollIds, setPollIds] = useState<string[]>(
    existingReport?.pollIds ?? []
  );
  const [attachments, setAttachments] = useState<AttachmentMeta[]>(
    existingReport?.attachments ?? []
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleUploadAttachment(
    file: File
  ): Promise<{ id: string } | { error: string }> {
    if (!existingReport) {
      return { error: 'No report yet' };
    }

    const form = new FormData();
    form.append('reportId', existingReport.id);
    form.append('file', file);
    const res = await fetch('/api/report-attachments', {
      method: 'POST',
      body: form,
    });

    if (res.ok) {
      const json = (await res.json()) as { id: string };
      setAttachments((prev) => [
        ...prev,
        {
          id: json.id,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      ]);

      return { id: json.id };
    }

    const body2 = (await res.json().catch(() => ({}))) as { error?: string };

    return { error: body2.error ?? String(res.status) };
  }

  async function handleRemoveAttachment(attachmentId: string) {
    if (!existingReport) {
      return;
    }

    const r = await removeReportAttachmentAction({
      reportId: existingReport.id,
      attachmentId,
    });

    if (!r.success) {
      toast.error(r.error);

      return;
    }

    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }

  async function handleCreate() {
    setSubmitting(true);
    const r = await createReportAction({
      organizationId,
      title,
      body,
      visibility,
      boardIds,
    });

    if (!r.success) {
      toast.error(r.error);
      setSubmitting(false);

      return;
    }

    const reportId = r.data.reportId;

    for (const pollId of pollIds) {
      const pr = await attachPollAction({ reportId, pollId });

      if (!pr.success) {
        toast.error(pr.error);
      }
    }

    toast.success(t('createdToast'));
    router.push(`/reports/${reportId}/edit`);
  }

  async function handleEdit() {
    if (!existingReport) {
      return;
    }

    const reportId = existingReport.id;
    setSubmitting(true);

    const u = await updateReportAction({ reportId, title, body });

    if (!u.success) {
      toast.error(u.error);
      setSubmitting(false);

      return;
    }

    const v = await setReportVisibilityAction({
      reportId,
      visibility,
      boardIds,
    });

    if (!v.success) {
      toast.error(v.error);
      setSubmitting(false);

      return;
    }

    const toAdd = pollIds.filter((id) => !existingReport.pollIds.includes(id));
    const toRemove = existingReport.pollIds.filter(
      (id) => !pollIds.includes(id)
    );

    for (const pollId of toAdd) {
      const pr = await attachPollAction({ reportId, pollId });

      if (!pr.success) {
        toast.error(pr.error);
      }
    }

    for (const pollId of toRemove) {
      const pr = await detachPollAction({ reportId, pollId });

      if (!pr.success) {
        toast.error(pr.error);
      }
    }

    toast.success(t('savedToast'));
    setSubmitting(false);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === 'create') {
      await handleCreate();
    } else {
      await handleEdit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <FieldGroup>
        <Field>
          <Label>{t('titleLabel')}</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={t('titlePlaceholder')}
            required
            disabled={submitting}
          />
        </Field>

        <Field>
          <Label>{t('bodyLabel')}</Label>
          <div className="mt-3">
            <MarkdownEditor
              value={body}
              onChange={setBody}
              apiPrefix={REPORT_ATTACHMENT_API_PREFIX}
              maxLength={REPORT_BODY_MAX_LENGTH}
              onUploadAttachment={
                mode === 'edit' ? handleUploadAttachment : undefined
              }
            />
          </div>
          <Description>
            {mode === 'edit' ? t('bodyHint') : t('bodyCreateHint')}
          </Description>
        </Field>

        <Field>
          <VisibilityPicker
            value={visibility}
            onChange={setVisibility}
            orgBoards={orgBoards}
            selectedBoardIds={boardIds}
            onBoardsChange={setBoardIds}
          />
        </Field>

        <Field>
          <PollPicker
            polls={orgPolls}
            reportShape={{ visibility, organizationId, boardIds }}
            selected={pollIds}
            onChange={setPollIds}
          />
        </Field>

        {mode === 'edit' && existingReport && (
          <Field>
            <Label>{t('attachmentsLabel')}</Label>
            <div className="mt-3 space-y-3">
              {attachments.length > 0 && (
                <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {attachments.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                        {att.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        disabled={submitting}
                        className="ml-4 cursor-pointer text-sm text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {t('attachmentsRemove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <AttachmentUploader
                reportId={existingReport.id}
                onUploaded={(a) => setAttachments((prev) => [...prev, a])}
              />
            </div>
          </Field>
        )}
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          color="brand-green"
          disabled={submitting}
          className="disabled:cursor-not-allowed"
        >
          {submitting
            ? t('submitting')
            : mode === 'create'
              ? t('createSubmit')
              : t('saveSubmit')}
        </Button>
        <Button
          type="button"
          outline
          disabled={submitting}
          onClick={() => router.back()}
          className="cursor-pointer disabled:cursor-not-allowed"
        >
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
