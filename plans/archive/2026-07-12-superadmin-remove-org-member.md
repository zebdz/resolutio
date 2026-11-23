# Superadmin Remove Org Member — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmins can remove an accepted member from an organization: membership row hard-deleted + audit row written, org-admin role dropped, soft-removed from the org's boards, removed user notified in-app.

**Architecture:** DDD layers — new audit model in Prisma; one new repo method on `OrganizationRepository` (transactional delete+audit); new `RemoveOrgMemberUseCase` orchestrating guards → cascade → notify (mirrors `RemoveOrgAdminUseCase` + `LeaveOrganizationUseCase`); standard server action; remove button + reason dialog in the existing members list, gated by a server-computed prop.

**Tech Stack:** Next.js (App Router), Prisma/PostgreSQL, Zod, vitest, next-intl, Tailwind Catalyst.

**Spec:** `readmes/2026-07-12-superadmin-remove-org-member-design.md`

## Global Constraints

- **NEVER `git commit`** — stage with `git add` only; the user reviews and commits themselves. `git add` is allowed.
- Every server action starts with `checkRateLimit()` (see CLAUDE.md Rate limiting).
- Use cases return error **codes** (e.g. `organization.errors.reasonRequired`), never message strings; every new code gets entries in **both** `messages/en.json` and `messages/ru.json`.
- Use `translateErrorCode` from `@/web/actions/utils/translateErrorCode` in actions — no inline translation logic.
- No raw SQL in `web/actions/` — Prisma query builder / repository methods only.
- Package manager: **yarn**. Tests: `yarn vitest run <path>`. Typecheck: `yarn typecheck` (excludes `**/*test*`).
- Prisma table/column names use `@@map`/`@map` snake_case.
- Russian UI copy: a board is «орган управления»; removing a member is «исключить».
- Tests live in co-located `__tests__/` dirs; vitest, mock classes implementing the domain interfaces (see `src/application/organization/__tests__/RemoveOrgAdminUseCase.test.ts` for the house style).

---

### Task 1: Audit table — Prisma schema + migration

**Files:**

- Modify: `prisma/schema.prisma` (three places: new model after `OrganizationAdminUser` (~line 238), `User` relations block (~line 104), `Organization` relations block (~line 175))

**Interfaces:**

- Consumes: existing `User`, `Organization` models.
- Produces: Prisma model `OrganizationMemberRemoval` → client accessor `prisma.organizationMemberRemoval` (fields: `id`, `organizationId`, `userId`, `removedByUserId`, `reason`, `createdAt`). Tasks 2+ rely on it.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`**

Insert after the `OrganizationAdminUser` model (line ~238, before `// Board Models`):

```prisma
// Organization member removals (append-only audit log)
model OrganizationMemberRemoval {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  userId          String   @map("user_id")
  removedByUserId String   @map("removed_by_user_id")
  reason          String
  createdAt       DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation("RemovedOrgMember", fields: [userId], references: [id], onDelete: Cascade)
  removedBy    User         @relation("RemovedOrgMemberBy", fields: [removedByUserId], references: [id])

  @@index([organizationId])
  @@index([userId])
  @@map("organization_member_removals")
}
```

- [ ] **Step 2: Add back-relations**

In `model User` relations block (after `reportsPublished` line ~104):

```prisma
  orgMemberRemovals       OrganizationMemberRemoval[] @relation("RemovedOrgMember")
  orgMemberRemovalsActed  OrganizationMemberRemoval[] @relation("RemovedOrgMemberBy")
```

In `model Organization` relations block (after `reports` line ~175):

```prisma
  memberRemovals      OrganizationMemberRemoval[]
```

- [ ] **Step 3: Create migration**

Run: `yarn prisma migrate dev --name add_organization_member_removals`
Expected: new folder `prisma/migrations/<timestamp>_add_organization_member_removals/` containing `migration.sql` with `CREATE TABLE "organization_member_removals"`; client regenerated. (If the dev server is running, remind the user it must be restarted to pick up the new client.)

- [ ] **Step 4: Verify typecheck**

Run: `yarn typecheck`
Expected: no errors.

- [ ] **Step 5: Stage (do NOT commit)**

```bash
git add prisma/schema.prisma prisma/migrations
```

---

### Task 2: Repository method `removeMemberFromOrganization`

**Files:**

- Modify: `src/domain/organization/OrganizationRepository.ts` (after `removeUserFromOrganization`, ~line 152)
- Modify: `src/infrastructure/repositories/PrismaOrganizationRepository.ts` (after `removeUserFromOrganization`, ~line 349)

**Interfaces:**

- Consumes: Task 1's `prisma.organizationMemberRemoval`; existing `prisma.organizationUser` (unique key `organizationId_userId`).
- Produces: `removeMemberFromOrganization(organizationId: string, userId: string, removedByUserId: string, reason: string): Promise<void>` on the `OrganizationRepository` interface. Task 4 calls it.

