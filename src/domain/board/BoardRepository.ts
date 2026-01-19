import { Board } from './Board';

export interface BoardRepository {
  /**
   * Saves a new board to the database
   */
  save(board: Board): Promise<Board>;

  /**
   * Finds a board by its ID
   */
  findById(id: string): Promise<Board | null>;

  /**
   * Finds all boards for an organization
   */
  findByOrganizationId(organizationId: string): Promise<Board[]>;

  /**
   * Finds the general board for an organization
   */
  findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null>;

  findBoardMembers(boardId: string): Promise<{ userId: string }[]>;

  /**
   * Checks if a user is a member of a board
   */
  isUserMember(userId: string, boardId: string): Promise<boolean>;

  /**
   * Adds a user to a board
   */
  addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): Promise<void>;

  /**
   * Removes a user from a board
   */
  removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void>;

  /**
   * Updates an existing board
   */
  update(board: Board): Promise<Board>;
}
