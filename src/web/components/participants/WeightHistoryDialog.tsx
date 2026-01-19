'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { getWeightHistoryAction } from '@/web/actions/participant';
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

interface WeightHistory {
  id: string;
  participantId: string;
  oldWeight: number;
  newWeight: number;
  reason: string;
  changedBy: string;
  changedAt: string; // ISO date string
}

interface WeightHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pollId: string;
  participantId: string;
  participantName: string;
}

export default function WeightHistoryDialog({
  isOpen,
  onClose,
  pollId,
  participantId,
  participantName,
}: WeightHistoryDialogProps) {
  const t = useTranslations('poll.participants');
  const [history, setHistory] = useState<WeightHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await getWeightHistoryAction(pollId);

      if (result.success) {
        // Filter history for this participant
        const participantHistory = result.data.filter(
          (h: any) => h.participantId === participantId
        );
        setHistory(participantHistory);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('loadHistoryError'));
    } finally {
      setIsLoading(false);
    }
  }, [pollId, participantId, t]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  return (
    <Dialog open={isOpen} onClose={onClose} size="3xl">
      <DialogTitle>{t('historyTitle')}</DialogTitle>
      <DialogBody>
        <div className="mb-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {participantName}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-zinc-600 dark:text-zinc-400">{t('loading')}</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-600 dark:text-zinc-400">{t('noHistory')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('date')}</TableHeader>
                  <TableHeader>{t('oldWeight')}</TableHeader>
                  <TableHeader>{t('newWeight')}</TableHeader>
                  <TableHeader>{t('changedBy')}</TableHeader>
                  <TableHeader>{t('reason')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {new Date(item.changedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{item.oldWeight.toFixed(2)}</TableCell>
                    <TableCell>{item.newWeight.toFixed(2)}</TableCell>
                    <TableCell>{item.changedBy}</TableCell>
                    <TableCell>{item.reason}</TableCell>
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
