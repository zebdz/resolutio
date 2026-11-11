/** Explicit administrator-facing weight audit projection, preserving validated IDs and units.
 * Names and ISO timestamps are presentation values; domain entities never cross this boundary. */
import type { GetWeightHistoryResult } from '@/application/poll/GetWeightHistoryUseCase';
import { User } from '@/domain/user/User';

export function serializeWeightHistory(result: GetWeightHistoryResult) {
  return result.history.map(({ history, changedByUser }) => ({
    id: history.id,
    participantId: history.participantId,
    oldWeight: history.oldWeight,
    newWeight: history.newWeight,
    reason: history.reason || '',
    changedBy: User.formatFullName(
      changedByUser.firstName,
      changedByUser.lastName,
      changedByUser.middleName
    ),
    changedAt: history.changedAt.toISOString(),
  }));
}

export type WeightHistoryView = ReturnType<typeof serializeWeightHistory>;
export type WeightHistoryEntry = WeightHistoryView[number];
