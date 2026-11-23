# Leave Organization & Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users voluntarily leave organizations and boards from the home page, with a choice to also leave boards when leaving an org.

**Architecture:** Two new use cases (`LeaveBoardUseCase`, `LeaveOrganizationUseCase`) following existing DDD patterns. Board leave = soft-delete (`removedAt`), org leave = hard-delete (`OrganizationUser`). Two new notification use cases for admin alerts. Home page gets collapsible board lists inside org cards and a new "external boards" section. Two new server actions, one new data-fetching action.

**Tech Stack:** Prisma (queries), Zod (validation), Vitest (tests), React + Headless UI (dialogs, checkboxes), Tailwind (styling), next-intl (i18n).

---

## File Map

### Task 1 — Error Codes + Localization

- Modify: `src/application/board/BoardErrors.ts`
- Modify: `src/application/organization/OrganizationErrors.ts`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

### Task 2 — LeaveBoardUseCase (TDD)

- Create: `src/application/board/LeaveBoardUseCase.ts`
- Create: `src/application/board/__tests__/LeaveBoardUseCase.test.ts`

### Task 3 — LeaveOrganizationUseCase (TDD)

- Create: `src/application/organization/LeaveOrganizationUseCase.ts`
- Create: `src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts`

### Task 4 — Notification Use Cases

- Create: `src/application/notification/NotifyMemberLeftBoardUseCase.ts`
- Create: `src/application/notification/NotifyMemberLeftOrganizationUseCase.ts`

### Task 5 — BoardRepository: new method

- Modify: `src/domain/board/BoardRepository.ts`
- Modify: `src/infrastructure/repositories/PrismaBoardRepository.ts`

### Task 6 — Server Actions

- Modify: `src/web/actions/board/board.ts`
- Modify: `src/web/actions/organization/organization.ts`

### Task 7 — Data Fetching: getUserBoardsForHomeAction

- Modify: `src/web/actions/board/board.ts`

### Task 8 — UI: Leave Board Dialog

- Create: `src/app/[locale]/home/LeaveBoardDialog.tsx`

### Task 9 — UI: Leave Organization Dialog

- Create: `src/app/[locale]/home/LeaveOrganizationDialog.tsx`

### Task 10 — UI: Home Page (collapsible boards + external boards + leave buttons)

- Modify: `src/app/[locale]/home/UserOrganizationsList.tsx`
- Modify: `src/app/[locale]/home/page.tsx`

---

## Task 1: Error Codes + Localization

**Files:**

- Modify: `src/application/board/BoardErrors.ts`
- Modify: `src/application/organization/OrganizationErrors.ts`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add board error code**

In `src/application/board/BoardErrors.ts`, add after `NOT_MEMBER`:

```typescript
LEAVE_FAILED: 'board.errors.leaveFailed',
```

- [ ] **Step 2: Add org error code**

In `src/application/organization/OrganizationErrors.ts`, add after `NOT_ROOT_ORG`:

```typescript
NOT_MEMBER: 'organization.errors.notMember',
```

- [ ] **Step 3: Add English localization keys**

In `messages/en.json`, add to `board.errors`:

```json
"leaveFailed": "Failed to leave the board"
```

Add to `organization.errors`:

```json
"notMember": "You are not a member of this organization"
```

Add to `home`:

```json
"myBoards": "My Boards",
"externalBoards": "External Boards",
"leaveOrganization": "Leave",
"leaveBoard": "Leave",
"leaveOrgConfirmTitle": "Leave Organization",
"leaveOrgConfirmDescription": "Are you sure you want to leave {orgName}?",
"leaveOrgBoardsPrompt": "You are a member of these boards. Select which to also leave:",
"leaveBoardConfirmTitle": "Leave Board",
"leaveBoardConfirmDescription": "Are you sure you want to leave the board \"{boardName}\"?",
"leaving": "Leaving...",
"leaveSuccess": "Successfully left",
"noBoards": "No boards"
```

Add to `notification.types`:

```json
"memberLeftBoard": {
  "title": "Member left board",
  "body": "{memberName} left the board \"{boardName}\" in {organizationName}"
},
"memberLeftOrganization": {
  "title": "Member left organization",
  "body": "{memberName} left the organization {organizationName}"
}
```

- [ ] **Step 4: Add Russian localization keys**

In `messages/ru.json`, add to `board.errors`:

```json
"leaveFailed": "Не удалось покинуть орган управления"
```

Add to `organization.errors`:

```json
"notMember": "Вы не являетесь участником этой организ��ции"
```

Add to `home`:

```json
"myBoards": "Мои органы управления",
"externalBoards": "Внешние органы управления",
"leaveOrganization": "Покинуть",
"leaveBoard": "Покинуть",
"leaveOrgConfirmTitle": "Покинуть организацию",
"leaveOrgConfirmDescription": "Вы уверен��, что хотите покинуть {orgName}?",
"leaveOrgBoardsPrompt": "Вы являетесь участником следующих органов управления. Выберите, какие также покинуть:",
"leaveBoardConfirmTitle": "Покинуть орган управления",
"leaveBoardConfirmDescription": "Вы уверены, что хотите покинуть орган управления «{boardName}»?",
"leaving": "Выход...",
"leaveSuccess": "Вы успешно вышли",
"noBoards": "Нет органов управления"
```

