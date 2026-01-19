import { describe, it, expect } from 'vitest';
import { PollParticipant } from '../PollParticipant';
import { PollDomainCodes } from '../PollDomainCodes';

describe('PollParticipant Domain', () => {
  describe('create', () => {
    it('should create a participant with default weight 1.0', () => {
      const result = PollParticipant.create('poll-1', 'user-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.pollId).toBe('poll-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.userWeight).toBe(1.0);
        expect(result.value.snapshotAt).toBeInstanceOf(Date);
      }
    });

    it('should create a participant with custom weight', () => {
      const result = PollParticipant.create('poll-1', 'user-1', 2.5);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.userWeight).toBe(2.5);
      }
    });

    it('should fail with negative weight', () => {
      const result = PollParticipant.create('poll-1', 'user-1', -1.0);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.INVALID_WEIGHT);
      }
    });

    it('should allow zero weight', () => {
      const result = PollParticipant.create('poll-1', 'user-1', 0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.userWeight).toBe(0);
      }
    });
  });

  describe('updateWeight', () => {
    it('should update weight and return change event', () => {
      const result = PollParticipant.create('poll-1', 'user-1', 1.0);

      expect(result.success).toBe(true);
      if (result.success) {
        const participant = result.value;
        const updateResult = participant.updateWeight(3.0);

        expect(updateResult.success).toBe(true);
        if (updateResult.success) {
          expect(updateResult.value.oldWeight).toBe(1.0);
          expect(updateResult.value.newWeight).toBe(3.0);
          expect(participant.userWeight).toBe(3.0);
        }
      }
    });

    it('should fail to update with negative weight', () => {
      const result = PollParticipant.create('poll-1', 'user-1', 1.0);

      expect(result.success).toBe(true);
      if (result.success) {
        const participant = result.value;
        const updateResult = participant.updateWeight(-1.0);

        expect(updateResult.success).toBe(false);
        if (!updateResult.success) {
          expect(updateResult.error).toBe(PollDomainCodes.INVALID_WEIGHT);
        }

        // Weight should remain unchanged
        expect(participant.userWeight).toBe(1.0);
      }
    });

    it('should allow updating to zero weight', () => {
      const result = PollParticipant.create('poll-1', 'user-1', 1.0);

      expect(result.success).toBe(true);
      if (result.success) {
        const participant = result.value;
        const updateResult = participant.updateWeight(0);

        expect(updateResult.success).toBe(true);
        if (updateResult.success) {
          expect(participant.userWeight).toBe(0);
        }
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute participant from props', () => {
      const snapshotAt = new Date('2026-01-15T10:00:00Z');
      const createdAt = new Date('2026-01-15T10:00:00Z');

      const participant = PollParticipant.reconstitute({
        id: 'participant-1',
        pollId: 'poll-1',
        userId: 'user-1',
        userWeight: 2.5,
        snapshotAt,
        createdAt,
      });

      expect(participant.id).toBe('participant-1');
      expect(participant.pollId).toBe('poll-1');
      expect(participant.userId).toBe('user-1');
      expect(participant.userWeight).toBe(2.5);
      expect(participant.snapshotAt).toBe(snapshotAt);
      expect(participant.createdAt).toBe(createdAt);
    });
  });
});
