/** Immutable session state receives a secure token and timestamps from the application.
 * Reconstitution validates stored identifiers and never exposes mutable Dates. */
import { z } from 'zod';
import { SessionId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { ClientIp } from '../auth/AuthValues';

// The header is opaque metadata; its empty-string behavior remains unchanged.
export const UserAgent = z.string().brand<'SessionUserAgent'>();
export type UserAgent = z.infer<typeof UserAgent>;

export interface SessionProps {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly expiresAt: Instant;
  readonly createdAt: Instant;
  readonly ipAddress: ClientIp | null;
  readonly userAgent: UserAgent | null;
}

export interface RawSessionProps {
  id: string;
  userId: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  ipAddress: string | null;
  userAgent: string | null;
}

function storedInstant(value: Date | string): Instant {
  return value instanceof Date ? Instant.fromDate(value) : Instant.parse(value);
}

export class Session {
  private readonly props: SessionProps;

  private constructor(props: SessionProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(
    input: Omit<SessionProps, 'id' | 'createdAt'>,
    creation: EntityCreation<SessionId>
  ): Session {
    return Session.reconstitute({
      ...input,
      id: creation.id,
      createdAt: creation.now,
    });
  }

  static reconstitute(raw: RawSessionProps): Session {
    return new Session({
      id: SessionId.parse(raw.id),
      userId: UserId.parse(raw.userId),
      expiresAt: storedInstant(raw.expiresAt),
      createdAt: storedInstant(raw.createdAt),
      ipAddress: raw.ipAddress === null ? null : ClientIp.parse(raw.ipAddress),
      userAgent: raw.userAgent === null ? null : UserAgent.parse(raw.userAgent),
    });
  }

  get id(): SessionId {
    return this.props.id;
  }
  get userId(): UserId {
    return this.props.userId;
  }
  get expiresAt(): Instant {
    return this.props.expiresAt;
  }
  get createdAt(): Instant {
    return this.props.createdAt;
  }
  get ipAddress(): ClientIp | null {
    return this.props.ipAddress;
  }
  get userAgent(): UserAgent | null {
    return this.props.userAgent;
  }

  isExpired(now: Instant): boolean {
    return Instant.parse(now) > this.props.expiresAt;
  }
}