Add to `notification.types`:

```json
"memberLeftBoard": {
  "title": "Уч��стник покинул орга�� управления",
  "body": "{memberName} покинул(а) орган управления «{boardName}» в {organizationName}"
},
"memberLeftOrganization": {
  "title": "Участник покинул организацию",
  "body": "{memberName} покинул(а) организацию {organizationName}"
}
```

- [ ] **Step 5: Commit**

```bash
git add src/application/board/BoardErrors.ts src/application/organization/OrganizationErrors.ts messages/en.json messages/ru.json
git commit -m "feat: error codes + i18n for leave org/board"
```

---

## Task 2: LeaveBoardUseCase (TDD)

**Files:**

- Create: `src/application/board/__tests__/LeaveBoardUseCase.test.ts`
- Create: `src/application/board/LeaveBoardUseCase.ts`

- [ ] **Step 1: Write failing tests**

Create `src/application/board/__tests__/LeaveBoardUseCase.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { LeaveBoardUseCase } from '../LeaveBoardUseCase';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Reuse the same mock classes pattern from RemoveBoardMemberUseCase.test.ts
// Copy MockBoardRepository, MockOrganizationRepository, MockUserRepository, MockNotificationRepository
// from src/application/board/__tests__/RemoveBoardMemberUseCase.test.ts
// (they implement the same interfaces)

describe('LeaveBoardUseCase', () => {
  let useCase: LeaveBoardUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    useCase = new LeaveBoardUseCase({
      boardRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });
  });

  describe('when board does not exist', () => {
    it('should return failure with NOT_FOUND', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'non-existent',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('board.errors.notFound');
      }
    });
  });

  describe('when board is archived', () => {
    beforeEach(() => {
      const orgResult = Organization.create('Test Org', 'Desc', 'creator-1');
      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
      }

      const boardResult = Board.create('Test Board', 'org-1');
      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        board.archive();
        boardRepository.addBoard(board);
      }
    });

    it('should return failure with BOARD_ARCHIVED', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('board.errors.boardArchived');
      }
    });
  });

  describe('when user is not a board member', () => {
    beforeEach(() => {
      const orgResult = Organization.create('Test Org', 'Desc', 'creator-1');
      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
      }

      const boardResult = Board.create('Test Board', 'org-1');
      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
      }
    });

    it('should return failure with NOT_MEMBER', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('board.errors.notMember');
      }
    });
  });

  describe('when user is a board member', () => {
    beforeEach(() => {
      const orgResult = Organization.create('Test Org', 'Desc', 'creator-1');
      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
        organizationRepository.addAdmin('org-1', 'admin-1');
      }

      const boardResult = Board.create('Test Board', 'org-1');
      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
      }

      boardRepository.addUserToBoard('user-1', 'board-1');

      const phoneResult = PhoneNumber.create('+71234567890');
      if (phoneResult.success) {
        const userResult = User.create(
          'John',
          'Doe',
          null,
          phoneResult.value,
          'ru'
        );
        if (userResult.success) {
          (userResult.value as any).props.id = 'user-1';
          userRepository.addUser(userResult.value);
        }
      }
    });

    it('should successfully leave the board', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(true);

      const isMember = await boardRepository.isUserMember('user-1', 'board-1');
      expect(isMember).toBe(false);
    });

    it('should send notification to org admins', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(true);
      // Notification is fire-and-forget, just verify no crash
    });
  });
});
```

Note: Copy the mock classes from `src/application/board/__tests__/RemoveBoardMemberUseCase.test.ts` (MockBoardRepository, MockOrganizationRepository, MockUserRepository, MockNotificationRepository). They implement the same interfaces. Add `findAdminUserIds` to MockOrganizationRepository if not present:

```typescript
async findAdminUserIds(organizationId: string): Promise<string[]> {
  const admins = this.admins.get(organizationId);
  return admins ? Array.from(admins) : [];
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/board/__tests__/LeaveBoardUseCase.test.ts`
Expected: FAIL — `LeaveBoardUseCase` does not exist

- [ ] **Step 3: Implement LeaveBoardUseCase**

Create `src/application/board/LeaveBoardUseCase.ts`:

