import { describe, it, expect } from 'vitest';
import { ParticipantWeightHistory } from '../ParticipantWeightHistory';

describe('ParticipantWeightHistory Domain', () => {
  describe('create', () => {
    it('should create history with all data', () => {
      const result = ParticipantWeightHistory.create(
        'participant-1',
        'poll-1',
        'user-1',
        1.0,
        2.5,
        'admin-1',
        'Property reassessment'
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.participantId).toBe('participant-1');
        expect(result.value.pollId).toBe('poll-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.oldWeight).toBe(1.0);
        expect(result.value.newWeight).toBe(2.5);
        expect(result.value.changedBy).toBe('admin-1');
        expect(result.value.reason).toBe('Property reassessment');
        expect(result.value.changedAt).toBeInstanceOf(Date);
      }
    });

    it('should create history without reason', () => {
      const result = ParticipantWeightHistory.create(
        'participant-1',
        'poll-1',
        'user-1',
        1.0,
        2.5,
        'admin-1'
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.reason).toBeNull();
      }
    });

    it('should create history with null reason explicitly', () => {
      const result = ParticipantWeightHistory.create(
        'participant-1',
        'poll-1',
        'user-1',
        1.0,
        2.5,
        'admin-1',
        null
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.reason).toBeNull();
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute history from props', () => {
      const changedAt = new Date('2026-01-15T10:00:00Z');

      const history = ParticipantWeightHistory.reconstitute({
        id: 'history-1',
        participantId: 'participant-1',
        pollId: 'poll-1',
        userId: 'user-1',
        oldWeight: 1.0,
        newWeight: 2.5,
        changedBy: 'admin-1',
        reason: 'Correcting initial weight',
        changedAt,
      });

      expect(history.id).toBe('history-1');
      expect(history.participantId).toBe('participant-1');
      expect(history.pollId).toBe('poll-1');
      expect(history.userId).toBe('user-1');
      expect(history.oldWeight).toBe(1.0);
      expect(history.newWeight).toBe(2.5);
      expect(history.changedBy).toBe('admin-1');
      expect(history.reason).toBe('Correcting initial weight');
      expect(history.changedAt).toBe(changedAt);
    });
  });
});