Note: no unit test for the Prisma implementation (project prefers unit tests over integration; existing repo methods are untested directly — behavior is covered via the use-case test with mocks in Task 4). `yarn typecheck` excludes `**/*test*`, so existing test mocks that don't implement the new method won't break.

- [ ] **Step 1: Add to the domain interface**

In `src/domain/organization/OrganizationRepository.ts`, after the `removeUserFromOrganization` declaration:

```ts
  /**
   * Superadmin/admin removal of a member: hard-deletes the OrganizationUser
   * row and writes an OrganizationMemberRemoval audit row, in one transaction.
   */
  removeMemberFromOrganization(
    organizationId: string,
    userId: string,
    removedByUserId: string,
    reason: string
  ): Promise<void>;
```

- [ ] **Step 2: Implement in `PrismaOrganizationRepository`**

After the `removeUserFromOrganization` method:

```ts
  async removeMemberFromOrganization(
    organizationId: string,
    userId: string,
    removedByUserId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.organizationUser.delete({
        where: { organizationId_userId: { organizationId, userId } },
      }),
      this.prisma.organizationMemberRemoval.create({
        data: { organizationId, userId, removedByUserId, reason },
      }),
    ]);
  }
```

- [ ] **Step 3: Verify typecheck**

Run: `yarn typecheck`
Expected: no errors.

- [ ] **Step 4: Stage (do NOT commit)**

```bash
git add src/domain/organization/OrganizationRepository.ts src/infrastructure/repositories/PrismaOrganizationRepository.ts
```

---

### Task 3: `NotifyMemberRemovedFromOrganizationUseCase` (TDD) + notification i18n + action URL

**Files:**

- Create: `src/application/notification/NotifyMemberRemovedFromOrganizationUseCase.ts`
- Test: `src/application/notification/__tests__/NotifyMemberRemovedFromOrganizationUseCase.test.ts`
- Modify: `messages/en.json` (`notification.types` block, after `boardMemberRemoved` ~line 1043)
- Modify: `messages/ru.json` (same block, after `boardMemberRemoved` — find with `grep -n '"boardMemberRemoved"' messages/ru.json`)
- Modify: `src/web/utils/notificationActionUrl.ts` (add entry to `TYPE_CONFIG`)

**Interfaces:**

- Consumes: `Notification.create({ userId, type, title, body, data })` from `@/domain/notification/Notification`; `NotificationRepository.save()`.
- Produces: class `NotifyMemberRemovedFromOrganizationUseCase` with constructor `({ notificationRepository })` and `execute(input: { removedUserId: string; organizationId: string; organizationName: string }): Promise<void>`. Notification `type` string: `'member_removed_from_organization'`. Task 4 calls it fire-and-forget.

- [ ] **Step 1: Write the failing test**

Create `src/application/notification/__tests__/NotifyMemberRemovedFromOrganizationUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NotifyMemberRemovedFromOrganizationUseCase } from '../NotifyMemberRemovedFromOrganizationUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;

  async save(notification: Notification): Promise<Notification> {
    this.saved = notification;

    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }

  getSaved() {
    return this.saved;
  }
}

describe('NotifyMemberRemovedFromOrganizationUseCase', () => {
  it('saves a notification to the removed member with type and org data', async () => {
    const notifRepo = new MockNotificationRepository();
    const useCase = new NotifyMemberRemovedFromOrganizationUseCase({
      notificationRepository: notifRepo,
    });

    await useCase.execute({
      removedUserId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('user-1');
    expect(saved!.type).toBe('member_removed_from_organization');
    expect(saved!.title).toBe(
      'notification.types.memberRemovedFromOrganization.title'
    );
    expect(saved!.body).toBe(
      'notification.types.memberRemovedFromOrganization.body'
    );
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/notification/__tests__/NotifyMemberRemovedFromOrganizationUseCase.test.ts`
Expected: FAIL — cannot resolve `../NotifyMemberRemovedFromOrganizationUseCase`.

- [ ] **Step 3: Implement the use case**

Create `src/application/notification/NotifyMemberRemovedFromOrganizationUseCase.ts` (template: `NotifyAdminRemovedUseCase.ts` in the same dir; deliberately no `actorName` — superadmin acts as the platform, and the reason is audit-only, NOT included):

```ts
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberRemovedFromOrganizationDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyMemberRemovedFromOrganizationUseCase {
  constructor(private deps: NotifyMemberRemovedFromOrganizationDependencies) {}

  async execute(input: {
    removedUserId: string;
    organizationId: string;
    organizationName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.removedUserId,
      type: 'member_removed_from_organization',
      title: 'notification.types.memberRemovedFromOrganization.title',
      body: 'notification.types.memberRemovedFromOrganization.body',
      data: {
        organizationId: input.organizationId,
        organizationName: input.organizationName,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/application/notification/__tests__/NotifyMemberRemovedFromOrganizationUseCase.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Add notification message keys**

`messages/en.json` — inside `notification.types`, after the `boardMemberRemoved` object (~line 1043), add:

```json
      "memberRemovedFromOrganization": {
        "title": "Removed from organization",
        "body": "You have been removed from the organization {organizationName}"
      },
