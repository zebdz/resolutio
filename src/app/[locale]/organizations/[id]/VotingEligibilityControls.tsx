'use client';

/** Member-row voting switches require a reason before saving. Administrators can
 * also inspect the organization-wide history, including changes to former members. */
import { useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';
import { Switch } from '@/web/components/catalyst/switch';
import { Textarea } from '@/web/components/catalyst/textarea';
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogDescription,
  DialogActions,
} from '@/web/components/catalyst/dialog';
import {
  setMembershipVotingEligibility,
  eligibilityHistory,
} from '@/web/actions/organization/votingEligibility';
import type { HistoryEntry } from '@/application/organization/VotingEligibility';

export function VotingEligibilityToggle({
  organizationId,
  memberId,
  name,
  eligible,
  onChanged,
}: {
  organizationId: string;
  memberId: string;
  name: string;
  eligible: boolean;
  onChanged: (value: boolean) => void;
}) {
  const t = useTranslations('organization.eligibility');
  const common = useTranslations('common');
  const [target, setTarget] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function save() {
    if (target === null || !reason.trim()) {
      return;
    }

    start(async () => {
      try {
        const result = await setMembershipVotingEligibility({
          organizationId,
          memberId,
          eligible: target,
          reason,
        });

        if (!result.success) {
          setError(result.error);

          return;
        }

        setTarget(null);
        onChanged(target);
      } catch {
        setError(common('errors.unexpected'));
      }
    });
  }

  return (
    <>
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs">
        <Switch
          aria-label={t('switchLabel', { name })}
          checked={eligible}
          onChange={(value) => {
            setError('');
            setReason('');
            setTarget(value);
          }}
        />
        {t(eligible ? 'eligible' : 'ineligible')}
      </span>
      <Dialog
        open={target !== null}
        onClose={() => {
          if (!pending) {
            setTarget(null);
          }
        }}
      >
        <DialogTitle>{t(target ? 'enable' : 'disable', { name })}</DialogTitle>
        <DialogDescription>{t('effective')}</DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogBody>
            <label className="block space-y-2 text-sm">
              <span>{t('reason')}</span>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={500}
                rows={3}
                disabled={pending}
              />
            </label>
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogActions>
            <Button
              type="button"
              plain
              disabled={pending}
              onClick={() => setTarget(null)}
            >
              {common('cancel')}
            </Button>
            <Button type="submit" disabled={pending || !reason.trim()}>
              {common('save')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export function VotingEligibilityHistory({
  organizationId,
}: {
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('organization.eligibility');

  return (
    <>
      <Button type="button" plain onClick={() => setOpen(true)}>
        {t('history')}
      </Button>
      {open && (
        <HistoryDialog
          organizationId={organizationId}
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}

function HistoryDialog({
  organizationId,
  close,
}: {
  organizationId: string;
  close: () => void;
}) {
  const t = useTranslations('organization.eligibility');
  const common = useTranslations('common');
  const locale = useLocale();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [before, setBefore] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await eligibilityHistory(organizationId, before);

        if (!active) {
          return;
        }

        if (!result.success) {
          setError(result.error);

          return;
        }

        setEntries((previous) =>
          before ? [...previous, ...result.data.entries] : result.data.entries
        );
        setNext(result.data.next);
      } catch {
        if (active) {
          setError(common('errors.unexpected'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [organizationId, before, common]);

  return (
    <Dialog open onClose={close} size="2xl">
      <DialogTitle>{t('history')}</DialogTitle>
      <DialogBody>
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {entries.map((entry) => (
            <li key={entry.id} className="space-y-1 py-3 text-sm">
              <p className="font-medium">
                {entry.memberName} (@{entry.memberNickname})
              </p>
              <p>
                {t(entry.wasEligible ? 'eligible' : 'ineligible')} →{' '}
                {t(entry.eligible ? 'eligible' : 'ineligible')}
              </p>
              <p>
                {t('changedBy', {
                  name: entry.actorName + ' (@' + entry.actorNickname + ')',
                })}{' '}
                ·{' '}
                <time dateTime={entry.changedAt}>
                  {new Date(entry.changedAt).toLocaleString(locale)}
                </time>
              </p>
              <p className="whitespace-pre-wrap break-words">{entry.reason}</p>
            </li>
          ))}
        </ol>
        {error && <p role="alert">{error}</p>}
        {loading && <p role="status">{common('loading')}</p>}
        {!loading && !error && entries.length === 0 && <p>{t('empty')}</p>}
        {next && !error && (
          <Button
            type="button"
            plain
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setBefore(next);
            }}
          >
            {t('older')}
          </Button>
        )}
      </DialogBody>
      <DialogActions>
        <Button type="button" onClick={close}>
          {t('close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
