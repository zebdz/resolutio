/** Audit record clients supply identity/time and preserve historical weight details.
 * Stored Date values are detached when reconstituted into immutable domain state. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import {
  ParticipantWeightHistoryId,
  ParticipantId,
  PollId,
  UserId,
} from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { describe, it, expect } from 'vitest';
import { ParticipantWeightHistory } from '../ParticipantWeightHistory';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

describe('ParticipantWeightHistory Domain', () => {
  describe('create', () => {
    it('should create history with all data', () => {
      const result = ParticipantWeightHistory.create(
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1'),
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
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1')
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.reason).toBeNull();
      }
    });

    it('should create history with null reason explicitly', () => {
      const result = ParticipantWeightHistory.create(
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1'),
        null
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.reason).toBeNull();
      }
    });
  });

  describe('profanity check', () => {
    const mockProfanityChecker: ProfanityChecker = {
      findProfaneWords: () => [],
      containsProfanity: (text: string) => text.includes('badword'),
    };

    it('should reject reason with profanity', () => {
      const result = ParticipantWeightHistory.create(
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1'),
        'badword reason',
        mockProfanityChecker
      );
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('should pass clean reason with profanityChecker', () => {
      const result = ParticipantWeightHistory.create(
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1'),
        'Clean reason',
        mockProfanityChecker
      );
      expect(result.success).toBe(true);
    });

    it('should pass null reason with profanityChecker', () => {
      const result = ParticipantWeightHistory.create(
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1'),
        null,
        mockProfanityChecker
      );
      expect(result.success).toBe(true);
    });

    it('should pass without profanityChecker (backward compat)', () => {
      const result = ParticipantWeightHistory.create(
        ParticipantId.parse('participant-1'),
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        VotingWeight.parse(2.5),
        UserId.parse('admin-1'),
        testCreation(ParticipantWeightHistoryId, 'history-1'),
        'Any reason'
      );
      expect(result.success).toBe(true);
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
      expect(history.changedAt).toEqual(changedAt);
    });
  });
});