```

`messages/ru.json` — same position in `notification.types` (after `boardMemberRemoved`), add:

```json
      "memberRemovedFromOrganization": {
        "title": "Исключение из организации",
        "body": "Вы были исключены из организации {organizationName}"
      },
```

(Rendering is generic — `NotificationsList.tsx` resolves `notification.types.<type>.<field>` keys and interpolates `data`; no component changes needed.)

- [ ] **Step 6: Add action URL mapping**

`src/web/utils/notificationActionUrl.ts` — in `TYPE_CONFIG`, after the `board_member_removed` entry:

```ts
  member_removed_from_organization: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
```

(`viewOrganization` actionKey already exists in messages.)

- [ ] **Step 7: Verify typecheck + stage**

Run: `yarn typecheck` — expected: no errors.

```bash
git add src/application/notification/NotifyMemberRemovedFromOrganizationUseCase.ts src/application/notification/__tests__/NotifyMemberRemovedFromOrganizationUseCase.test.ts messages/en.json messages/ru.json src/web/utils/notificationActionUrl.ts
```

---

### Task 4: `RemoveOrgMemberUseCase` (TDD) + `REASON_REQUIRED` error code

**Files:**

- Create: `src/application/organization/RemoveOrgMemberUseCase.ts`
- Test: `src/application/organization/__tests__/RemoveOrgMemberUseCase.test.ts`
- Modify: `src/application/organization/OrganizationErrors.ts` (add one code)
- Modify: `messages/en.json` (`organization.errors` block, after `"notMember"` ~line 252)
- Modify: `messages/ru.json` (`organization.errors` block, after `"notMember"` ~line 252)

**Interfaces:**

- Consumes: `OrganizationRepository` (`findById`, `isUserExactMember`, `isUserAdmin`, `removeAdmin` — throws `Error('LAST_ADMIN')`, `removeMemberFromOrganization` from Task 2), `BoardRepository` (`findByOrganizationId`, `isUserMember`, `removeUserFromBoard(userId, boardId, removedBy?, removedReason?)`), `UserRepository.isSuperAdmin`, `NotifyMemberRemovedFromOrganizationUseCase` from Task 3, `Result`/`success`/`failure` from `@/domain/shared/Result`.
- Produces: class `RemoveOrgMemberUseCase`, constructor `({ organizationRepository, boardRepository, userRepository, notificationRepository })`, method `execute(input: { organizationId: string; targetUserId: string; actorUserId: string; reason: string }): Promise<Result<void, string>>`. Error code `OrganizationErrors.REASON_REQUIRED = 'organization.errors.reasonRequired'`. Task 5 wires and calls it.

Guard semantics (why they differ from `RemoveOrgAdminUseCase`):

- Auth is **superadmin-only** for now — an org admin actor must be rejected with `NOT_ADMIN`. (Future extension: allow org admins by also accepting `organizationRepository.isUserAdmin(actor, org)`.)
- Membership check uses **`isUserExactMember`** (NOT `isUserMember`, which walks descendant orgs) — we delete this exact org's row.
- Archived boards are skipped in the cascade (mirrors `LeaveOrganizationUseCase`).

- [ ] **Step 1: Add the error code**

In `src/application/organization/OrganizationErrors.ts`, after `NOT_MEMBER` (~line 49):

```ts
  REASON_REQUIRED: 'organization.errors.reasonRequired',
```

- [ ] **Step 2: Add error messages**

`messages/en.json` — in `organization.errors`, after `"notMember": "You are not a member of this organization"` (~line 252):

```json
      "notMember": "You are not a member of this organization",
      "reasonRequired": "Removal reason is required"
```

`messages/ru.json` — same block (~line 252):

```json
      "notMember": "Вы не являетесь участником этой организации",
      "reasonRequired": "Необходимо указать причину исключения"
```

(Shown as JSON with the preceding key for placement clarity — add a comma after `notMember` and insert the new line.)

- [ ] **Step 3: Write the failing test**

Create `src/application/organization/__tests__/RemoveOrgMemberUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveOrgMemberUseCase } from '../RemoveOrgMemberUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

