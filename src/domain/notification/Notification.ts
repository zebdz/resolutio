import { Result, success } from '../shared/Result';

export interface NotificationProps {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

export class Notification {
  private constructor(private props: NotificationProps) {}

  public static create(
    input: CreateNotificationInput
  ): Result<Notification, string> {
    const notification = new Notification({
      id: '',
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
      readAt: null,
      createdAt: new Date(),
    });

    return success(notification);
  }

  public static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  public get id(): string {
    return this.props.id;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get type(): string {
    return this.props.type;
  }

  public get title(): string {
    return this.props.title;
  }

  public get body(): string {
    return this.props.body;
  }

  public get data(): Record<string, unknown> | null {
    return this.props.data;
  }

  public get readAt(): Date | null {
    return this.props.readAt;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public isRead(): boolean {
    return this.props.readAt !== null;
  }

  public markAsRead(): void {
    if (!this.props.readAt) {
      this.props.readAt = new Date();
    }
  }

  public toJSON(): NotificationProps {
    return { ...this.props };
  }
}
