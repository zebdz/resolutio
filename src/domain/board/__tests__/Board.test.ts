import { describe, it, expect } from 'vitest';
import { Board, BOARD_NAME_MAX_LENGTH } from '../Board';
import { BoardDomainCodes } from '../BoardDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

describe('Board', () => {
  describe('create', () => {
    it('should create a board with valid name', () => {
      const result = Board.create('Test Board', 'org-1');
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.name).toBe('Test Board');
        expect(result.value.organizationId).toBe('org-1');
      }
    });

    it('should trim the board name', () => {
      const result = Board.create('  Test Board  ', 'org-1');
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.name).toBe('Test Board');
      }
    });

    it('should fail when name is empty', () => {
      const result = Board.create('', 'org-1');
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(BoardDomainCodes.BOARD_NAME_EMPTY);
      }
    });

    it('should fail when name is only whitespace', () => {
      const result = Board.create('   ', 'org-1');
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(BoardDomainCodes.BOARD_NAME_EMPTY);
      }
    });

    it('should fail when name exceeds max length', () => {
      const longName = 'a'.repeat(BOARD_NAME_MAX_LENGTH + 1);
      const result = Board.create(longName, 'org-1');
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(BoardDomainCodes.BOARD_NAME_TOO_LONG);
      }
    });

    describe('profanity checks', () => {
      const profaneChecker: ProfanityChecker = {
        containsProfanity: (text: string) =>
          text.toLowerCase().includes('badword'),
      };

      it('should fail when name contains profanity', () => {
        const result = Board.create('Badword Board', 'org-1', profaneChecker);
        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
        }
      });

      it('should succeed when name is clean', () => {
        const result = Board.create('Clean Board', 'org-1', profaneChecker);
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.value.name).toBe('Clean Board');
        }
      });

      it('should not check profanity when checker is not provided', () => {
        const result = Board.create('Any Board', 'org-1');
        expect(result.success).toBe(true);
      });
    });
  });

  describe('archive', () => {
    it('should archive a board', () => {
      const createResult = Board.create('Test Board', 'org-1');
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const board = createResult.value;
        expect(board.isArchived()).toBe(false);

        const archiveResult = board.archive();
        expect(archiveResult.success).toBe(true);
        expect(board.isArchived()).toBe(true);
      }
    });

    it('should fail when already archived', () => {
      const createResult = Board.create('Test Board', 'org-1');
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const board = createResult.value;
        board.archive();

        const archiveResult = board.archive();
        expect(archiveResult.success).toBe(false);

        if (!archiveResult.success) {
          expect(archiveResult.error).toBe(
            BoardDomainCodes.BOARD_ALREADY_ARCHIVED
          );
        }
      }
    });
  });
});