type RemovalRecord = {
  organizationId: string;
  userId: string;
  removedByUserId: string;
  reason: string;
};

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();
  private members: Map<string, Set<string>> = new Map();
  public removals: RemovalRecord[] = [];

  async save(org: Organization): Promise<Organization> {
    this.organizations.set(org.id, org);

    return org;
  }
  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }
  async findByName(): Promise<Organization | null> {
    return null;
  }
  async findByCreatorId(): Promise<Organization[]> {
    return [];
  }
  async findByParentId(): Promise<Organization[]> {
    return [];
  }
  async getAncestorIds(): Promise<string[]> {
    return [];
  }
  async getDescendantIds(): Promise<string[]> {
    return [];
  }
  async getFullTreeOrgIds(): Promise<string[]> {
    return [];
  }
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserExactMember(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const members = this.members.get(organizationId);

    return members ? members.has(userId) : false;
  }
  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
  }
  async findMembershipsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAdminOrganizationsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<any[]> {
    return [];
  }
  async searchOrganizationsWithStats(): Promise<any> {
    return { organizations: [], totalCount: 0 };
  }
  async update(org: Organization): Promise<Organization> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): Promise<string[]> {
    return [];
  }
  async findAcceptedMemberUserIdsForOrgs(): Promise<string[]> {
    return [];
  }
  async removeUserFromOrganization(): Promise<void> {}
  async removeMemberFromOrganization(
    organizationId: string,
    userId: string,
    removedByUserId: string,
    reason: string
  ): Promise<void> {
    this.members.get(organizationId)?.delete(userId);
    this.removals.push({ organizationId, userId, removedByUserId, reason });
  }
  async findPendingRequestsByUserId(): Promise<Organization[]> {
    return [];
  }
  async getAncestors(): Promise<any[]> {
    return [];
  }
  async getChildrenWithStats(): Promise<any[]> {
    return [];
  }
  async getHierarchyTree(): Promise<any> {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async findAdminUserIds(organizationId: string): Promise<string[]> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? Array.from(admins) : [];
  }
  async setParentId(): Promise<void> {}
  async addAdmin(organizationId: string, userId: string): Promise<void> {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  async removeAdmin(organizationId: string, userId: string): Promise<void> {
    const admins = this.adminRoles.get(organizationId);

    if (admins && admins.size <= 1) {
      throw new Error('LAST_ADMIN');
    }

    admins?.delete(userId);
  }
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }
  async getRootAllowMultiTreeMembership(): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(): Promise<string[]> {
    return [];
  }
  async setAllowMultiTreeMembership(): Promise<void> {}

  // Test helpers
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(organizationId: string, userId: string): void {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  addMember(organizationId: string, userId: string): void {
    if (!this.members.has(organizationId)) {
      this.members.set(organizationId, new Set());
    }

    this.members.get(organizationId)!.add(userId);
  }
}

type BoardRemovalRecord = {
  userId: string;
  boardId: string;
  removedBy?: string;
  removedReason?: string;
};

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map();
  public removals: BoardRemovalRecord[] = [];

  async save(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }
  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }
  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }
  async findBoardMembers(boardId: string): Promise<{ userId: string }[]> {
    const members = this.members.get(boardId);

    return members ? Array.from(members).map((userId) => ({ userId })) : [];
  }
  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    const members = this.members.get(boardId);

    return members ? members.has(userId) : false;
  }
  async addUserToBoard(userId: string, boardId: string): Promise<void> {
    if (!this.members.has(boardId)) {
      this.members.set(boardId, new Set());
    }

    this.members.get(boardId)!.add(userId);
  }
  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {
    this.members.get(boardId)?.delete(userId);
    this.removals.push({ userId, boardId, removedBy, removedReason });
  }
  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }
  async findActiveBoardsByUserId(): Promise<
    Array<{ id: string; name: string; organizationId: string }>
  > {
    return [];
  }

  // Test helpers
  addBoard(board: Board): void {
    this.boards.set(board.id, board);
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  async findByIds(): Promise<User[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<User | null> {
    return null;
  }
  async save(user: User): Promise<User> {
    return user;
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<User[]> {
    return [];
  }
  async searchUserByPhone(): Promise<User | null> {
    return null;
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }
  async findByNickname(): Promise<User | null> {
    return null;
  }
  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }
  async updatePrivacySettings(): Promise<void> {}
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async confirmUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
  }

  // Test helper
  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
}

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;
  public failNext = false;

  async save(notification: Notification): Promise<Notification> {
    if (this.failNext) {
      throw new Error('save failed');
    }

    this.saved = notification;

    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }

  getSaved() {
    return this.saved;
  }
}

function makeOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Test Org',
    description: 'Test',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function makeArchivedOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Archived',
    description: 'Archived',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: new Date(),
    allowMultiTreeMembership: false,
  });
}

function makeBoard(
  id: string,
  organizationId: string,
  archived = false
): Board {
  return Board.reconstitute({
    id,
    name: `Board ${id}`,
    organizationId,
    createdAt: new Date(),
    archivedAt: archived ? new Date() : null,
  });
}

