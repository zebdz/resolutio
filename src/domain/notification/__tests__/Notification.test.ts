import { describe, it, expect } from 'vitest';
import { Notification } from '../Notification';

describe('Notification', () => {
  describe('create', () => {
    it('should create a notification', () => {
      const result = Notification.create({
        userId: 'user-1',
        type: 'org_joined_parent',
        title: 'notification.orgJoinedParent.title',
        body: 'notification.orgJoinedParent.body',
        data: { childOrgName: 'Child Org', parentOrgName: 'Parent Org' },
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.userId).toBe('user-1');
        expect(result.value.type).toBe('org_joined_parent');
        expect(result.value.title).toBe('notification.orgJoinedParent.title');
        expect(result.value.body).toBe('notification.orgJoinedParent.body');
        expect(result.value.data).toEqual({
          childOrgName: 'Child Org',
          parentOrgName: 'Parent Org',
        });
        expect(result.value.readAt).toBeNull();
        expect(result.value.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should create without data', () => {
      const result = Notification.create({
        userId: 'user-1',
        type: 'test',
        title: 'title',
        body: 'body',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.data).toBeNull();
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props', () => {
      const now = new Date();
      const notification = Notification.reconstitute({
        id: 'notif-1',
        userId: 'user-1',
        type: 'org_joined_parent',
        title: 'title',
        body: 'body',
        data: { key: 'value' },
        readAt: now,
        createdAt: now,
      });

      expect(notification.id).toBe('notif-1');
      expect(notification.readAt).toBe(now);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      const notification = Notification.reconstitute({
        id: 'notif-1',
        userId: 'user-1',
        type: 'test',
        title: 'title',
        body: 'body',
        data: null,
        readAt: null,
        createdAt: new Date(),
      });

      expect(notification.readAt).toBeNull();

      notification.markAsRead();

      expect(notification.readAt).toBeInstanceOf(Date);
    });

    it('should not change readAt if already read', () => {
      const readAt = new Date('2024-01-01');
      const notification = Notification.reconstitute({
        id: 'notif-1',
        userId: 'user-1',
        type: 'test',
        title: 'title',
        body: 'body',
        data: null,
        readAt,
        createdAt: new Date(),
      });

      notification.markAsRead();

      expect(notification.readAt).toBe(readAt);
    });
  });

  describe('isRead', () => {
    it('should return false for unread', () => {
      const notification = Notification.reconstitute({
        id: 'notif-1',
        userId: 'user-1',
        type: 'test',
        title: 'title',
        body: 'body',
        data: null,
        readAt: null,
        createdAt: new Date(),
      });

      expect(notification.isRead()).toBe(false);
    });

    it('should return true for read', () => {
      const notification = Notification.reconstitute({
        id: 'notif-1',
        userId: 'user-1',
        type: 'test',
        title: 'title',
        body: 'body',
        data: null,
        readAt: new Date(),
        createdAt: new Date(),
      });

      expect(notification.isRead()).toBe(true);
    });
  });
});
