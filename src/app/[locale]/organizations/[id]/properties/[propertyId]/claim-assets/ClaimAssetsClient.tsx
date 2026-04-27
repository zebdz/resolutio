'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import { ErrorBanner } from '@/src/web/components/shared/ErrorBanner';
import { submitPropertyClaimAction } from '@/src/web/actions/organization/propertyClaim';

const ALLOWED_PROOF_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/zip',
];
const ALLOWED_PROOF_ACCEPT = ALLOWED_PROOF_MIME_TYPES.join(',');
const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export function ClaimAssetsClient({
  organizationId,
  assets,
}: {
  organizationId: string;
  assets: { id: string; name: string }[];
}) {
  const t = useTranslations('propertyClaim.page');
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [proofErr, setProofErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(
    () =>
      assets.filter((a) =>
        a.name.toLowerCase().includes(q.trim().toLowerCase())
      ),
    [assets, q]
  );

  function pickProof(file: File | null) {
    setProofErr(null);

    if (!file) {
      setProof(null);

      return;
    }

    if (file.size > MAX_PROOF_BYTES) {
      setProofErr(t('proof.tooLarge'));
      setProof(null);

      return;
    }

    if (!ALLOWED_PROOF_MIME_TYPES.includes(file.type)) {
      setProofErr(t('proof.typeNotAllowed'));
      setProof(null);

      return;
    }

    setProof(file);
  }

  function resetDialog() {
    setConfirming(null);
    setProof(null);
    setProofErr(null);

    // Deliberately do NOT clear `err` here — server-side rejections
    // (cooldown, already-pending) should remain visible after the user
    // closes the dialog, so they understand why submission was refused.
    // `err` is reset when the next submit attempt begins.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function submit(assetId: string) {
    setErr(null);

    if (proofErr) {
      return;
    }

    startTransition(async () => {
      // FormData is the right shape for action+file. Server action parses
      // organizationId/assetId/proof from this payload.
      const fd = new FormData();
      fd.append('organizationId', organizationId);
      fd.append('assetId', assetId);

      if (proof) {
        fd.append('proof', proof);
      }

      const r = await submitPropertyClaimAction(fd);

      if (!r.success) {
        setErr(r.error);

        return;
      }

      setSuccessId(assetId);
      resetDialog();
    });
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder={t('search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {/* Outer banner mirrors the in-dialog one so the cooldown / pending
          status remains visible after the user closes the dialog. */}
      <ErrorBanner tone="warning" message={err} />
      <ul className="divide-y">
        {filtered.map((a) => (
          <li
            key={a.id}
            className="py-2 flex flex-wrap items-center justify-between gap-2"
          >
            <span>{a.name}</span>
            {successId === a.id ? (
              // Plain <p> instead of Catalyst <Text> so the green color
              // actually renders (Text otherwise overrides with text-zinc-500).
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                {t('submitted')}
              </p>
            ) : (
              <Button
                color="brand-green"
                onClick={() => setConfirming(a.id)}
                disabled={pending}
              >
                {t('claim')}
              </Button>
            )}
          </li>
        ))}
        {filtered.length === 0 && <Text>{t('empty')}</Text>}
      </ul>
      {confirming && (
        <Dialog open onClose={resetDialog}>
          <DialogTitle>{t('confirm.title')}</DialogTitle>
          <DialogBody>
            <div className="space-y-4">
              <Text>{t('confirm.body')}</Text>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-900 dark:text-white">
                  {t('proof.label')}
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('proof.hint')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_PROOF_ACCEPT}
                  onChange={(e) => pickProof(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm file:cursor-pointer hover:file:bg-zinc-300 dark:text-zinc-100 dark:file:bg-zinc-700 dark:hover:file:bg-zinc-600"
                />
                {proof && !proofErr && (
                  <Text className="text-xs text-zinc-500">
                    {`${proof.name} · ${(proof.size / 1024).toFixed(0)} KB`}
                  </Text>
                )}
                <ErrorBanner message={proofErr} />
              </div>
              {/* Server-side errors (cooldown, already-pending, type
                  mismatch, etc) render inside the dialog so they are
                  visible above the modal backdrop. Amber tone matches the
                  outside-dialog banner; both are about server feedback. */}
              <ErrorBanner tone="warning" message={err} />
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={resetDialog}>
              {t('cancel')}
            </Button>
            <Button
              color="brand-green"
              onClick={() => submit(confirming)}
              disabled={pending || proofErr !== null}
            >
              {t('confirm.submit')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
