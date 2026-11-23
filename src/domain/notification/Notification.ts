/** A notification binds a recipient to validated, immutable content and read time.
 * Creation and Result-based restoration validate identities/content/time; DTOs detach dates/payloads. */
import { z } from 'zod';
import { NotificationId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';
import { NotificationContent, NotificationType } from './NotificationContent';
import {
  NotificationDomainCodes,
  NotificationDomainCode,
} from './NotificationDomainCodes';

/** Raw persistence input; content JSON is untrusted until reconstitution. */
export interface NotificationProps {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}
/** Validated content stays correlated with its notification kind in projections. */
export type NotificationSnapshot = NotificationContent & {
  readonly id: NotificationId;
  readonly userId: UserId;
  readonly readAt: Date | null;
  readonly createdAt: Date;
};
export type CreateNotificationInput = NotificationContent & {
  readonly userId: UserId;
};

const storedInstant = z
  .date()
  .transform((date) => date.toISOString())
  .pipe(Instant.schema);
const storedIdentity = z.object({
  id: NotificationId,
  userId: UserId,
  createdAt: storedInstant,
  readAt: storedInstant.nullable(),
});
const creationIdentity = storedIdentity
  .omit({ readAt: true })
  .extend({ createdAt: Instant.schema });

export class Notification {
  private constructor(
    private readonly identity: {
      readonly id: NotificationId;
      readonly userId: UserId;
      readonly createdAt: Instant;
    },
    private readonly content: NotificationContent,
    private readTime: Instant | null
  ) {}

  public static create(
    input: CreateNotificationInput,
    creation: EntityCreation<NotificationId>
  ): Result<Notification, NotificationDomainCode> {
    const identity = creationIdentity.safeParse({
      id: creation.id,
      userId: input.userId,
      createdAt: creation.now,
    });
    const content = NotificationContent.safeParse(input);

    if (!identity.success || !content.success) {
      return failure(NotificationDomainCodes.INVALID_DATA);
    }

    return success(new Notification(identity.data, content.data, null));
  }

  public static restore(
    data: NotificationProps
  ): Result<Notification, NotificationDomainCode> {
    const identity = storedIdentity.safeParse(data);
    const content = NotificationContent.safeParse(data);

    if (!identity.success || !content.success) {
      return failure(NotificationDomainCodes.INVALID_DATA);
    }

    return success(
      new Notification(
        {
          id: identity.data.id,
          userId: identity.data.userId,
          createdAt: identity.data.createdAt,
        },
        content.data,
        identity.data.readAt
      )
    );
  }

  public get id(): NotificationId {
    return this.identity.id;
  }
  public get userId(): UserId {
    return this.identity.userId;
  }
  public get type(): NotificationType {
    return this.content.type;
  }
  public get title(): NotificationContent['title'] {
    return this.content.title;
  }
  public get body(): NotificationContent['body'] {
    return this.content.body;
  }
  public get data(): NotificationContent['data'] {
    return this.content.data;
  }
  public get readAt(): Date | null {
    return this.readTime === null ? null : Instant.toDate(this.readTime);
  }
  public get createdAt(): Date {
    return Instant.toDate(this.identity.createdAt);
  }
  public isRead(): boolean {
    return this.readTime !== null;
  }
  public markAsRead(at: Instant): void {
    if (this.readTime === null) {
      this.readTime = Instant.parse(at);
    }
  }
  public toJSON(): NotificationSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      ...structuredClone(this.content),
      readAt: this.readAt,
      createdAt: this.createdAt,
    };
  }
}