```typescript
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors } from './BoardErrors';
import { User } from '../../domain/user/User';
import { NotifyMemberLeftBoardUseCase } from '../notification/NotifyMemberLeftBoardUseCase';

export interface LeaveBoardInput {
  userId: string;
  boardId: string;
}

export interface LeaveBoardDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class LeaveBoardUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: LeaveBoardDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(input: LeaveBoardInput): Promise<Result<void, string>> {
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(BoardErrors.NOT_FOUND);
    }

    if (board.isArchived()) {
      return failure(BoardErrors.BOARD_ARCHIVED);
    }

    const isMember = await this.boardRepository.isUserMember(
      input.userId,
      input.boardId
    );

    if (!isMember) {
      return failure(BoardErrors.NOT_MEMBER);
    }

    await this.boardRepository.removeUserFromBoard(
      input.userId,
      input.boardId,
      input.userId,
      'left_voluntarily'
    );

    // Fire-and-forget notification to org admins
    const user = await this.userRepository.findById(input.userId);
    const memberName = user
      ? User.formatFullName(user.firstName, user.lastName, user.middleName)
      : '';
    const organization = await this.organizationRepository.findById(
      board.organizationId
    );

    new NotifyMemberLeftBoardUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        organizationId: board.organizationId,
        organizationName: organization?.name ?? '',
        boardId: board.id,
        boardName: board.name,
        memberName,
      })
      .catch((err) =>
        console.error('Failed to notify member left board:', err)
      );

    return success(undefined);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/board/__tests__/LeaveBoardUseCase.test.ts`
Expected: PASS (notification use case doesn't exist yet but it's fire-and-forget with .catch — tests still pass because the catch swallows the error. However, the import will fail. Create a stub first — see Task 4 Step 1 note.)

**Important:** If the import fails because `NotifyMemberLeftBoardUseCase` doesn't exist yet, create a minimal stub first:

Create `src/application/notification/NotifyMemberLeftBoardUseCase.ts`:

```typescript
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';

export interface NotifyMemberLeftBoardDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMemberLeftBoardUseCase {
  constructor(private deps: NotifyMemberLeftBoardDependencies) {}

  async execute(_input: {
    organizationId: string;
    organizationName: string;
    boardId: string;
    boardName: string;
    memberName: string;
  }): Promise<void> {
    // Stub — implemented in Task 4
  }
}
```

Then re-run the tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/board/LeaveBoardUseCase.ts src/application/board/__tests__/LeaveBoardUseCase.test.ts src/application/notification/NotifyMemberLeftBoardUseCase.ts
git commit -m "feat: LeaveBoardUseCase with tests"
```

---

## Task 3: LeaveOrganizationUseCase (TDD)

**Files:**

- Create: `src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts`
- Create: `src/application/organization/LeaveOrganizationUseCase.ts`

- [ ] **Step 1: Write failing tests**

Create `src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { LeaveOrganizationUseCase } from '../LeaveOrganizationUseCase';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Copy mock classes from RemoveBoardMemberUseCase.test.ts
// Add to MockOrganizationRepository:
//   - members: Map<string, Set<string>> for tracking org memberships
//   - isUserMember override that checks this.members
//   - removeUserFromOrganization that deletes from this.members
//   - findAdminUserIds that returns admin set
//   - addMember(orgId, userId) helper

describe('LeaveOrganizationUseCase', () => {
  let useCase: LeaveOrganizationUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    useCase = new LeaveOrganizationUseCase({
      boardRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'non-existent',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('organization.errors.notFound');
      }
    });
  });

  describe('when organization is archived', () => {
    beforeEach(() => {
      const orgResult = Organization.create('Test Org', 'Desc', 'creator-1');
      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        org.archive();
        organizationRepository.addOrganization(org);
      }
    });

    it('should return failure with ARCHIVED', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('organization.errors.archived');
      }
    });
  });

  describe('when user is not a member', () => {
    beforeEach(() => {
      const orgResult = Organization.create('Test Org', 'Desc', 'creator-1');
      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
      }
    });

    it('should return failure with NOT_MEMBER', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('organization.errors.notMember');
      }
    });
  });

  describe('when user is a member', () => {
    beforeEach(() => {
      const orgResult = Organization.create('Test Org', 'Desc', 'creator-1');
      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
        organizationRepository.addAdmin('org-1', 'admin-1');
        organizationRepository.addMember('org-1', 'user-1');
      }

      const phoneResult = PhoneNumber.create('+71234567890');
      if (phoneResult.success) {
        const userResult = User.create(
          'John',
          'Doe',
          null,
          phoneResult.value,
          'ru'
        );
        if (userResult.success) {
          (userResult.value as any).props.id = 'user-1';
          userRepository.addUser(userResult.value);
        }
      }
    });

    it('should successfully leave the organization', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(true);

      const isMember = await organizationRepository.isUserMember(
        'user-1',
        'org-1'
      );
      expect(isMember).toBe(false);
    });

    it('should also leave selected boards', async () => {
      const boardResult = Board.create('Board 1', 'org-1');
      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
        await boardRepository.addUserToBoard('user-1', 'board-1');
      }

      const boardResult2 = Board.create('Board 2', 'org-1');
      if (boardResult2.success) {
        const board = boardResult2.value;
        (board as any).props.id = 'board-2';
        boardRepository.addBoard(board);
        await boardRepository.addUserToBoard('user-1', 'board-2');
      }

      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: ['board-1'],
      });

      expect(result.success).toBe(true);

      // Board 1: left
      const isMember1 = await boardRepository.isUserMember('user-1', 'board-1');
      expect(isMember1).toBe(false);

      // Board 2: still a member
      const isMember2 = await boardRepository.isUserMember('user-1', 'board-2');
      expect(isMember2).toBe(true);
    });

    it('should skip board removal if board does not exist', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: ['non-existent-board'],
      });

      // Should still succeed — org membership removed
      expect(result.success).toBe(true);
    });
  });
});
```

Extend MockOrganizationRepository with member tracking:

```typescript
private members: Map<string, Set<string>> = new Map();

