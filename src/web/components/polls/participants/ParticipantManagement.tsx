'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  updateParticipantWeightAction,
  removeParticipantAction,
  getWeightHistoryAction,
} from '@/src/web/actions/organization/participant';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/web/components/catalyst/table';
import { Button } from '@/src/web/components/catalyst/button';
import EditWeightDialog from './EditWeightDialog';
import WeightHistoryDialog from './WeightHistoryDialog';
import RemoveParticipantDialog from './RemoveParticipantDialog';
import { toast } from 'sonner';
import { PollState } from '@/src/domain/poll/PollState';
import { WeightConfigEditor } from './WeightConfigEditor';
import {
  previewPollWeightConfigAction,
  updatePollWeightConfigAction,
} from '@/src/web/actions/poll/poll';
import { formatWeightAndPercent } from '@/src/web/components/polls/shared/weightDisplay';

interface Participant {
  id: string;
  userId: string;
  userName: string;
  weight: number;
  updatedAt: string; // ISO date string
}

interface WeightConfig {
  distributionType: string;
  propertyAggregation: string;
  propertyIds: string[];
}

interface DescendantGroup {
  orgId: string;
  orgName: string;
  properties: Array<{ id: string; name: string }>;
}

interface ParticipantManagementProps {
  pollId: string;
  participantsData: { participants: Participant[]; canModify: boolean };
  pollState: PollState;
  weightConfig: WeightConfig;
  properties: Array<{ id: string; name: string }>;
  descendantGroups?: DescendantGroup[];
  orgHasOwnershipData: boolean;
  votesCast: boolean;
  // Theoretical max Σ weights (if every owner were registered AND every asset
  // fully owned). 0 for EQUAL polls — the UI hides the building column then.
  buildingTotal: number;
}

export default function ParticipantManagement({
  pollId,
  participantsData,
  pollState,
  weightConfig,
  properties,
  descendantGroups,
  orgHasOwnershipData,
  votesCast,
  buildingTotal,
}: ParticipantManagementProps) {
  const t = useTranslations('poll.participants');
  const router = useRouter();
  const [participants, setParticipants] = useState(
    participantsData.participants
  );
  // Sync local state when the server component re-renders with fresh data
  // (e.g., after WeightConfigEditor calls router.refresh() on save). Without
  // this, the initial-from-props useState above would keep the stale list and
  // the user would have to hard-reload to see the new snapshot. Optimistic
  // updates from edit/remove handlers continue to work because they don't
  // change the upstream prop reference.
  useEffect(() => {
    setParticipants(participantsData.participants);
  }, [participantsData.participants]);
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [editWeightOpen, setEditWeightOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);
  const totalWeightDisplay =
    totalWeight > 0
      ? `${totalWeight.toFixed(2)} (100.00%)`
      : totalWeight.toFixed(2);

  // Building total = theoretical max if every owner were registered. Only
  // meaningful for ownership modes; the page passes 0 for EQUAL polls.
  const showBuildingColumn = buildingTotal > 0;
  const registeredPctOfBuilding =
    showBuildingColumn && buildingTotal > 0
      ? (totalWeight / buildingTotal) * 100
      : 0;
  const buildingDisplay = showBuildingColumn
    ? `${buildingTotal.toFixed(2)} (100.00%)`
    : '';
  const registeredDisplay = showBuildingColumn
    ? `${totalWeight.toFixed(2)} (${registeredPctOfBuilding.toFixed(2)}%)`
    : '';

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
      }

      return result;
    } catch (error) {
      toast.error(t('updateWeightError'));

      return { success: false as const, error: t('updateWeightError') };
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

  const canModify = participantsData.canModify && pollState !== 'FINISHED';

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
        {/* Weight config editor */}
        <WeightConfigEditor
          pollId={pollId}
          initialConfig={weightConfig}
          properties={properties}
          descendantGroups={descendantGroups}
          orgHasOwnershipData={orgHasOwnershipData}
          votesCast={votesCast}
          pollState={pollState}
          onSaved={() => router.refresh()}
          previewAction={previewPollWeightConfigAction}
          updateAction={updatePollWeightConfigAction}
        />

        {/* Totals banner. For ownership polls the building-vs-registered gap
            is the headline number — admins use it to spot how much voting
            power belongs to unregistered owners. */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900 space-y-2">
          {showBuildingColumn ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('buildingTotal')}
                </span>
                <span className="text-base font-semibold text-zinc-900 dark:text-white">
                  {buildingDisplay}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('registeredTotal')}
                </span>
                <span className="text-base font-semibold text-zinc-900 dark:text-white">
                  {registeredDisplay}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('buildingGapHint')}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('totalWeight')}
              </span>
              <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                {totalWeightDisplay}
              </span>
            </div>
          )}
        </div>

        {/* Participants table */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('name')}</TableHeader>
                <TableHeader>
                  {showBuildingColumn ? t('votingWeight') : t('weight')}
                </TableHeader>
                {showBuildingColumn && (
                  <TableHeader>{t('propertyWeight')}</TableHeader>
                )}
                <TableHeader>{t('lastChanged')}</TableHeader>
                <TableHeader>{t('actions')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>{participant.userName}</TableCell>
                  <TableCell>
                    {formatWeightAndPercent(participant.weight, totalWeight)}
                  </TableCell>
                  {showBuildingColumn && (
                    <TableCell>
                      {`${((participant.weight / buildingTotal) * 100).toFixed(2)}%`}
                    </TableCell>
                  )}
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