describe('RemoveOrgMemberUseCase', () => {
  let useCase: RemoveOrgMemberUseCase;
  let orgRepo: MockOrganizationRepository;
  let boardRepo: MockBoardRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    boardRepo = new MockBoardRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new RemoveOrgMemberUseCase({
      organizationRepository: orgRepo,
      boardRepository: boardRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  function setupHappyPath() {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');
    userRepo.addSuperAdmin('superadmin-1');
  }

  it('fails with reasonRequired when reason is empty or whitespace', async () => {
    setupHappyPath();

    for (const reason of ['', '   ', '\n\t']) {
      const result = await useCase.execute({
        organizationId: 'org-1',
        targetUserId: 'member-1',
        actorUserId: 'superadmin-1',
        reason,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.reasonRequired');
      }
    }
  });

  it('fails when org not found', async () => {
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'nonexistent',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notFound');
    }
  });

  it('fails when org is archived', async () => {
    orgRepo.addOrganization(makeArchivedOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.archived');
    }
  });

  it('fails when actor is not a superadmin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'random-user',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('fails when actor is an org admin but not a superadmin (superadmin-only for now)', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'member-1');
    orgRepo.setAdmin('org-1', 'org-admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'org-admin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('fails when superadmin tries to remove self', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.addMember('org-1', 'superadmin-1');
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'superadmin-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.cannotRemoveSelf');
    }
  });

  it('fails when target is not an accepted member of this exact org', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'not-a-member',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notMember');
    }
  });

  it('fails with lastAdmin when target is the last org admin', async () => {
    setupHappyPath();
    orgRepo.setAdmin('org-1', 'member-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.lastAdmin');
    }

    // Membership must remain intact
    expect(await orgRepo.isUserExactMember('member-1', 'org-1')).toBe(true);
    expect(orgRepo.removals).toHaveLength(0);
  });

  it('removes admin role first when target is an admin (2+ admins)', async () => {
    setupHappyPath();
    orgRepo.setAdmin('org-1', 'member-1');
    orgRepo.setAdmin('org-1', 'other-admin');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);
    expect(await orgRepo.isUserAdmin('member-1', 'org-1')).toBe(false);
    expect(orgRepo.removals).toHaveLength(1);
  });

  it('soft-removes target from org boards they belong to, skipping archived boards and other orgs', async () => {
    setupHappyPath();
    boardRepo.addBoard(makeBoard('board-1', 'org-1'));
    boardRepo.addBoard(makeBoard('board-2', 'org-1'));
    boardRepo.addBoard(makeBoard('board-archived', 'org-1', true));
    boardRepo.addBoard(makeBoard('board-other-org', 'org-2'));
    await boardRepo.addUserToBoard('member-1', 'board-1');
    await boardRepo.addUserToBoard('member-1', 'board-archived');
    await boardRepo.addUserToBoard('member-1', 'board-other-org');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);
    expect(boardRepo.removals).toEqual([
      {
        userId: 'member-1',
        boardId: 'board-1',
        removedBy: 'superadmin-1',
        removedReason: 'removed_from_organization',
      },
    ]);
  });

  it('deletes membership with audit info (trimmed reason)', async () => {
    setupHappyPath();

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: '  duplicate account  ',
    });

    expect(result.success).toBe(true);
    expect(orgRepo.removals).toEqual([
      {
        organizationId: 'org-1',
        userId: 'member-1',
        removedByUserId: 'superadmin-1',
        reason: 'duplicate account',
      },
    ]);
    expect(await orgRepo.isUserExactMember('member-1', 'org-1')).toBe(false);
  });

  it('notifies the removed member (fire-and-forget)', async () => {
    setupHappyPath();

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);

    // Wait for fire-and-forget notification
    await new Promise((r) => setTimeout(r, 10));

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('member-1');
    expect(saved!.type).toBe('member_removed_from_organization');
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });
  });

  it('succeeds even when the notification save fails', async () => {
    setupHappyPath();
    notifRepo.failNext = true;

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'member-1',
      actorUserId: 'superadmin-1',
      reason: 'cleanup',
    });

    expect(result.success).toBe(true);

    await new Promise((r) => setTimeout(r, 10));

    expect(orgRepo.removals).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `yarn vitest run src/application/organization/__tests__/RemoveOrgMemberUseCase.test.ts`
Expected: FAIL — cannot resolve `../RemoveOrgMemberUseCase`.

- [ ] **Step 5: Implement the use case**

Create `src/application/organization/RemoveOrgMemberUseCase.ts`:

```ts
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyMemberRemovedFromOrganizationUseCase } from '../notification/NotifyMemberRemovedFromOrganizationUseCase';

export interface RemoveOrgMemberInput {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
  reason: string;
}

export interface RemoveOrgMemberDependencies {
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RemoveOrgMemberUseCase {
  private organizationRepository: OrganizationRepository;
  private boardRepository: BoardRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: RemoveOrgMemberDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.boardRepository = dependencies.boardRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(input: RemoveOrgMemberInput): Promise<Result<void, string>> {
    const reason = input.reason.trim();

    if (!reason) {
      return failure(OrganizationErrors.REASON_REQUIRED);
    }

    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Superadmin-only for now. To allow org admins later, also accept
    // organizationRepository.isUserAdmin(input.actorUserId, input.organizationId).
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.actorUserId
    );

    if (!isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    if (input.actorUserId === input.targetUserId) {
      return failure(OrganizationErrors.CANNOT_REMOVE_SELF);
    }

    // Exact-org check: we delete this org's membership row, so descendant
    // memberships (which isUserMember would also count) must not qualify.
    const isMember = await this.organizationRepository.isUserExactMember(
      input.targetUserId,
      input.organizationId
    );

    if (!isMember) {
      return failure(OrganizationErrors.NOT_MEMBER);
    }

    // Drop org-admin role first; repo guarantees ≥1 admin remains
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      input.targetUserId,
      input.organizationId
    );

    if (isTargetAdmin) {
      try {
        await this.organizationRepository.removeAdmin(
          input.organizationId,
          input.targetUserId
        );
      } catch (error: any) {
        if (error.message === 'LAST_ADMIN') {
          return failure(OrganizationErrors.LAST_ADMIN);
        }

        throw error;
      }
    }

    // Soft-remove from the org's boards (skip archived, mirrors leave-org)
    const boards = await this.boardRepository.findByOrganizationId(
      input.organizationId
    );

    for (const board of boards) {
      if (board.isArchived()) {
        continue;
      }

      const isBoardMember = await this.boardRepository.isUserMember(
        input.targetUserId,
        board.id
      );

      if (!isBoardMember) {
        continue;
      }

      await this.boardRepository.removeUserFromBoard(
        input.targetUserId,
        board.id,
        input.actorUserId,
        'removed_from_organization'
      );
    }

    // Hard-delete membership + audit row (one transaction in the repo)
    await this.organizationRepository.removeMemberFromOrganization(
      input.organizationId,
      input.targetUserId,
      input.actorUserId,
      reason
    );

    // Fire-and-forget notification to the removed member
    new NotifyMemberRemovedFromOrganizationUseCase({
      notificationRepository: this.notificationRepository,
    })
      .execute({
        removedUserId: input.targetUserId,
        organizationId: input.organizationId,
        organizationName: organization.name,
      })
      .catch((err) =>
        console.error('Failed to notify member removed from organization:', err)
      );

    return success(undefined);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn vitest run src/application/organization/__tests__/RemoveOrgMemberUseCase.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 7: Run the whole suite + typecheck**

Run: `yarn test` — expected: all green.
Run: `yarn typecheck` — expected: no errors.

- [ ] **Step 8: Stage (do NOT commit)**

```bash
git add src/application/organization/RemoveOrgMemberUseCase.ts src/application/organization/__tests__/RemoveOrgMemberUseCase.test.ts src/application/organization/OrganizationErrors.ts messages/en.json messages/ru.json
```

---

### Task 5: Zod schema + server action + wiring

**Files:**

- Create: `src/application/organization/RemoveOrgMemberSchema.ts`
- Modify: `src/web/actions/organization/organization.ts` (import block ~line 26, wiring block after `removeOrgAdminUseCase` ~line 140, new action after `removeOrgAdminAction` ~line 1418)

**Interfaces:**

- Consumes: `RemoveOrgMemberUseCase` from Task 4; existing module-level `organizationRepository`, `boardRepository`, `userRepository`, `notificationRepository`, `prisma` instances; `checkRateLimit`, `getCurrentUser`, `translateErrorCode`, `ActionResult` — all already present in the file.
- Produces: `removeOrgMemberAction(organizationId: string, targetUserId: string, reason: string): Promise<ActionResult>` — Task 6's UI calls it.

- [ ] **Step 1: Create the Zod schema**

Create `src/application/organization/RemoveOrgMemberSchema.ts` (style: `src/application/board/RemoveBoardMemberSchema.ts`):

```ts
import { z } from 'zod';

export const RemoveOrgMemberSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
  targetUserId: z.string().cuid('Invalid user ID'),
  reason: z.string().trim().min(1).max(500),
});