async isUserMember(userId: string, organizationId: string): Promise<boolean> {
  const members = this.members.get(organizationId);
  return members ? members.has(userId) : false;
}

async removeUserFromOrganization(userId: string, organizationId: string): Promise<void> {
  const members = this.members.get(organizationId);
  if (members) {
    members.delete(userId);
  }
}

async findAdminUserIds(organizationId: string): Promise<string[]> {
  const admins = this.admins.get(organizationId);
  return admins ? Array.from(admins) : [];
}

addMember(organizationId: string, userId: string): void {
  if (!this.members.has(organizationId)) {
    this.members.set(organizationId, new Set());
  }
  this.members.get(organizationId)!.add(userId);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts`
Expected: FAIL — `LeaveOrganizationUseCase` does not exist

- [ ] **Step 3: Implement LeaveOrganizationUseCase**

Create `src/application/organization/LeaveOrganizationUseCase.ts`:

```typescript
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { User } from '../../domain/user/User';
import { NotifyMemberLeftOrganizationUseCase } from '../notification/NotifyMemberLeftOrganizationUseCase';

export interface LeaveOrganizationInput {
  userId: string;
  organizationId: string;
  boardIdsToLeave: string[];
}

export interface LeaveOrganizationDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class LeaveOrganizationUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: LeaveOrganizationDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(input: LeaveOrganizationInput): Promise<Result<void, string>> {
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    const isMember = await this.organizationRepository.isUserMember(
      input.userId,
      input.organizationId
    );

    if (!isMember) {
      return failure(OrganizationErrors.NOT_MEMBER);
    }

    // Leave selected boards (soft-delete)
    for (const boardId of input.boardIdsToLeave) {
      const board = await this.boardRepository.findById(boardId);

      if (!board || board.isArchived()) {
        continue;
      }

      const isBoardMember = await this.boardRepository.isUserMember(
        input.userId,
        boardId
      );

      if (!isBoardMember) {
        continue;
      }

      await this.boardRepository.removeUserFromBoard(
        input.userId,
        boardId,
        input.userId,
        'left_voluntarily'
      );
    }

    // Leave organization (hard-delete)
    await this.organizationRepository.removeUserFromOrganization(
      input.userId,
      input.organizationId
    );

    // Fire-and-forget notification to org admins
    const user = await this.userRepository.findById(input.userId);
    const memberName = user
      ? User.formatFullName(user.firstName, user.lastName, user.middleName)
      : '';

    new NotifyMemberLeftOrganizationUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        organizationId: input.organizationId,
        organizationName: organization.name,
        memberName,
      })
      .catch((err) =>
        console.error('Failed to notify member left organization:', err)
      );

    return success(undefined);
  }
}
```

- [ ] **Step 4: Create NotifyMemberLeftOrganizationUseCase stub**

Create `src/application/notification/NotifyMemberLeftOrganizationUseCase.ts`:

```typescript
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';

export interface NotifyMemberLeftOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMemberLeftOrganizationUseCase {
  constructor(private deps: NotifyMemberLeftOrganizationDependencies) {}

