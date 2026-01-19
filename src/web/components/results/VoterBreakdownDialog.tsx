'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Button } from '@/app/components/catalyst/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/catalyst/table';

interface Voter {
  userId: string;
  userName: string;
  weight: number;
}

interface AnswerResult {
  answerId: string;
  answerText: string;
  voteCount: number;
  weightedVotes: number;
  voters: Voter[];
}

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
            {answer.voteCount} {t('votes')} • {answer.weightedVotes.toFixed(2)}{' '}
            {t('voteWeight')}
          </p>
        </div>

        {answer.voters.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-600 dark:text-zinc-400">{t('noVoters')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <Table>
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
                    <TableCell>{voter.weight.toFixed(2)}</TableCell>
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