export type RemoveOrgMemberActionInput = z.infer<typeof RemoveOrgMemberSchema>;
```

- [ ] **Step 2: Wire the use case in the action file**

In `src/web/actions/organization/organization.ts`:

Add imports (next to the `RemoveOrgAdminUseCase` import, ~line 26):

```ts
import { RemoveOrgMemberUseCase } from '@/application/organization/RemoveOrgMemberUseCase';
import { RemoveOrgMemberSchema } from '@/application/organization/RemoveOrgMemberSchema';
```

Add instantiation right after the `removeOrgAdminUseCase` const (~line 140):

```ts
const removeOrgMemberUseCase = new RemoveOrgMemberUseCase({
  organizationRepository,
  boardRepository,
  userRepository,
  notificationRepository,
});
```

- [ ] **Step 3: Add the action**

Insert after the closing brace of `removeOrgAdminAction` (~line 1418):

```ts
export async function removeOrgMemberAction(
  organizationId: string,
  targetUserId: string,
  reason: string
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

    const validation = RemoveOrgMemberSchema.safeParse({
      organizationId,
      targetUserId,
      reason,
    });

    if (!validation.success) {
      return {
        success: false,
        error: t('validationFailed'),
      };
    }

    const result = await removeOrgMemberUseCase.execute({
      organizationId: validation.data.organizationId,
      targetUserId: validation.data.targetUserId,
      actorUserId: user.id,
      reason: validation.data.reason,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error removing org member:', error);

    return { success: false, error: t('generic') };
  }
}
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `yarn typecheck` — expected: no errors.
Run: `yarn lint` — expected: no new errors.

- [ ] **Step 5: Stage (do NOT commit)**

```bash
git add src/application/organization/RemoveOrgMemberSchema.ts src/web/actions/organization/organization.ts
```

---

### Task 6: UI — remove button + reason dialog in the members list

**Files:**

- Modify: `src/app/[locale]/organizations/[id]/MembersListContent.tsx` (add props + per-row button + dialog)
- Modify: `src/app/[locale]/organizations/[id]/OrgMembersList.tsx` (thread props)
- Modify: `src/app/[locale]/organizations/[id]/page.tsx` (pass `canRemoveMembers={isSuperAdmin}` and `currentUserId`)
- Modify: `messages/en.json` (`organization.detail` block, after `"noMembersFound"` ~line 363)
- Modify: `messages/ru.json` (same block)

**Interfaces:**

- Consumes: `removeOrgMemberAction(organizationId, targetUserId, reason)` from Task 5; Catalyst `Dialog`/`DialogTitle`/`DialogDescription`/`DialogBody`/`DialogActions`, `Textarea`, `Button` (dialog usage template: `src/app/[locale]/organizations/[id]/boards/[boardId]/manage/MembersList.tsx`).
- Produces: `MembersListContent` accepts optional `canRemoveMembers?: boolean` (default `false`) and `currentUserId?: string | null` (default `null`); `OrgMembersList` accepts and forwards the same two optional props. `MembershipSection.tsx` (the other `MembersListContent` call site, used by `modify/page.tsx`) is NOT changed — defaults keep it removal-free.

Notes:

- `member.id` in this list IS the user id (`GetOrgMembersUseCase` maps `id: row.user.id`).
- Do not render the remove button on the viewer's own row (`member.id === currentUserId`).
- Catalyst `Button` already provides pointer/disabled cursor styling — no extra `cursor-pointer` classes needed here.
- The confirm button must stay disabled until `reason.trim()` is non-empty (required reason).

- [ ] **Step 1: Add i18n keys**

`messages/en.json` — in `organization.detail`, after `"noMembersFound": "No members found"` (~line 363), add:

```json
      "removeMember": "Remove",
      "removeMemberDialogTitle": "Remove member",
      "removeMemberDialogDescription": "Remove {name} from this organization? They will also be removed from all boards of this organization.",
      "removeMemberReasonLabel": "Reason for removal (required)",
      "removeMemberReasonPlaceholder": "Explain why this member is being removed…",
      "removeMemberConfirm": "Remove member",
      "removingMember": "Removing…",
```

`messages/ru.json` — in `organization.detail`, after `"noMembersFound"` (find with `grep -n '"noMembersFound"' messages/ru.json`), add:

```json
      "removeMember": "Исключить",
      "removeMemberDialogTitle": "Исключение участника",
      "removeMemberDialogDescription": "Исключить {name} из организации? Участник также будет исключён из всех органов управления этой организации.",
      "removeMemberReasonLabel": "Причина исключения (обязательно)",
      "removeMemberReasonPlaceholder": "Укажите причину исключения…",
      "removeMemberConfirm": "Исключить",
      "removingMember": "Исключение…",
```

- [ ] **Step 2: Extend `MembersListContent.tsx`**

Replace the full file content with:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { User } from '@/domain/user/User';
import { getOrgMembersAction } from '@/src/web/actions/invitation/invitation';
import { removeOrgMemberAction } from '@/src/web/actions/organization/organization';

export type OrgMember = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  joinedAt: Date | null;
};

type Props = {
  organizationId: string;
  initialMembers: OrgMember[];
  initialTotalCount: number;
  canRemoveMembers?: boolean;
  currentUserId?: string | null;
};

const PAGE_SIZE = 20;

