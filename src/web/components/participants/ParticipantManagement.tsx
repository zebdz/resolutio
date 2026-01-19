'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  updateParticipantWeightAction,
  removeParticipantAction,
  getWeightHistoryAction,
} from '@/web/actions/participant';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/catalyst/table';
import { Button } from '@/app/components/catalyst/button';
import EditWeightDialog from './EditWeightDialog';
import WeightHistoryDialog from './WeightHistoryDialog';
import RemoveParticipantDialog from './RemoveParticipantDialog';
import { toast } from 'sonner';

interface Participant {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  weight: number;
  updatedAt: string; // ISO date string
}

interface ParticipantManagementProps {
  pollId: string;
  participantsData: { participants: Participant[]; canModify: boolean };
  isActive: boolean;
  isFinished: boolean;
}

export default function ParticipantManagement({
  pollId,
  participantsData,
  isActive,
  isFinished,
}: ParticipantManagementProps) {
  const t = useTranslations('poll.participants');
  const [participants, setParticipants] = useState(
    participantsData.participants
  );
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [editWeightOpen, setEditWeightOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);

  const handleEditWeight = async (
    participantId: string,
    newWeight: number,
    reason: string
  ) => {
    setIsLoading(true);

    try {
      const result = await updateParticipantWeightAction({
        participantId,
        newWeight,
        reason,
      });

      if (result.success) {
        // Update local state
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId
              ? { ...p, weight: newWeight, updatedAt: new Date().toISOString() }
              : p
          )
        );
        toast.success(t('weightUpdated'));
        setEditWeightOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(t('updateWeightError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (participantId: string) => {
    setIsLoading(true);

    try {
      const result = await removeParticipantAction(participantId);

      if (result.success) {
        setParticipants((prev) => prev.filter((p) => p.id !== participantId));
        toast.success(t('participantRemoved'));
        setRemoveOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(t('removeParticipantError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewHistory = (participant: Participant) => {
    setSelectedParticipant(participant);
    setHistoryOpen(true);
  };

  const canModify = participantsData.canModify && !isFinished;

  if (participants.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          {t('noParticipants')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Total weight display */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('totalWeight')}
            </span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-white">
              {totalWeight.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Participants table */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('name')}</TableHeader>
                <TableHeader>{t('phone')}</TableHeader>
                <TableHeader>{t('weight')}</TableHeader>
                <TableHeader>{t('lastChanged')}</TableHeader>
                <TableHeader>{t('actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>{participant.userName}</TableCell>
                  <TableCell>{participant.userPhone}</TableCell>
                  <TableCell>{participant.weight.toFixed(2)}</TableCell>
                  <TableCell>
                    {new Date(participant.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        color="zinc"
                        onClick={() => {
                          setSelectedParticipant(participant);
                          setEditWeightOpen(true);
                        }}
                        disabled={!canModify}
                        title={
                          !canModify ? t('cannotModifyHasVotes') : undefined
                        }
                      >
                        {t('editWeight')}
                      </Button>
                      <Button
                        type="button"
                        color="zinc"
                        onClick={() => handleViewHistory(participant)}
                      >
                        {t('viewHistory')}
                      </Button>
                      <Button
                        type="button"
                        color="red"
                        onClick={() => {
                          setSelectedParticipant(participant);
                          setRemoveOpen(true);
                        }}
                        disabled={!canModify}
                        title={
                          !canModify ? t('cannotModifyHasVotes') : undefined
                        }
                      >
                        {t('remove')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialogs */}
      {selectedParticipant && (
        <>
          <EditWeightDialog
            isOpen={editWeightOpen}
            onClose={() => setEditWeightOpen(false)}
            participant={selectedParticipant}
            onSave={handleEditWeight}
            isLoading={isLoading}
          />

          <WeightHistoryDialog
            isOpen={historyOpen}
            onClose={() => setHistoryOpen(false)}
            pollId={pollId}
            participantId={selectedParticipant.id}
            participantName={selectedParticipant.userName}
          />

          <RemoveParticipantDialog
            isOpen={removeOpen}
            onClose={() => setRemoveOpen(false)}
            participant={selectedParticipant}
            onConfirm={handleRemove}
            isLoading={isLoading}
          />
        </>
      )}
    </>
  );
}
