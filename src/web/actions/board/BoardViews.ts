/** Board browser projections retain validated identities and names.
 * Raw membership rows are decoded explicitly; missing organization labels remain presentation text. */
import { z } from 'zod';
import { UserId, type OrganizationId } from '@/domain/shared/EntityIds';
import { FirstName, LastName, MiddleName } from '@/domain/user/UserValues';
import type { Board } from '@/domain/board/Board';

export const BoardMemberView = z.object({
  id: UserId,
  firstName: FirstName,
  lastName: LastName,
  middleName: MiddleName.nullable(),
});
export type BoardMemberView = z.infer<typeof BoardMemberView>;
export type BoardReferenceView = Pick<Board, 'id' | 'name'>;
export type BoardDetailsView = {
  board: Pick<Board, 'id' | 'name' | 'organizationId'>;
  members: BoardMemberView[];
  organizationMembers: BoardMemberView[];
};
export type UserBoardView = Pick<Board, 'id' | 'name' | 'organizationId'> & {
  organizationName: string;
};
export type HomeBoardsView = {
  boardsByOrgId: Partial<Record<OrganizationId, BoardReferenceView[]>>;
  externalBoards: UserBoardView[];
};
