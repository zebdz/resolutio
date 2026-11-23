'use client';

/** Show the authorized voters for one answer. Sealed totals and row weights keep
 * their six-place precision across both the summary and the detail table. */
import type { AnswerResult } from '@/web/actions/poll/PollResultsView';
import { printWeight } from '@/web/lib/protocolWeight';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/web/components/catalyst/table';

interface VoterBreakdownDialogProps {
  isOpen: boolean;
  onClose: () => void;
  answer: AnswerResult;
}

export default function VoterBreakdownDialog({
  isOpen,
  onClose,
  answer,
}: VoterBreakdownDialogProps) {
  const t = useTranslations('poll.results');

  return (
    <Dialog open={isOpen} onClose={onClose} size="2xl">
      <DialogTitle>{t('voterBreakdown')}</DialogTitle>
      <DialogBody>
        <div className="mb-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {answer.answerText}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
            {answer.voteCount} {t('votes')} •{' '}
            {answer.exactWeight === undefined
              ? answer.weightedVotes.toFixed(2)
              : printWeight(answer.weightedVotes, answer.exactWeight)}{' '}
            {t('voteWeight')}
          </p>
        </div>

        {answer.voters.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-600 dark:text-zinc-400">{t('noVoters')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden [--gutter:1rem]">
            <Table bleed className="!mx-0">
              <TableHead>
                <TableRow>
                  <TableHeader>{t('voterName')}</TableHeader>
                  <TableHeader>{t('weight')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {answer.voters.map((voter) => (
                  <TableRow key={voter.userId}>
                    <TableCell>{voter.userName}</TableCell>
                    <TableCell>
                      {answer.exactWeight === undefined
                        ? voter.weight.toFixed(2)
                        : printWeight(voter.weight)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button onClick={onClose}>{t('close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
