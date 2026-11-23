/** Snapshot DTOs owned by the seal context. Adapters map persisted UTC dates and
 * exact decimal strings here; poll entities and receipt secrets never enter exports. */
import { PollSectionData, RegisterEntryData } from './RecordFormat';
import { VotePreimageData } from './VoteLeaf';

export interface SealParticipant extends Omit<RegisterEntryData, 'voted'> {
  receiptSecret: string | null;
  willingToSignProtocol: boolean | null;
  phoneNumber: string | null;
}
export interface SealInput {
  state: string;
  poll: Omit<PollSectionData, 'finishedAt'> & { finishedAt: string | null };
  participants: SealParticipant[];
  votes: Omit<VotePreimageData, 'salt'>[];
}
