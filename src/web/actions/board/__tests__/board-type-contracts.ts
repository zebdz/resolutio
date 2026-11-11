/** Actual board action clients retain board/user identities and validated board names. */
import type {
  createBoardAction,
  getBoardDetailsAction,
  getUserBoardsAction,
  searchUsersForBoardAction,
  getBoardsByOrganizationAction,
  getUserBoardsForHomeAction,
} from '../board';
import { OrganizationId } from '@/domain/shared/EntityIds';

type Data<F extends (...args: never[]) => unknown> =
  Awaited<ReturnType<F>> extends infer Result
    ? Result extends { success: true; data: infer Value }
      ? Value
      : never
    : never;
// @ts-expect-error Created boards retain board identity.
const wrongCreated: Data<typeof createBoardAction>['boardId'] =
  OrganizationId.parse('org');
// @ts-expect-error Board members retain user identity.
const wrongMember: Data<typeof getBoardDetailsAction>['members'][number]['id'] =
  OrganizationId.parse('org');
// @ts-expect-error Membership lists retain board identity.
const rawBoard: Data<typeof getUserBoardsAction>[number]['id'] = 'board';
// @ts-expect-error Invite search results retain user identity.
const wrongCandidate: Data<typeof searchUsersForBoardAction>[number]['id'] =
  OrganizationId.parse('org');
// @ts-expect-error Board lookups retain validated names.
const rawName: Data<typeof getBoardsByOrganizationAction>[number]['name'] = '';
// @ts-expect-error Home projections retain board identity.
const rawExternal: Data<
  typeof getUserBoardsForHomeAction
>['externalBoards'][number]['id'] = 'board';
