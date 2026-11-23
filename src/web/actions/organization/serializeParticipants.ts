/** Explicit participant-list boundary. Even authorized admins receive only
 * list fields here; receipt credentials and signing decisions stay server-side. */
import { GetParticipantsResult } from '@/application/poll/GetParticipantsUseCase';

export function serializeParticipants(result: GetParticipantsResult) {
  return {
    canModify: result.canModify,
    participants: result.participants.map(({ participant, user }) => ({
      participant: {
        id: participant.id,
        pollId: participant.pollId,
        userId: participant.userId,
        userWeight: participant.userWeight,
        snapshotAt: new Date(participant.snapshotAt),
        createdAt: new Date(participant.createdAt),
      },
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
      },
    })),
  };
}

export type ParticipantsView = ReturnType<typeof serializeParticipants>;
