Organization Structure / User Join / Voting Refactor │
│ │
│ Context │
│ │
│ Users can currently only be in one org per hierarchy, and joining a related org is blocked. This is too restrictive - │
│ users should be able to move between orgs in a hierarchy (auto-remove from old, join new). Additionally, parent org │
│ general board votes should include all descendant org members, and "is user member of org X" should include descendant │
│ org membership. │
│ │
│ General boards are redundant - their membership mirrors org membership. We remove them entirely. Polls get organizationId │
│ (required) + nullable boardId. Org-wide polls have boardId=null. │
│ │
│ Design Decisions │
│ │
│ 1. Remove general boards - no Board records with isGeneral=true, no findGeneralBoardByOrganizationId, no auto-add to │
│ board on join │
│ 2. Poll.organizationId (required) + Poll.boardId (nullable). Null boardId = org-wide poll. │
│ 3. Dynamic org membership at snapshot - org-wide poll snapshot uses org members + descendants │
│ 4. Single pending request per hierarchy - must cancel before requesting another │
│ 5. DB can be dropped - no migration needed, just schema change │
│ │
│ --- │
│ Phase 1: Schema + domain model changes │
│ │
│ 1a. Prisma schema │
│ │
│ prisma/schema.prisma: │
│ - Poll model: add organizationId String @map("organization_id") (required), make boardId String? @map("board_id") │
│ (nullable), add Organization relation, add @@index([organizationId]) │
│ - Board model: remove isGeneral field, remove @@index([organizationId, isGeneral]) │
│ - Organization model: add polls Poll[] relation │
│ │
│ 1b. Poll domain model │
│ │
│ src/domain/poll/Poll.ts: │
│ - Add organizationId: string to PollProps │
│ - Make boardId: string | null in PollProps │
│ - Update Poll.create(): accept organizationId (required), boardId (nullable) │
│ - Add organizationId getter │
│ - Update reconstitute() accordingly │
│ │
│ 1c. Board domain model │
│ │
│ src/domain/board/Board.ts: │
│ - Remove isGeneral from BoardProps │
│ - Remove isGeneral param from Board.create() │
│ - Remove isGeneral getter │
│ - Update reconstitute() │
│ │
│ 1d. Board repository │
│ │
│ src/domain/board/BoardRepository.ts: │
│ - Remove findGeneralBoardByOrganizationId() method │
│ │
│ src/infrastructure/repositories/PrismaBoardRepository.ts: │
│ - Remove findGeneralBoardByOrganizationId() implementation │
│ - Remove isGeneral from all save/findById/findByOrganizationId/update methods │
│ │
│ 1e. Poll repository │
│ │
│ src/domain/poll/PollRepository.ts: │
│ - Add getPollsByOrganizationId(orgId): Promise<Result<Poll[], string>> │
│ │
│ src/infrastructure/repositories/PrismaPollRepository.ts: │
│ - Update createPoll(): save organizationId, handle nullable boardId │
│ - Add getPollsByOrganizationId() implementation │
│ - Update all reconstitute calls to include organizationId │
│ │
│ 1f. Board schema │
│ │
│ src/application/board/CreateBoardSchema.ts: │
│ - Remove isGeneral field │
│ │
│ 1g. Tests │
│ │
│ - Update all mock BoardRepository implementations (13 test files) to remove findGeneralBoardByOrganizationId │
│ - Update all mock PollRepository/Poll creation to include organizationId │
│ - Update Board.create() calls to remove isGeneral param │
│ │
│ Files: All **tests**/\*.test.ts files that mock BoardRepository or create Poll/Board objects │
│ │
│ 1h. Run yarn prisma generate + drop/recreate DB │
│ │
│ --- │
│ Phase 2: Remove general board from use cases │
│ │
│ 2a. CreateOrganizationUseCase │
│ │
│ src/application/organization/CreateOrganizationUseCase.ts: │
│ - Remove general board creation (lines 64-72) │
│ - Return type: { organization: Organization } (remove generalBoard) │
│ - Remove boardRepository dependency if unused │
│ │
│ 2b. HandleJoinRequestUseCase │
│ │
│ src/application/organization/HandleJoinRequestUseCase.ts: │
│ - Remove "add user to general board" logic (lines 70-81) │
│ - Remove boardRepository dependency │
│ │
│ 2c. Board use cases │
│ │
│ src/application/board/ArchiveBoardUseCase.ts: │
│ - Remove "cannot archive general board" check (lines 38-41) │
│ │
│ src/application/board/AddBoardMemberUseCase.ts: │
│ - Remove if (board.isGeneral && !isOrgMember) check (lines 66-69) │
│ - All boards now have same add-member rules (user just needs to exist? or still check org membership?) │
│ │
│ src/application/board/CreateBoardUseCase.ts: │
│ - Remove isGeneral handling │
│ │
│ 2d. Tests │
│ │
│ - CreateOrganizationUseCase.test.ts: remove general board tests, update return type assertions │
│ - HandleJoinRequestUseCase.test.ts: remove "add to general board" test │
│ - ArchiveBoardUseCase.test.ts: remove "fail when archiving general board" test │
│ - AddBoardMemberUseCase.test.ts: remove general board member check test │
│ - CreateBoardUseCase.test.ts: remove isGeneral tests │
│ │
│ --- │
│ Phase 3: Poll use cases - use organizationId directly │
│ │
│ 3a. Simplify auth pattern in all poll use cases │
│ │
│ Currently: poll.boardId → board → board.organizationId → org admin check │
│ New: poll.organizationId → org admin check (skip board lookup for auth) │
│ │
│ Use cases to update (same pattern in each - replace board lookup for auth with direct poll.organizationId): │
│ ┌───────────────────────────────────┬────────┐ │
│ │ File │ Lines │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ ActivatePollUseCase.ts │ 42-50 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ DeactivatePollUseCase.ts │ 39-50 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ FinishPollUseCase.ts │ 41-50 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ DiscardSnapshotUseCase.ts │ 48-60 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ GetParticipantsUseCase.ts │ 60-68 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ RemoveParticipantUseCase.ts │ 58-67 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ UpdateParticipantWeightUseCase.ts │ 63-71 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ GetPollResultsUseCase.ts │ 77-104 │ │
│ ├───────────────────────────────────┼────────┤ │
│ │ GetWeightHistoryUseCase.ts │ 61-73 │ │
│ └───────────────────────────────────┴────────┘ │
│ For each: remove boardRepository.findById(poll.boardId) for auth, use poll.organizationId directly. Some may still need │
│ board for other purposes (e.g., TakeSnapshot needs board members). │
│ │
│ 3b. CreatePollUseCase │
│ │
│ src/application/poll/CreatePollUseCase.ts: │
│ - Accept organizationId (required) + boardId (optional) │
│ - If boardId provided: validate board exists, check board membership │
│ - If boardId null (org-wide poll): check org membership instead │
│ - Pass both to Poll.create() │
│ │
│ 3c. TakeSnapshotUseCase │
│ │
│ src/application/poll/TakeSnapshotUseCase.ts: │
│ - If poll.boardId is not null: use boardRepository.findBoardMembers(poll.boardId) (unchanged) │
│ - If poll.boardId is null (org-wide): use org members + descendants │
│ - Auth check: use poll.organizationId directly │
│ │
│ 3d. Tests │
│ │
│ - Update all poll use case tests to use organizationId on polls │
│ - TakeSnapshotUseCase.test.ts: test org-wide poll includes org members + descendants, deduplication │
│ - CreatePollUseCase.test.ts: test org-wide poll creation, board-specific poll creation │
│ - All other poll tests: update mock poll creation to include organizationId │
│ │
│ --- │
│ Phase 4: Join flow refactor [COMPLETE] │
│ │
│ 4a. New repo methods │
│ │
│ OrganizationRepository (src/domain/organization/OrganizationRepository.ts): │
│ - Add removeUserFromOrganization(userId, orgId) - deletes OrganizationUser row │
│ - Add findPendingRequestsByUserId(userId) - returns orgs where user has status=pending │
│ │
│ 4b. New CancelJoinRequestUseCase │
│ │
│ src/application/organization/CancelJoinRequestUseCase.ts (new): │
│ - Input: organizationId, userId │
│ - Validate: request exists and is pending │
│ - Delete OrganizationUser row │
│ │
│ 4c. Modify JoinOrganizationUseCase │
│ │
│ src/application/organization/JoinOrganizationUseCase.ts: │
│ - Remove HIERARCHY_CONFLICT error for accepted memberships │
│ - Add: block if pending request anywhere in hierarchy → PENDING_HIERARCHY_REQUEST │
│ - Keep existing PENDING_REQUEST check for same org │
│ │
│ 4d. Modify HandleJoinRequestUseCase │
│ │
│ src/application/organization/HandleJoinRequestUseCase.ts: │
│ - On accept: find user's existing accepted memberships in hierarchy orgs │
│ - For each old org: delete OrganizationUser row (keep non-general board memberships, keep admin status) │
│ - Cancelled request → REQUEST_NOT_FOUND. Stale view → NOT_PENDING. │
│ - Needs new deps: organizationRepository │
│ │
│ 4e. Expand isUserMember to include descendants │
│ │
│ src/infrastructure/repositories/PrismaOrganizationRepository.ts: │
│ - isUserMember(userId, orgId) checks: member of orgId OR any descendant │
│ - Add findAcceptedMemberUserIdsIncludingDescendants(orgId) for snapshot │
│ │
│ 4f. Server action + UI for cancel │
│ │
│ src/web/actions/organization.ts: │
│ - Add cancelJoinRequestAction(organizationId) │
│ - "My Organizations" page: add cancel button on pending requests │
│ │
│ 4g. Tests │
│ │
│ CancelJoinRequestUseCase.test.ts (new): │
│ - should cancel a pending request │
│ - should fail if not found │
│ - should fail if not pending │
│ │
│ JoinOrganizationUseCase.test.ts: │
│ - "should allow join request when member of parent org" (was: should fail) │
│ - "should allow join request when member of child org" (was: should fail) │
│ - should fail if pending request in parent org (PENDING_HIERARCHY_REQUEST) │
│ - should fail if pending request in child org (PENDING_HIERARCHY_REQUEST) │
│ - should allow after cancelling previous hierarchy request │
│ │
│ HandleJoinRequestUseCase.test.ts: │
│ - should remove user from parent org membership when accepting into child org │
│ - should remove user from child org membership when accepting into parent org │
│ - should NOT remove user from non-general boards of old org │
│ - should NOT remove admin status from old org │
│ - should return REQUEST_NOT_FOUND when cancelled │
│ - should return NOT_PENDING when already handled │
│ │
│ isUserMember tests: │
│ - returns true for descendant org member │
│ - findAcceptedMemberUserIdsIncludingDescendants: includes descendants, deduplicates │
│ │
│ --- │
│ Phase 5: Web actions + UI │
│ │
│ 5a. Poll web actions │
│ │
│ src/web/actions/poll.ts: │
│ - getUserPollsAction(): use poll.organizationId directly (remove board lookup) │
│ - canManagePollAction(): use poll.organizationId directly │
│ - Update poll creation action to accept organizationId + optional boardId │
│ │
│ 5b. Board web actions │
│ │
│ src/web/actions/board.ts: │
│ - createBoardAction(): remove isGeneral handling │
│ - getBoardDetailsAction(): remove isGeneral from response; organizationMembers includes descendants │
│ - getUserBoardsAction(): remove isGeneral from response │
│ - searchUsersForBoardAction(): remove isGeneral checks; expand org member set to include descendants │
│ │
│ 5c. UI pages │
│ │
│ - Organization detail page: remove general board conditional rendering │
│ - Board manage pages: remove isGeneral conditionals │
│ - AddOutsideMemberSection.tsx: remove isGeneral prop/logic │
│ - CreateBoardDialog.tsx: remove isGeneral hidden field │
│ - Poll creation page: support org-wide polls (no board selected) │
│ - Participants page: use poll.organizationId directly │
│ │
│ 5d. Tests │
│ │
│ - Board details action returns child org members in organizationMembers list │
│ │
│ --- │
│ Verification │
│ │
│ 1. yarn prisma generate + recreate DB │
│ 2. Run all tests per phase │
│ 3. Manual: create parent org A + child org B. User joins B, requests join A → accepted → removed from B membership, keeps │
│ non-general board memberships │
│ 4. Manual: create org-wide poll → snapshot includes org members + descendant org members │
│ 5. Manual: create board-specific poll → snapshot includes only board members │
│ 6. Manual: board manage page shows descendant org members in add dropdown │
│ │
│ --- │
│ Resolved Decisions │
│ │
│ 1. Active polls: Keep participation - snapshot is already locked │
│ 2. Pending join requests: Only one pending per hierarchy. User can cancel. │
│ 3. Admin status: Keep admin status in old org on move │
│ 4. isUserAdmin: No cascade down - per-org only │
│ 5. Board memberships on move: Keep non-general board memberships │
│ 6. General boards: Removed entirely. Org-wide polls have boardId=null. │
│ │
│ New error codes │
│ │
│ - PENDING_HIERARCHY_REQUEST = organization.errors.pendingHierarchyRequest │
│ - Add translations in messages/en.json and messages/ru.json │
│ │
│ Resolved: Board membership rules │
│ │
│ Any user can be added to any board. UI keeps two sections: org members + descendants in one list, outside user search in │
│ another (same as current non-general board behavior).
