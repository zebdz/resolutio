/** Board persistence port exposes validated identities and aggregate/projection data.
 * Raw database strings are decoded by infrastructure before crossing this boundary. */
import { Board } from './Board';
import { BoardName } from './BoardName';
import { BoardId, OrganizationId, UserId } from '../shared/EntityIds';

export interface BoardSummary {
  readonly id: BoardId;
  readonly name: BoardName;
  readonly organizationId: OrganizationId;
}

export interface BoardRepository {
  /**
   * Saves a new board to the database
   */
  save(board: Board): Promise<Board>;

  /**
   * Finds a board by its ID
   */
  findById(id: BoardId): Promise<Board | null>;

  /**
   * Finds all boards for an organization
   */
  findByOrganizationId(organizationId: OrganizationId): Promise<Board[]>;

  findBoardMembers(boardId: BoardId): Promise<{ userId: UserId }[]>;

  /**
   * Checks if a user is a member of a board
   */
  isUserMember(userId: UserId, boardId: BoardId): Promise<boolean>;

  /**
   * Adds a user to a board
   */
  addUserToBoard(
    userId: UserId,
    boardId: BoardId,
    addedBy?: UserId
  ): Promise<void>;

  /**
   * Removes a user from a board
   */
  removeUserFromBoard(
    userId: UserId,
    boardId: BoardId,
    removedBy?: UserId,
    removedReason?: string
  ): Promise<void>;

  /**
   * Updates an existing board
   */
  update(board: Board): Promise<Board>;

  /**
   * Finds all active boards where user is a member (removedAt IS NULL),
   * returns board id, name, and organizationId.
   */
  findActiveBoardsByUserId(userId: UserId): Promise<BoardSummary[]>;
}
