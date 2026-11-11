/** Session persistence stores complete domain state with identity assigned before save. */
import { SessionId, UserId } from '../shared/EntityIds';
import { Session } from './Session';
export { Session } from './Session';

export interface SessionRepository {
  save(session: Session): Promise<Session>;
  findById(id: SessionId): Promise<Session | null>;
  delete(id: SessionId): Promise<void>;
  deleteAllForUser(userId: UserId): Promise<void>;
}