  async execute(_input: {
    organizationId: string;
    organizationName: string;
    memberName: string;
  }): Promise<void> {
    // Stub — implemented in Task 4
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/application/organization/LeaveOrganizationUseCase.ts src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts src/application/notification/NotifyMemberLeftOrganizationUseCase.ts
git commit -m "feat: LeaveOrganizationUseCase with tests"
```

---

## Task 4: Notification Use Cases

**Files:**

- Modify: `src/application/notification/NotifyMemberLeftBoardUseCase.ts` (replace stub)
- Modify: `src/application/notification/NotifyMemberLeftOrganizationUseCase.ts` (replace stub)

- [ ] **Step 1: Implement NotifyMemberLeftBoardUseCase**

Replace the stub in `src/application/notification/NotifyMemberLeftBoardUseCase.ts`:

```typescript
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberLeftBoardDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMemberLeftBoardUseCase {
  constructor(private deps: NotifyMemberLeftBoardDependencies) {}

  async execute(input: {
    organizationId: string;
    organizationName: string;
    boardId: string;
    boardName: string;
    memberName: string;
  }): Promise<void> {
    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(
        input.organizationId
      );

    if (adminUserIds.length === 0) {
      return;
    }

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'member_left_board',
          title: 'notification.types.memberLeftBoard.title',
          body: 'notification.types.memberLeftBoard.body',
          data: {
            organizationId: input.organizationId,
            organizationName: input.organizationName,
            boardId: input.boardId,
            boardName: input.boardName,
            memberName: input.memberName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
```

- [ ] **Step 2: Implement NotifyMemberLeftOrganizationUseCase**

Replace the stub in `src/application/notification/NotifyMemberLeftOrganizationUseCase.ts`:

```typescript
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberLeftOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMemberLeftOrganizationUseCase {
  constructor(private deps: NotifyMemberLeftOrganizationDependencies) {}

  async execute(input: {
    organizationId: string;
    organizationName: string;
    memberName: string;
  }): Promise<void> {
    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(
        input.organizationId
      );

    if (adminUserIds.length === 0) {
      return;
    }

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'member_left_organization',
          title: 'notification.types.memberLeftOrganization.title',
          body: 'notification.types.memberLeftOrganization.body',
          data: {
            organizationId: input.organizationId,
            organizationName: input.organizationName,
            memberName: input.memberName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
```

- [ ] **Step 3: Run all tests**

Run: `yarn vitest run src/application/board/__tests__/LeaveBoardUseCase.test.ts src/application/organization/__tests__/LeaveOrganizationUseCase.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/application/notification/NotifyMemberLeftBoardUseCase.ts src/application/notification/NotifyMemberLeftOrganizationUseCase.ts
git commit -m "feat: notification use cases for member leaving board/org"
```

---

## Task 5: BoardRepository — new method `findUserBoardsByOrganizations`

We need a new repo method to fetch all boards a user belongs to, grouped by org, plus external boards.

**Files:**

- Modify: `src/domain/board/BoardRepository.ts`
- Modify: `src/infrastructure/repositories/PrismaBoardRepository.ts`

- [ ] **Step 1: Add interface method**

In `src/domain/board/BoardRepository.ts`, add before the closing `}`:

```typescript
  /**
   * Finds all active boards where user is a member (removedAt IS NULL),
   * returns board id, name, and organizationId.
   */
  findActiveBoardsByUserId(
    userId: string
  ): Promise<Array<{ id: string; name: string; organizationId: string }>>;
```

- [ ] **Step 2: Implement in PrismaBoardRepository**

In `src/infrastructure/repositories/PrismaBoardRepository.ts`, add at the end of the class:

```typescript
  async findActiveBoardsByUserId(
    userId: string
  ): Promise<Array<{ id: string; name: string; organizationId: string }>> {
    const boards = await this.prisma.board.findMany({
      where: {
        archivedAt: null,
        boardUsers: {
          some: {
            userId,
            removedAt: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
      orderBy: { name: 'asc' },
    });

    return boards;
  }
```

- [ ] **Step 3: Update mock in existing tests**

Any test file with a `MockBoardRepository` that implements `BoardRepository` will fail to compile after adding the new method. Add this stub to each mock class:

```typescript
async findActiveBoardsByUserId(
  _userId: string
): Promise<Array<{ id: string; name: string; organizationId: string }>> {
  return [];
}
```

This includes mocks in:

- `src/application/board/__tests__/LeaveBoardUseCase.test.ts`
- `src/application/board/__tests__/RemoveBoardMemberUseCase.test.ts`
- Any other test files with `MockBoardRepository`

- [ ] **Step 4: Run all board tests to verify nothing broke**

Run: `yarn vitest run src/application/board/__tests__/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/board/BoardRepository.ts src/infrastructure/repositories/PrismaBoardRepository.ts src/application/board/__tests__/ src/application/organization/__tests__/
git commit -m "feat: BoardRepository.findActiveBoardsByUserId"
```

---

## Task 6: Server Actions

**Files:**

- Modify: `src/web/actions/board/board.ts`
- Modify: `src/web/actions/organization/organization.ts`

- [ ] **Step 1: Add leaveBoardAction**

In `src/web/actions/board/board.ts`, add the `LeaveBoardUseCase` import and instantiation alongside the existing use cases:

```typescript
import { LeaveBoardUseCase } from '@/application/board/LeaveBoardUseCase';
```

After the existing use case instantiations (after `removeBoardMemberUseCase`):

```typescript
const leaveBoardUseCase = new LeaveBoardUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
});
```

Add the action at the end of the file:

```typescript
export async function leaveBoardAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const boardId = formData.get('boardId') as string;

    if (!boardId) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await leaveBoardUseCase.execute({
      userId: user.id,
      boardId,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error leaving board:', error);

    return { success: false, error: t('generic') };
  }
}
```

- [ ] **Step 2: Add leaveOrganizationAction**

In `src/web/actions/organization/organization.ts`, add imports:

```typescript
import { LeaveOrganizationUseCase } from '@/application/organization/LeaveOrganizationUseCase';
```

You'll also need `PrismaBoardRepository` if not already imported. Check the existing imports — the org action file may not have board repo yet. If not, add:

```typescript
import { PrismaBoardRepository } from '@/infrastructure/index';
```

And instantiate:

```typescript
const boardRepository = new PrismaBoardRepository(prisma);
```

Then instantiate the use case:

```typescript
const leaveOrganizationUseCase = new LeaveOrganizationUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
});
```

Add the action:

```typescript
export async function leaveOrganizationAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const organizationId = formData.get('organizationId') as string;
    const boardIdsJson = formData.get('boardIdsToLeave') as string;

    if (!organizationId) {
      return { success: false, error: t('validationFailed') };
    }

    const boardIdsToLeave: string[] = boardIdsJson
      ? JSON.parse(boardIdsJson)
      : [];

    const result = await leaveOrganizationUseCase.execute({
      userId: user.id,
      organizationId,
      boardIdsToLeave,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error leaving organization:', error);

    return { success: false, error: t('generic') };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/web/actions/board/board.ts src/web/actions/organization/organization.ts
git commit -m "feat: leaveBoardAction + leaveOrganizationAction"
```

---

## Task 7: Data Fetching — getUserBoardsForHomeAction

**Files:**

- Modify: `src/web/actions/board/board.ts`

- [ ] **Step 1: Add getUserBoardsForHomeAction**

This action fetches the user's active boards grouped by org, and separates external boards (where user is board member but not org member).

In `src/web/actions/board/board.ts`, add at the end:

```typescript
export async function getUserBoardsForHomeAction(): Promise<
  ActionResult<{
    boardsByOrgId: Record<string, Array<{ id: string; name: string }>>;
    externalBoards: Array<{
      id: string;
      name: string;
      organizationId: string;
      organizationName: string;
    }>;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const boards = await boardRepository.findActiveBoardsByUserId(user.id);

    // Group boards by orgId
    const boardsByOrgId: Record<
      string,
      Array<{ id: string; name: string }>
    > = {};
    const externalBoardCandidates: Array<{
      id: string;
      name: string;
      organizationId: string;
    }> = [];

    for (const board of boards) {
      const isMember = await organizationRepository.isUserMember(
        user.id,
        board.organizationId
      );

      if (isMember) {
        if (!boardsByOrgId[board.organizationId]) {
          boardsByOrgId[board.organizationId] = [];
        }

        boardsByOrgId[board.organizationId].push({
          id: board.id,
          name: board.name,
        });
      } else {
        externalBoardCandidates.push(board);
      }
    }

    // Resolve org names for external boards
    const externalBoards = await Promise.all(
      externalBoardCandidates.map(async (board) => {
        const org = await organizationRepository.findById(board.organizationId);

        return {
          id: board.id,
          name: board.name,
          organizationId: board.organizationId,
          organizationName: org?.name ?? '',
        };
      })
    );

    return {
      success: true,
      data: { boardsByOrgId, externalBoards },
    };
  } catch (error) {
    console.error('Error getting user boards for home:', error);

    return { success: false, error: t('generic') };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/web/actions/board/board.ts
git commit -m "feat: getUserBoardsForHomeAction"
```

---

## Task 8: UI — LeaveBoardDialog

**Files:**

- Create: `src/app/[locale]/home/LeaveBoardDialog.tsx`

- [ ] **Step 1: Create LeaveBoardDialog**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { leaveBoardAction } from '@/src/web/actions/board/board';

interface LeaveBoardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  board: { id: string; name: string };
}

export function LeaveBoardDialog({
  isOpen,
  onClose,
  board,
}: LeaveBoardDialogProps) {
  const t = useTranslations('home');
  const tErrors = useTranslations('common.errors');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set('boardId', board.id);

    const result = await leaveBoardAction(formData);

    if (result.success) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('leaveBoardConfirmTitle')}</DialogTitle>
      <DialogDescription>
        {t('leaveBoardConfirmDescription', { boardName: board.name })}
      </DialogDescription>
      <DialogBody>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="zinc" onClick={handleClose} disabled={isLoading}>
          {tErrors('cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? t('leaving') : t('leaveBoard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/home/LeaveBoardDialog.tsx
git commit -m "feat: LeaveBoardDialog component"
```

---

## Task 9: UI — LeaveOrganizationDialog

**Files:**

- Create: `src/app/[locale]/home/LeaveOrganizationDialog.tsx`

- [ ] **Step 1: Create LeaveOrganizationDialog**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Checkbox,
  CheckboxField,
  CheckboxGroup,
} from '@/src/web/components/catalyst/checkbox';
import { Label } from '@/src/web/components/catalyst/fieldset';
import { Text } from '@/src/web/components/catalyst/text';
import { leaveOrganizationAction } from '@/src/web/actions/organization/organization';

interface Board {
  id: string;
  name: string;
}

interface LeaveOrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organization: { id: string; name: string };
  boards: Board[];
}

export function LeaveOrganizationDialog({
  isOpen,
  onClose,
  organization,
  boards,
}: LeaveOrganizationDialogProps) {
  const t = useTranslations('home');
  const tErrors = useTranslations('common.errors');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(
    new Set(boards.map((b) => b.id))
  );

  const toggleBoard = (boardId: string) => {
    setSelectedBoardIds((prev) => {
      const next = new Set(prev);

      if (next.has(boardId)) {
        next.delete(boardId);
      } else {
        next.add(boardId);
      }

      return next;
    });
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set('organizationId', organization.id);
    formData.set(
      'boardIdsToLeave',
      JSON.stringify(Array.from(selectedBoardIds))
    );

    const result = await leaveOrganizationAction(formData);

    if (result.success) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setSelectedBoardIds(new Set(boards.map((b) => b.id)));
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('leaveOrgConfirmTitle')}</DialogTitle>
      <DialogDescription>
        {t('leaveOrgConfirmDescription', { orgName: organization.name })}
      </DialogDescription>
      <DialogBody>
        {boards.length > 0 && (
          <div className="space-y-3">
            <Text className="text-sm font-medium">
              {t('leaveOrgBoardsPrompt')}
            </Text>
            <CheckboxGroup>
              {boards.map((board) => (
                <CheckboxField key={board.id}>
                  <Checkbox
                    checked={selectedBoardIds.has(board.id)}
                    onChange={() => toggleBoard(board.id)}
                    color="brand-green"
                  />
                  <Label>{board.name}</Label>
                </CheckboxField>
              ))}
            </CheckboxGroup>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="zinc" onClick={handleClose} disabled={isLoading}>
          {tErrors('cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? t('leaving') : t('leaveOrganization')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/home/LeaveOrganizationDialog.tsx
git commit -m "feat: LeaveOrganizationDialog with board checkboxes"
```

---

## Task 10: UI — Home Page Integration

**Files:**

- Modify: `src/app/[locale]/home/UserOrganizationsList.tsx`
- Modify: `src/app/[locale]/home/page.tsx`

- [ ] **Step 1: Update UserOrganizationsList**

This is the largest UI change. The component needs to:

1. Fetch board memberships via `getUserBoardsForHomeAction`
2. Show collapsible board list inside each org card
3. Show "Leave" buttons on org cards and board items
4. Show "External Boards" section
5. Open appropriate dialogs

Replace `src/app/[locale]/home/UserOrganizationsList.tsx` with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Divider } from '@/src/web/components/catalyst/divider';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { getUserOrganizationsAction } from '@/src/web/actions/organization/organization';
import { getUserBoardsForHomeAction } from '@/src/web/actions/board/board';
import { LeaveBoardDialog } from './LeaveBoardDialog';
import { LeaveOrganizationDialog } from './LeaveOrganizationDialog';

interface UserOrganization {
  id: string;
  name: string;
  description: string;
  joinedAt?: Date;
  archivedAt?: Date | null;
  parentOrg?: { id: string; name: string } | null;
}

interface AdminOrganization {
  id: string;
  name: string;
  description: string;
  archivedAt?: Date | null;
  parentOrg?: { id: string; name: string } | null;
}

interface BoardInfo {
  id: string;
  name: string;
}

interface ExternalBoard {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
}

interface UserOrganizationsListProps {
  adminOrganizations: AdminOrganization[];
}

export function UserOrganizationsList({
  adminOrganizations,
}: UserOrganizationsListProps) {
  const t = useTranslations('home');
  const tOrg = useTranslations('organization');
  const [member, setMember] = useState<UserOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardsByOrgId, setBoardsByOrgId] = useState<
    Record<string, BoardInfo[]>
  >({});
  const [externalBoards, setExternalBoards] = useState<ExternalBoard[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Leave board dialog state
  const [leaveBoardDialog, setLeaveBoardDialog] = useState<{
    isOpen: boolean;
    board: BoardInfo;
  }>({ isOpen: false, board: { id: '', name: '' } });

  // Leave org dialog state
  const [leaveOrgDialog, setLeaveOrgDialog] = useState<{
    isOpen: boolean;
    organization: { id: string; name: string };
    boards: BoardInfo[];
  }>({ isOpen: false, organization: { id: '', name: '' }, boards: [] });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      const [orgsResult, boardsResult] = await Promise.all([
        getUserOrganizationsAction(),
        getUserBoardsForHomeAction(),
      ]);

      if (orgsResult.success) {
        setMember(
          orgsResult.data.member.map((org) => ({
            ...org,
            joinedAt: new Date(org.joinedAt),
            archivedAt: org.archivedAt ? new Date(org.archivedAt) : null,
            parentOrg: org.parentOrg,
          }))
        );
      } else {
        setError(orgsResult.error);
      }

      if (boardsResult.success) {
        setBoardsByOrgId(boardsResult.data.boardsByOrgId);
        setExternalBoards(boardsResult.data.externalBoards);
      }

      setIsLoading(false);
    };

    loadData();
  }, [adminOrganizations]);

  const toggleExpanded = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);

      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }

      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Text className="text-center text-zinc-500">Loading...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <Text className="text-red-800 dark:text-red-200">{error}</Text>
      </div>
    );
  }

  const memberIds = new Set(member.map((org) => org.id));
  const adminOnlyOrgs = adminOrganizations.filter(
    (org) => !memberIds.has(org.id)
  );
  const adminIdSet = new Set(adminOrganizations.map((org) => org.id));

  const hasOrganizations = member.length > 0 || adminOnlyOrgs.length > 0;

  if (!hasOrganizations && externalBoards.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <Text className="text-lg text-zinc-500 dark:text-zinc-400">
          {t('noOrganizations')}
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Member Organizations */}
      {member.length > 0 && (
        <div>
          <Heading level={2} className="mb-4">
            {t('myOrganizations')}
          </Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {member.map((org) => {
              const orgBoards = boardsByOrgId[org.id] || [];
              const isExpanded = expandedOrgs.has(org.id);

              return (
                <div
                  key={org.id}
                  className={`rounded-lg border p-6 ${
                    org.archivedAt
                      ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  <Link
                    href={`/organizations/${org.id}`}
                    prefetch={false}
                    className="block transition-shadow hover:shadow-md"
                  >
                    {org.parentOrg && (
                      <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {tOrg('parentOrg', { name: org.parentOrg.name })}
                      </Text>
                    )}
                    <div className="flex items-start justify-between">
                      <Heading level={3} className="text-lg font-semibold">
                        {org.name}
                      </Heading>
                      <div className="flex gap-1">
                        {org.archivedAt && (
                          <Badge color="pink">{t('archivedBadge')}</Badge>
                        )}
                        {adminIdSet.has(org.id) && (
                          <Badge color="purple">{t('admin')}</Badge>
                        )}
                        <Badge color="green">{t('member')}</Badge>
                      </div>
                    </div>
                    <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {org.description}
                    </Text>
                    {org.joinedAt && (
                      <Text className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                        {t('joinedAt')} {org.joinedAt.toLocaleDateString()}
                      </Text>
                    )}
                  </Link>

                  {/* Collapsible boards section */}
                  {orgBoards.length > 0 && (
                    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                      <button
                        onClick={() => toggleExpanded(org.id)}
                        className="flex w-full items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        <span>
                          {t('myBoards')} ({orgBoards.length})
                        </span>
                        <svg
                          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isExpanded && (
                        <ul className="mt-2 space-y-2">
                          {orgBoards.map((board) => (
                            <li
                              key={board.id}
                              className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                            >
                              <Text className="text-sm">{board.name}</Text>
                              <Button
                                color="red"
                                className="!px-2 !py-1 !text-xs"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  setLeaveBoardDialog({
                                    isOpen: true,
                                    board,
                                  });
                                }}
                              >
                                {t('leaveBoard')}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Leave organization button */}
                  {!org.archivedAt && (
                    <div className="mt-3">
                      <Button
                        color="red"
                        className="w-full !text-sm"
                        onClick={() =>
                          setLeaveOrgDialog({
                            isOpen: true,
                            organization: { id: org.id, name: org.name },
                            boards: orgBoards,
                          })
                        }
                      >
                        {t('leaveOrganization')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin-only Organizations */}
      {adminOnlyOrgs.length > 0 && (
        <>
          {member.length > 0 && <Divider className="my-8" />}
          <div>
            <Heading level={2} className="mb-4">
              {t('myAdminOrganizations')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adminOnlyOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  prefetch={false}
                  className={`block rounded-lg border p-6 transition-shadow hover:shadow-md ${
                    org.archivedAt
                      ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  {org.parentOrg && (
                    <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {tOrg('parentOrg', { name: org.parentOrg.name })}
                    </Text>
                  )}
                  <div className="flex items-start justify-between">
                    <Heading level={3} className="text-lg font-semibold">
                      {org.name}
                    </Heading>
                    <div className="flex gap-1">
                      {org.archivedAt && (
                        <Badge color="pink">{t('archivedBadge')}</Badge>
                      )}
                      <Badge color="purple">{t('admin')}</Badge>
                    </div>
                  </div>
                  <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {org.description}
                  </Text>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* External Boards */}
      {externalBoards.length > 0 && (
        <>
          <Divider className="my-8" />
          <div>
            <Heading level={2} className="mb-4">
              {t('externalBoards')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {externalBoards.map((board) => (
                <div
                  key={board.id}
                  className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {board.organizationName}
                  </Text>
                  <Heading level={3} className="text-lg font-semibold">
                    {board.name}
                  </Heading>
                  <div className="mt-4">
                    <Button
                      color="red"
                      className="w-full !text-sm"
                      onClick={() =>
                        setLeaveBoardDialog({
                          isOpen: true,
                          board: { id: board.id, name: board.name },
                        })
                      }
                    >
                      {t('leaveBoard')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <LeaveBoardDialog
        isOpen={leaveBoardDialog.isOpen}
        onClose={() =>
          setLeaveBoardDialog({
            isOpen: false,
            board: { id: '', name: '' },
          })
        }
        board={leaveBoardDialog.board}
      />
      <LeaveOrganizationDialog
        isOpen={leaveOrgDialog.isOpen}
        onClose={() =>
          setLeaveOrgDialog({
            isOpen: false,
            organization: { id: '', name: '' },
            boards: [],
          })
        }
        organization={leaveOrgDialog.organization}
        boards={leaveOrgDialog.boards}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify home page.tsx needs no changes**

The home page server component (`src/app/[locale]/home/page.tsx`) already passes `adminOrganizations` to `UserOrganizationsList`. No changes needed — all new data fetching happens inside the client component.

- [ ] **Step 3: Run the dev server and verify**

Run: `yarn dev`
Check: Navigate to `/home`, verify org cards show, boards expand, leave buttons appear, dialogs open.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/home/UserOrganizationsList.tsx src/app/[locale]/home/LeaveBoardDialog.tsx src/app/[locale]/home/LeaveOrganizationDialog.tsx
git commit -m "feat: home page leave org/board UI with collapsible boards"
```
