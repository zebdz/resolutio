import { Notification } from './Notification';

export interface FindByUserIdOptions {
  limit?: number;
  offset?: number;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<Notification>;
  saveBatch(notifications: Notification[]): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findByUserId(
    userId: string,
    options?: FindByUserIdOptions
  ): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  findByIds(ids: string[]): Promise<Notification[]>;
  deleteByIds(ids: string[]): Promise<void>;
  getCountByUserId(userId: string): Promise<number>;
}
