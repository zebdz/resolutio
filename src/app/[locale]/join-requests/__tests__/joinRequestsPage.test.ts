import { describe, it, expect } from 'vitest';

// Mirrors PendingJoinRequestsSection count logic
function getJoinRequestsCount(pending: unknown[], rejected: unknown[]): number {
  return pending.length + rejected.length;
}

// Mirrors page empty-state logic
function shouldShowEmptyState(
  pending: unknown[],
  rejected: unknown[]
): boolean {
  return pending.length === 0 && rejected.length === 0;
}

describe('Join Requests page logic', () => {
  describe('getJoinRequestsCount', () => {
    it('should return 0 when no pending or rejected requests', () => {
      expect(getJoinRequestsCount([], [])).toBe(0);
    });

    it('should count only pending requests', () => {
      expect(getJoinRequestsCount([{}, {}], [])).toBe(2);
    });

    it('should count only rejected requests', () => {
      expect(getJoinRequestsCount([], [{}, {}, {}])).toBe(3);
    });

    it('should sum pending and rejected requests', () => {
      expect(getJoinRequestsCount([{}], [{}, {}])).toBe(3);
    });
  });

  describe('shouldShowEmptyState', () => {
    it('should show empty state when both arrays are empty', () => {
      expect(shouldShowEmptyState([], [])).toBe(true);
    });

    it('should not show empty state when pending requests exist', () => {
      expect(shouldShowEmptyState([{}], [])).toBe(false);
    });

    it('should not show empty state when rejected requests exist', () => {
      expect(shouldShowEmptyState([], [{}])).toBe(false);
    });

    it('should not show empty state when both exist', () => {
      expect(shouldShowEmptyState([{}], [{}])).toBe(false);
    });
  });
});
