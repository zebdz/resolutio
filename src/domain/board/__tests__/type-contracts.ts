/** Compile-only board clients demonstrate distinct identities and required creation
 * inputs; unused @ts-expect-error directives expose weakened contracts. */
import { Board } from '../Board';
import { BoardName } from '../BoardName';
import { BoardRepository } from '../BoardRepository';
import { BoardId, OrganizationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';

declare const boards: BoardRepository;
declare const board: Board;
const id = BoardId.parse('board-1');
const organizationId = OrganizationId.parse('org-1');
const userId = UserId.parse('user-1');
const now = Instant.parse('2026-10-26T12:00:00.000Z');
Board.create(BoardName.parse('Board'), organizationId, { id, now });
// @ts-expect-error Board creation requires a validated name, not arbitrary text.
Board.create('Board', organizationId, { id, now });
boards.findById(id);
boards.isUserMember(userId, id);
board.archive(now);

// @ts-expect-error A raw name has not passed BoardName validation.
const uncheckedName: BoardName = 'Board';
// @ts-expect-error Organization identity is validated before domain creation.
Board.create(BoardName.parse('Board'), 'org-1', { id, now });
// @ts-expect-error Identity and time are required before creation.
Board.create(BoardName.parse('Board'), organizationId);
Board.create(BoardName.parse('Board'), organizationId, {
  // @ts-expect-error An organization identity cannot identify a board.
  id: organizationId,
  now,
});
// @ts-expect-error Repository lookups cannot interchange entity identities.
boards.findById(organizationId);
// @ts-expect-error Membership requires user identity first, board identity second.
boards.isUserMember(id, userId);
// @ts-expect-error Archive time must be a validated immutable Instant.
board.archive(new Date());
// @ts-expect-error Time must be supplied explicitly.
board.archive();
// @ts-expect-error Core getters expose immutable time values, not mutable Dates.
board.createdAt.setTime(0);
