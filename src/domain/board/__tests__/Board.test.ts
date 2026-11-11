/** Board domain contracts retain caller-provided identity/time and reject invalid state.
 * Serialization always returns detached persistence values. */
import { describe, it, expect } from 'vitest';
import { Board, BOARD_NAME_MAX_LENGTH } from '../Board';
import { BoardName, parseBoardName } from '../BoardName';
import { BoardDomainCodes } from '../BoardDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
import { BoardId, OrganizationId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';

const organizationId = OrganizationId.parse('org-1');
const creation = {
  id: BoardId.parse('board-1'),
  now: Instant.parse('2026-10-26T12:00:00.000Z'),
};
const archivedAt = Instant.parse('2026-10-26T13:00:00.000Z');

describe('Board', () => {
  it('keeps the explicit creation identity and instant before persistence', () => {
    const id = BoardId.parse('board-created');
    const now = Instant.parse('2026-10-26T12:00:00.123Z');
    const result = Board.create(
      BoardName.parse('Created board'),
      OrganizationId.parse('org-1'),
      { id, now }
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(id);
      expect(result.value.createdAt).toBe(now);
      expect(result.value.toJSON()).toEqual({
        id,
        name: 'Created board',
        organizationId: 'org-1',
        createdAt: new Date(now),
        archivedAt: null,
      });
    }
  });

  it.each([
    { id: '' },
    { organizationId: '' },
    { name: '   ' },
    { name: ' Board ' },
    { name: 'x'.repeat(BOARD_NAME_MAX_LENGTH + 1) },
    { createdAt: new Date(NaN) },
    { archivedAt: new Date(NaN) },
  ])('rejects invalid rehydrated data: %j', (invalid) => {
    expect(() =>
      Board.reconstitute({
        id: 'board-1',
        organizationId: 'org-1',
        name: 'Board',
        createdAt: new Date(creation.now),
        archivedAt: null,
        ...invalid,
      })
    ).toThrow(BoardDomainCodes.BOARD_INVALID_DATA);
  });

  it('protects its instants from mutations of input and output Dates', () => {
    const createdAt = new Date(creation.now);
    const board = Board.reconstitute({
      id: 'board-1',
      organizationId: 'org-1',
      name: 'Board',
      createdAt,
      archivedAt: null,
    });
    createdAt.setUTCFullYear(1999);
    expect(board.createdAt).toBe(creation.now);
    expect(board.archive(archivedAt).success).toBe(true);
    const serialized = board.toJSON();
    serialized.createdAt.setUTCFullYear(1998);
    serialized.archivedAt?.setUTCFullYear(1998);
    expect(board.createdAt).toBe(creation.now);
    expect(board.archivedAt).toBe(archivedAt);
  });
  describe('create', () => {
    it('should create a board with valid name', () => {
      const result = Board.create(
        BoardName.parse('Test Board'),
        organizationId,
        creation
      );
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.name).toBe('Test Board');
        expect(result.value.organizationId).toBe('org-1');
      }
    });

    it('decodes and trims the board name before creation', () => {
      const name = parseBoardName('  Test Board  ');

      if (!name.success) {
        throw new Error(name.error);
      }

      const result = Board.create(name.value, organizationId, creation);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.name).toBe('Test Board');
      }
    });

    it('should fail when name is empty', () => {
      // @ts-expect-error Malformed runtime input cannot bypass domain validation.
      const result = Board.create('', organizationId, creation);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(BoardDomainCodes.BOARD_NAME_EMPTY);
      }
    });

    it('should fail when name is only whitespace', () => {
      const result = parseBoardName('   ');
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(BoardDomainCodes.BOARD_NAME_EMPTY);
      }
    });

    it('should fail when name exceeds max length', () => {
      const longName = 'a'.repeat(BOARD_NAME_MAX_LENGTH + 1);
      const result = parseBoardName(longName);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(BoardDomainCodes.BOARD_NAME_TOO_LONG);
      }
    });

    describe('profanity checks', () => {
      const profaneChecker: ProfanityChecker = {
        findProfaneWords: () => [],
        containsProfanity: (text: string) =>
          text.toLowerCase().includes('badword'),
      };

      it('should fail when name contains profanity', () => {
        const result = Board.create(
          BoardName.parse('Badword Board'),
          organizationId,
          creation,
          profaneChecker
        );
        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
        }
      });

      it('should succeed when name is clean', () => {
        const result = Board.create(
          BoardName.parse('Clean Board'),
          organizationId,
          creation,
          profaneChecker
        );
        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.value.name).toBe('Clean Board');
        }
      });

      it('should not check profanity when checker is not provided', () => {
        const result = Board.create(
          BoardName.parse('Any Board'),
          organizationId,
          creation
        );
        expect(result.success).toBe(true);
      });
    });
  });

  describe('archive', () => {
    it('should archive a board', () => {
      const createResult = Board.create(
        BoardName.parse('Test Board'),
        organizationId,
        creation
      );
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const board = createResult.value;
        expect(board.isArchived()).toBe(false);

        const archiveResult = board.archive(archivedAt);
        expect(archiveResult.success).toBe(true);
        expect(board.isArchived()).toBe(true);
      }
    });

    it('should fail when already archived', () => {
      const createResult = Board.create(
        BoardName.parse('Test Board'),
        organizationId,
        creation
      );
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const board = createResult.value;
        board.archive(archivedAt);

        const archiveResult = board.archive(archivedAt);
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
