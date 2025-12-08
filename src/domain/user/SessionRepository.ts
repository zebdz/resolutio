export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionRepository {
  create(userId: string, expiresAt: Date): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