export function MembersListContent({
  organizationId,
  initialMembers,
  initialTotalCount,
  canRemoveMembers = false,
  currentUserId = null,
}: Props) {
  const t = useTranslations('organization.detail');
  const tCommon = useTranslations('common');
  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrgMember | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const fetchMembers = useCallback(
    async (p: number, q: string) => {
      setIsLoading(true);
      const result = await getOrgMembersAction(
        organizationId,
        p,
        PAGE_SIZE,
        q || undefined
      );

      if (result.success) {
        setMembers(result.data.members);
        setTotalCount(result.data.totalCount);
      }

      setIsLoading(false);
    },
    [organizationId]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchMembers(1, query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchMembers]);

  // Page changes
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchMembers(newPage, query);
  };

  const handleRemoveClick = (member: OrgMember) => {
    setMemberToRemove(member);
    setRemoveReason('');
    setRemoveError(null);
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) {
      return;
    }

    setIsRemoving(true);
    setRemoveError(null);

    const result = await removeOrgMemberAction(
      organizationId,
      memberToRemove.id,
      removeReason
    );

    setIsRemoving(false);

    if (result.success) {
      setMemberToRemove(null);
      fetchMembers(page, query);
    } else {
      setRemoveError(result.error);
    }
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder={t('searchMembers')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Members list */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          ...
        </div>
      ) : members.length === 0 ? (
        <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('noMembersFound')}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <span>
                {User.formatFullName(
                  member.firstName,
                  member.lastName,
                  member.middleName
                )}{' '}
                <span className="text-zinc-400">(@{member.nickname})</span>
              </span>
              {canRemoveMembers && member.id !== currentUserId && (
                <Button color="red" onClick={() => handleRemoveClick(member)}>
                  {t('removeMember')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('showingMembers', { from, to, total: totalCount })}
          </span>
          <div className="flex gap-2">
            <Button
              plain
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              {t('previousPage')}
            </Button>
            <Button
              plain
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              {t('nextPage')}
            </Button>
          </div>
        </div>
      )}

      {/* Remove member dialog */}
      {canRemoveMembers && (
        <Dialog
          open={memberToRemove !== null}
          onClose={() => setMemberToRemove(null)}
        >
          <DialogTitle>{t('removeMemberDialogTitle')}</DialogTitle>
          <DialogDescription>
            {memberToRemove &&
              t('removeMemberDialogDescription', {
                name: User.formatFullName(
                  memberToRemove.firstName,
                  memberToRemove.lastName,
                  memberToRemove.middleName
                ),
              })}
          </DialogDescription>
          <DialogBody>
            <div className="space-y-2">
              <label
                htmlFor="remove-member-reason"
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {t('removeMemberReasonLabel')}
              </label>
              <Textarea
                id="remove-member-reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder={t('removeMemberReasonPlaceholder')}
                rows={4}
                maxLength={500}
                disabled={isRemoving}
              />
            </div>
            {removeError && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {removeError}
              </div>
            )}
          </DialogBody>
          <DialogActions>
            <Button
              plain
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              color="red"
              onClick={handleRemoveConfirm}
              disabled={isRemoving || removeReason.trim().length === 0}
            >
              {isRemoving ? t('removingMember') : t('removeMemberConfirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Thread props through `OrgMembersList.tsx`**

Update the `Props` type and component signature, and forward to `MembersListContent`:

```tsx
type Props = {
  organizationId: string;
  initialMembers: OrgMember[];
  initialTotalCount: number;
  canRemoveMembers?: boolean;
  currentUserId?: string | null;
};

export function OrgMembersList({
  organizationId,
  initialMembers,
  initialTotalCount,
  canRemoveMembers = false,
  currentUserId = null,
}: Props) {
```

and in the JSX:

```tsx
<MembersListContent
  organizationId={organizationId}
  initialMembers={initialMembers}
  initialTotalCount={initialTotalCount}
  canRemoveMembers={canRemoveMembers}
  currentUserId={currentUserId}
/>
```

(Leave the rest of the file unchanged.)

- [ ] **Step 4: Pass the server-computed flag from `page.tsx`**

In `src/app/[locale]/organizations/[id]/page.tsx` (~line 174), the `isSuperAdmin` flag is already computed server-side. Update the `OrgMembersList` usage:

```tsx
<OrgMembersList
  organizationId={id}
  initialMembers={initialMembers}
  initialTotalCount={initialMembersTotalCount}
  canRemoveMembers={isSuperAdmin}
  currentUserId={user?.id ?? null}
/>
```

(Security note from CLAUDE.md: the permission is decided on the server — the client only receives a boolean; the action re-checks superadmin in the use case regardless.)

- [ ] **Step 5: Verify typecheck + lint + tests**

Run: `yarn typecheck` — expected: no errors.
Run: `yarn lint` — expected: no new errors.
Run: `yarn test` — expected: all green.

- [ ] **Step 6: Manual smoke test (if dev server available)**

1. Restart the dev server if it was running during Task 1 (`Ctrl+C` → `yarn dev`, port 8080) so the regenerated Prisma client loads.
2. Log in as a superadmin, open an organization's page, expand «Участники» (Members).
3. Each row except your own shows a red «Исключить» button; clicking opens the dialog; confirm stays disabled until a reason is typed.
4. Confirm removal: list refreshes without the member; `organization_member_removals` has the audit row (`npx prisma studio` or SQL); target user's notifications show «Исключение из организации»; their board memberships in that org have `removed_at`/`removed_by`/`removed_reason = 'removed_from_organization'` set.
5. Log in as a regular member/org admin: no remove buttons on the org page.

- [ ] **Step 7: Stage (do NOT commit)**

```bash
git add "src/app/[locale]/organizations/[id]/MembersListContent.tsx" "src/app/[locale]/organizations/[id]/OrgMembersList.tsx" "src/app/[locale]/organizations/[id]/page.tsx" messages/en.json messages/ru.json
```

---

### Task 7: Final verification sweep

**Files:** none new.

- [ ] **Step 1: Full test suite**

Run: `yarn test`
Expected: all tests pass, including the 14 new ones (13 use case + 1 notification).

- [ ] **Step 2: Typecheck + lint + format**

Run: `yarn typecheck` — expected: clean.
Run: `yarn lf` — runs eslint --fix + prettier; expected: no remaining errors; re-stage any reformatted files with `git add`.

- [ ] **Step 3: Review staged diff**

Run: `git status && git diff --cached --stat`
Expected: only the files listed in Tasks 1–6. Report to the user for review and manual commit — do NOT commit.
