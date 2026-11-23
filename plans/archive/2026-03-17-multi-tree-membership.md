# Multi-Tree Membership Setting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-root-org setting `allowMultiTreeMembership` that controls whether users can hold memberships in multiple orgs within the same hierarchy tree, and enforce it during org-union and user-join flows.

**Architecture:** New nullable boolean column on `organizations` table. Root orgs own the value (`false` default), child orgs store `NULL` (inherited). Enforcement added to `HandleJoinParentRequestUseCase` (overlap check on merge), `HandleJoinRequestUseCase` + `HandleInviteUseCase` (conditional skip of auto-removal), `JoinOrganizationUseCase` (conditional skip of hierarchy blocking), `UpdateOrganizationUseCase` (toggle with conflict check). New notification use case for setting changes. UI: toggle on create dialog + modify page for root orgs, read-only display for child orgs.

**Tech Stack:** Next.js 15 App Router, Prisma, vitest, next-intl, Tailwind + Catalyst components

**Spec:** `readmes/2026-03-16-multi-tree-membership-design.md`

---

## Chunk 1: Database + Domain + Repository

### Task 1: Prisma Schema + Migration

**Files:**

- Modify: `prisma/schema.prisma:96-121` (Organization model)

- [ ] **Step 1: Add allowMultiTreeMembership column to Organization model**

Add after the `archivedAt` field in the Organization model:

```prisma
  allowMultiTreeMembership Boolean? @default(false) @map("allow_multi_tree_membership")
```

- [ ] **Step 2: Generate and customize migration**

Run:

```bash
yarn prisma migrate dev --name add_allow_multi_tree_membership --create-only
```

Then edit the generated SQL migration to properly set existing data:

```sql
ALTER TABLE "organizations" ADD COLUMN "allow_multi_tree_membership" BOOLEAN DEFAULT false;

-- Set NULL for child orgs (inherited from root)
UPDATE "organizations" SET "allow_multi_tree_membership" = NULL WHERE "parent_id" IS NOT NULL;
```

- [ ] **Step 3: Apply migration and generate client**

Run:

```bash
yarn prisma migrate dev && yarn prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
```

---

### Task 2: Organization Domain Model

**Files:**

- Modify: `src/domain/organization/Organization.ts:7-15` (OrganizationProps)
- Test: `src/domain/organization/__tests__/Organization.test.ts`

- [ ] **Step 1: Write failing tests for allowMultiTreeMembership in Organization**

Add to `src/domain/organization/__tests__/Organization.test.ts`:

```typescript
it('should create organization with allowMultiTreeMembership defaulting to false when no parentId', () => {
  const result = Organization.create('Test Org', 'Test desc', 'creator-1');
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.value.allowMultiTreeMembership).toBe(false);
  }
});

it('should create organization with allowMultiTreeMembership null when parentId provided', () => {
  const result = Organization.create(
    'Test Org',
    'Test desc',
    'creator-1',
    'parent-1'
  );
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.value.allowMultiTreeMembership).toBeNull();
  }
});

it('should create organization with explicit allowMultiTreeMembership when no parentId', () => {
  const result = Organization.create(
    'Test Org',
    'Test desc',
    'creator-1',
    undefined,
    true
  );
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.value.allowMultiTreeMembership).toBe(true);
  }
});

it('should ignore allowMultiTreeMembership param when parentId is provided', () => {
  const result = Organization.create(
    'Test Org',
    'Test desc',
    'creator-1',
    'parent-1',
    true
  );
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.value.allowMultiTreeMembership).toBeNull();
  }
});

it('should reconstitute with allowMultiTreeMembership', () => {
  const org = Organization.reconstitute({
    id: 'org-1',
    name: 'Test',
    description: 'desc',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: true,
  });
  expect(org.allowMultiTreeMembership).toBe(true);
});

it('should include allowMultiTreeMembership in toJSON', () => {
  const org = Organization.reconstitute({
    id: 'org-1',
    name: 'Test',
    description: 'desc',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: true,
  });
  expect(org.toJSON().allowMultiTreeMembership).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/domain/organization/__tests__/Organization.test.ts`
Expected: FAIL — `allowMultiTreeMembership` property does not exist

- [ ] **Step 3: Update OrganizationProps and Organization class**

In `src/domain/organization/Organization.ts`:

Add to `OrganizationProps` interface (after `archivedAt`):

```typescript
allowMultiTreeMembership: boolean | null;
```

Update `create()` signature — add optional 5th parameter:

```typescript
  static create(
    name: string,
    description: string,
    createdById: string,
    parentId?: string | null,
    allowMultiTreeMembership?: boolean
  ): Result<Organization, string> {
```

Add to the props object inside `create()`:

```typescript
  allowMultiTreeMembership: parentId ? null : (allowMultiTreeMembership ?? false),
```

Add getter:

```typescript
  get allowMultiTreeMembership(): boolean | null {
    return this.props.allowMultiTreeMembership;
  }
```

Update `toJSON()` to include `allowMultiTreeMembership`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/organization/__tests__/Organization.test.ts`
Expected: PASS

- [ ] **Step 5: Fix all existing `Organization.reconstitute` and `Organization.create` calls**

Every call to `Organization.reconstitute()` now requires `allowMultiTreeMembership`. Search the codebase and add the field:

**Test files** (add `allowMultiTreeMembership: null` for child orgs, `allowMultiTreeMembership: false` for root orgs to each `reconstitute` call):

- All files under `src/application/organization/__tests__/`
- All files under `src/application/invitation/__tests__/`
- All files under `src/domain/organization/__tests__/`
- Any other test files using `Organization.reconstitute`

**Infrastructure** (`src/infrastructure/repositories/PrismaOrganizationRepository.ts`) — 11 `Organization.reconstitute` call sites at lines: 36, 56, 76, 93, 111, 218, 243, 267, 324, 570, 669. Add `allowMultiTreeMembership: org.allowMultiTreeMembership ?? null` (or `created.allowMultiTreeMembership`, `updated.allowMultiTreeMembership` depending on the variable name) to each.

Also update `save()` (line 17-26) — add `allowMultiTreeMembership: data.allowMultiTreeMembership` to the `create` data block.

Also update `update()` (line 258-265) — add `allowMultiTreeMembership: data.allowMultiTreeMembership` to the `update` data block.

- [ ] **Step 6: Run all tests**

Run: `yarn vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/domain/organization/ src/infrastructure/repositories/PrismaOrganizationRepository.ts src/application/
```

---

### Task 3: Error Codes + Localization

**Files:**

- Modify: `src/application/organization/OrganizationErrors.ts:36-43`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add new error codes to OrganizationErrors**

Add before the closing `} as const` in `src/application/organization/OrganizationErrors.ts`:

```typescript
  // Multi-tree membership
  MULTI_MEMBERSHIP_CONFLICT: 'organization.errors.multiMembershipConflict',
  MULTI_MEMBERSHIP_CONFLICTS_EXIST: 'organization.errors.multiMembershipConflictsExist',
  NOT_ROOT_ORG: 'organization.errors.notRootOrg',
```

- [ ] **Step 2: Add localization keys to en.json**

Add to `organization.errors` section in `messages/en.json`:

```json
"multiMembershipConflict": "Cannot merge organizations: some users are members of both trees and at least one tree does not allow multi-membership",
"multiMembershipConflictsExist": "Cannot disable multi-membership: some users are members of multiple organizations in this tree. Remove duplicate memberships first.",
"notRootOrg": "This setting can only be modified on the root organization"
```

- [ ] **Step 3: Add localization keys to ru.json**

Add to `organization.errors` section in `messages/ru.json`:

```json
"multiMembershipConflict": "Невозможно объединить организации: некоторые пользователи состоят в обоих деревьях, а хотя бы одно дерево не позволяет множественное членство",
"multiMembershipConflictsExist": "Невозможно отключить множественное членство: некоторые пользователи состоят в нескольких организациях этого дерева. Сначала удалите дублирующееся членство.",
"notRootOrg": "Эта настройка может быть изменена только для корневой организации"
```

- [ ] **Step 4: Commit**

```bash
git add src/application/organization/OrganizationErrors.ts messages/en.json messages/ru.json
```

---

### Task 4: OrganizationRepository — new methods

**Files:**

- Modify: `src/domain/organization/OrganizationRepository.ts`
- Modify: `src/infrastructure/repositories/PrismaOrganizationRepository.ts`

- [ ] **Step 1: Add method signatures to OrganizationRepository interface**

Add to `src/domain/organization/OrganizationRepository.ts`:

```typescript
  /**
   * Walks up the hierarchy to the root org and returns its allowMultiTreeMembership value.
   * Returns false if root's value is NULL (data corruption fallback).
   */
  getRootAllowMultiTreeMembership(organizationId: string): Promise<boolean>;

  /**
   * Returns userIds that hold accepted memberships in 2+ of the given org IDs.
   * Includes memberships in archived orgs.
   */
  findUsersWithMultipleMembershipsInOrgs(orgIds: string[]): Promise<string[]>;

  /**
   * Updates the allowMultiTreeMembership setting for an organization.
   */
  setAllowMultiTreeMembership(
    organizationId: string,
    value: boolean | null
  ): Promise<void>;
```

- [ ] **Step 2: Implement in PrismaOrganizationRepository**

Add to `src/infrastructure/repositories/PrismaOrganizationRepository.ts`:

```typescript
  async getRootAllowMultiTreeMembership(
    organizationId: string
  ): Promise<boolean> {
    const ancestorIds = await this.getAncestorIds(organizationId);
    const rootId =
      ancestorIds.length > 0
        ? ancestorIds[ancestorIds.length - 1]
        : organizationId;

    const rootOrg = await this.prisma.organization.findUnique({
      where: { id: rootId },
      select: { allowMultiTreeMembership: true },
    });

    return rootOrg?.allowMultiTreeMembership ?? false;
  }

  async findUsersWithMultipleMembershipsInOrgs(
    orgIds: string[]
  ): Promise<string[]> {
    if (orgIds.length === 0) return [];

    const result = await this.prisma.organizationUser.groupBy({
      by: ['userId'],
      where: {
        organizationId: { in: orgIds },
        status: 'accepted',
      },
      having: {
        userId: {
          _count: { gt: 1 },
        },
      },
    });

    return result.map((r: { userId: string }) => r.userId);
  }

  async setAllowMultiTreeMembership(
    organizationId: string,
    value: boolean | null
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { allowMultiTreeMembership: value },
    });
  }
```

- [ ] **Step 3: Update setParentId to also handle allowMultiTreeMembership**

Modify `setParentId()` in `PrismaOrganizationRepository.ts` (line ~472-480):

```typescript
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        parentId,
        // When becoming a child, inherit from root (null). When becoming root, default to false.
        allowMultiTreeMembership: parentId ? null : false,
      },
    });
  }
```

- [ ] **Step 4: Update ALL mock repositories in test files**

Every mock implementing `OrganizationRepository` needs the 3 new methods. Add defaults to each:

```typescript
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(_orgIds: string[]): Promise<string[]> {
    return [];
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): Promise<void> {}
```

Search for files containing `implements OrganizationRepository` or mocks cast `as unknown as OrganizationRepository`.

- [ ] **Step 5: Run all tests**

Run: `yarn vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/organization/OrganizationRepository.ts src/infrastructure/repositories/PrismaOrganizationRepository.ts src/application/ src/domain/
```

---

### Task 5: OrganizationMembershipService — findUsersWithMultipleTreeMemberships

**Files:**

- Modify: `src/domain/organization/OrganizationMembershipService.ts`
- Test: `src/domain/organization/__tests__/OrganizationMembershipService.test.ts`

- [ ] **Step 1: Write failing tests for findUsersWithMultipleTreeMemberships**

Add to `src/domain/organization/__tests__/OrganizationMembershipService.test.ts`. First check how the existing mock works in this test file and extend it to support `findUsersWithMultipleMembershipsInOrgs`. Then add:

```typescript
describe('findUsersWithMultipleTreeMemberships', () => {
  it('should return empty array when no users have multiple memberships', async () => {
    const rootOrg = createOrg('root-1', 'Root', null);
    const childOrg = createOrg('child-1', 'Child', 'root-1');
    orgRepo.addOrganization(rootOrg);
    orgRepo.addOrganization(childOrg);
    orgRepo.addMembership('user-1', 'root-1');

    const result =
      await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
        'root-1',
        orgRepo
      );

    expect(result).toEqual([]);
  });

  it('should return userIds of users in multiple orgs within the tree', async () => {
    const rootOrg = createOrg('root-1', 'Root', null);
    const childOrg = createOrg('child-1', 'Child', 'root-1');
    orgRepo.addOrganization(rootOrg);
    orgRepo.addOrganization(childOrg);
    orgRepo.addMembership('user-1', 'root-1');
    orgRepo.addMembership('user-1', 'child-1');
    orgRepo.addMembership('user-2', 'child-1');

    const result =
      await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
        'root-1',
        orgRepo
      );

    expect(result).toEqual(['user-1']);
  });
});
```

Note: The mock's `findUsersWithMultipleMembershipsInOrgs` must use the `memberships` map to count per-user org memberships.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/domain/organization/__tests__/OrganizationMembershipService.test.ts`
Expected: FAIL — method does not exist

- [ ] **Step 3: Implement findUsersWithMultipleTreeMemberships**

Add to `src/domain/organization/OrganizationMembershipService.ts`:

```typescript
  /**
   * Returns userIds that hold accepted memberships in 2+ orgs within the tree
   * rooted at rootOrgId (including archived orgs).
   */
  static async findUsersWithMultipleTreeMemberships(
    rootOrgId: string,
    organizationRepository: OrganizationRepository
  ): Promise<string[]> {
    const descendantIds =
      await organizationRepository.getDescendantIds(rootOrgId);
    const allTreeOrgIds = [rootOrgId, ...descendantIds];

    return organizationRepository.findUsersWithMultipleMembershipsInOrgs(
      allTreeOrgIds
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/organization/__tests__/OrganizationMembershipService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/OrganizationMembershipService.ts src/domain/organization/__tests__/OrganizationMembershipService.test.ts
```

---

## Chunk 2: Use Case Changes

### Task 6: HandleJoinParentRequestUseCase — overlap check on accept

**Files:**

- Modify: `src/application/organization/HandleJoinParentRequestUseCase.ts`
- Test: `src/application/organization/__tests__/HandleJoinParentRequestUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Update the mock `MockOrganizationRepository` in `HandleJoinParentRequestUseCase.test.ts` to support:

- `acceptedMembers: Map<string, Set<string>>` — orgId → Set<userId>
- `allowMultiTreeMembershipMap: Map<string, boolean | null>`
- `addAcceptedMember(orgId, userId)` helper
- `setAllowMultiTreeMembership(orgId, value)` — stores in map
- Override `findAcceptedMemberUserIdsIncludingDescendants(orgId)` to return members from orgId + descendants using `getDescendantIds`
- Override `getRootAllowMultiTreeMembership(orgId)` to walk ancestors via `getAncestorIds`, find root, return value from map (default `false`)

Then add these tests:

```typescript
it('should block accept when trees have overlapping members and child tree disallows multi-membership', async () => {
  const childOrg = createOrg('child-1', 'Child');
  const parentOrg = createOrg('parent-1', 'Parent');
  orgRepo.addOrganization(childOrg);
  orgRepo.addOrganization(parentOrg);
  orgRepo.addAdmin('parent-1', 'parent-admin');

  orgRepo.addAcceptedMember('child-1', 'user-1');
  orgRepo.addAcceptedMember('parent-1', 'user-1');
  orgRepo.setAllowMultiTreeMembership('child-1', false);
  orgRepo.setAllowMultiTreeMembership('parent-1', false);

  const request = createPendingRequest('req-1', 'child-1', 'parent-1');
  joinParentRepo.addRequest(request);

  const result = await useCase.execute({
    requestId: 'req-1',
    adminUserId: 'parent-admin',
    action: 'accept',
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICT);
  }
});

it('should allow accept when trees have overlapping members and both allow multi-membership', async () => {
  const childOrg = createOrg('child-1', 'Child');
  const parentOrg = createOrg('parent-1', 'Parent');
  orgRepo.addOrganization(childOrg);
  orgRepo.addOrganization(parentOrg);
  orgRepo.addAdmin('parent-1', 'parent-admin');

  orgRepo.addAcceptedMember('child-1', 'user-1');
  orgRepo.addAcceptedMember('parent-1', 'user-1');
  orgRepo.setAllowMultiTreeMembership('child-1', true);
  orgRepo.setAllowMultiTreeMembership('parent-1', true);

  const request = createPendingRequest('req-1', 'child-1', 'parent-1');
  joinParentRepo.addRequest(request);

  const result = await useCase.execute({
    requestId: 'req-1',
    adminUserId: 'parent-admin',
    action: 'accept',
  });

  expect(result.success).toBe(true);
});

it('should block accept when overlapping members and only parent allows multi-membership', async () => {
  const childOrg = createOrg('child-1', 'Child');
  const parentOrg = createOrg('parent-1', 'Parent');
  orgRepo.addOrganization(childOrg);
  orgRepo.addOrganization(parentOrg);
  orgRepo.addAdmin('parent-1', 'parent-admin');

  orgRepo.addAcceptedMember('child-1', 'user-1');
  orgRepo.addAcceptedMember('parent-1', 'user-1');
  orgRepo.setAllowMultiTreeMembership('child-1', false);
  orgRepo.setAllowMultiTreeMembership('parent-1', true);

  const request = createPendingRequest('req-1', 'child-1', 'parent-1');
  joinParentRepo.addRequest(request);

  const result = await useCase.execute({
    requestId: 'req-1',
    adminUserId: 'parent-admin',
    action: 'accept',
  });

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error).toBe(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICT);
  }
});

it('should allow accept when no overlapping members regardless of setting', async () => {
  const childOrg = createOrg('child-1', 'Child');
  const parentOrg = createOrg('parent-1', 'Parent');
  orgRepo.addOrganization(childOrg);
  orgRepo.addOrganization(parentOrg);
  orgRepo.addAdmin('parent-1', 'parent-admin');

  orgRepo.addAcceptedMember('child-1', 'user-1');
  orgRepo.addAcceptedMember('parent-1', 'user-2');
  orgRepo.setAllowMultiTreeMembership('child-1', false);
  orgRepo.setAllowMultiTreeMembership('parent-1', false);

  const request = createPendingRequest('req-1', 'child-1', 'parent-1');
  joinParentRepo.addRequest(request);

  const result = await useCase.execute({
    requestId: 'req-1',
    adminUserId: 'parent-admin',
    action: 'accept',
  });

  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/HandleJoinParentRequestUseCase.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement overlap check in HandleJoinParentRequestUseCase**

Modify the accept path in `src/application/organization/HandleJoinParentRequestUseCase.ts`. After the cycle check (line 63), before `request.accept()`, add:

```typescript
// Check for overlapping members between the two trees
const [childTreeMembers, parentTreeMembers] = await Promise.all([
  this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
    request.childOrgId
  ),
  this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
    request.parentOrgId
  ),
]);

const parentMemberSet = new Set(parentTreeMembers);
const overlappingUserIds = childTreeMembers.filter((id) =>
  parentMemberSet.has(id)
);

if (overlappingUserIds.length > 0) {
  const [childTreeAllows, parentTreeAllows] = await Promise.all([
    this.deps.organizationRepository.getRootAllowMultiTreeMembership(
      request.childOrgId
    ),
    this.deps.organizationRepository.getRootAllowMultiTreeMembership(
      request.parentOrgId
    ),
  ]);

  if (!childTreeAllows || !parentTreeAllows) {
    return failure(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICT);
  }
}
```

Note: The child org's `allowMultiTreeMembership` is set to `NULL` automatically by `setParentId()` (updated in Task 4 Step 3) — no explicit call needed here.

Note: `findAcceptedMemberUserIdsIncludingDescendants` uses `getDescendantIds` which fetches all children regardless of archive status, then queries `OrganizationUser` with `status: 'accepted'` — no archive filtering. So archived org members ARE included as required by the spec. Verify this in the implementation.

Note on transactions: The spec requires the overlap check + setParentId to be atomic. Currently `HandleJoinParentRequestUseCase` doesn't have a `prisma` dependency. For a full transaction, add `PrismaClient` to `HandleJoinParentRequestDependencies` and wrap the overlap check + `request.accept()` + `setParentId()` in `prisma.$transaction(async (tx) => { ... })`. However, since the individual repo methods each do single DB calls and the check-then-act race window is small (admin-initiated, not high-frequency), this can be deferred to a follow-up if needed. If implementing now, the transaction would require passing `tx` to each repo method, which is a larger refactor.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/HandleJoinParentRequestUseCase.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `yarn vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/application/organization/HandleJoinParentRequestUseCase.ts src/application/organization/__tests__/HandleJoinParentRequestUseCase.test.ts
```

---

### Task 7: HandleJoinRequestUseCase — conditional skip of auto-removal

**Files:**

- Modify: `src/application/organization/HandleJoinRequestUseCase.ts:88-94`
- Test: `src/application/organization/__tests__/HandleJoinRequestUseCase.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/application/organization/__tests__/HandleJoinRequestUseCase.test.ts`:

```typescript
it('should skip hierarchy removal when tree allows multi-membership', async () => {
  const parentOrgId = 'org-parent';
  const childOrgId = 'org-child';
  const requesterId = 'user-456';
  const adminId = 'admin-789';

  const parentOrg = Organization.reconstitute({
    id: parentOrgId,
    name: 'Parent Org',
    description: 'Parent desc',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: true,
  });
  organizationRepository.addOrganization(parentOrg);

  const childOrg = Organization.reconstitute({
    id: childOrgId,
    name: 'Child Org',
    description: 'Child desc',
    parentId: parentOrgId,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: null,
  });
  organizationRepository.addOrganization(childOrg);

  organizationRepository.addMembership(requesterId, parentOrgId);

  adminRoles.set(childOrgId, new Set([adminId]));

  const key = `${childOrgId}-${requesterId}`;
  requests.set(key, {
    id: 'request-1',
    organizationId: childOrgId,
    userId: requesterId,
    status: 'pending',
    createdAt: new Date(),
    acceptedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    acceptedByUserId: null,
    rejectedByUserId: null,
  });

  const result = await useCase.execute({
    organizationId: childOrgId,
    requesterId,
    adminId,
    action: 'accept',
  });

  expect(result.success).toBe(true);

  // User should NOT have been removed from parent
  const removed = organizationRepository.getRemovedMemberships();
  expect(removed).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/organization/__tests__/HandleJoinRequestUseCase.test.ts`
Expected: FAIL — user gets removed from parent (current behavior)

- [ ] **Step 3: Implement conditional skip**

In `src/application/organization/HandleJoinRequestUseCase.ts`, replace the `removeUserFromHierarchyOrgs` call (lines ~89-94):

```typescript
// Remove user from existing memberships in hierarchy orgs
// (unless tree allows multi-membership)
const allowsMulti =
  await this.deps.organizationRepository.getRootAllowMultiTreeMembership(
    organizationId
  );

if (!allowsMulti) {
  await OrganizationMembershipService.removeUserFromHierarchyOrgs(
    requesterId,
    organizationId,
    this.deps.organizationRepository
  );
}
```

Add `OrganizationRepository` import if not already present.

- [ ] **Step 4: Update mock to support getRootAllowMultiTreeMembership**

The `MockOrganizationRepository` in this test file needs to walk the org hierarchy to find the root's `allowMultiTreeMembership`. Add:

```typescript
  async getRootAllowMultiTreeMembership(orgId: string): Promise<boolean> {
    const org = this.organizations.get(orgId);
    if (!org) return false;
    if (!org.parentId) return org.allowMultiTreeMembership ?? false;
    return this.getRootAllowMultiTreeMembership(org.parentId);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/HandleJoinRequestUseCase.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/application/organization/HandleJoinRequestUseCase.ts src/application/organization/__tests__/HandleJoinRequestUseCase.test.ts
```

---

### Task 8: HandleInviteUseCase — conditional skip of auto-removal

**Files:**

- Modify: `src/application/invitation/HandleInviteUseCase.ts:191-196`
- Test: `src/application/invitation/__tests__/HandleInviteUseCase.test.ts`

- [ ] **Step 1: Write failing test**

In `src/application/invitation/__tests__/HandleInviteUseCase.test.ts`, the mock `MockOrganizationRepository` uses `vi.fn()` spies for `removeUserFromOrganization`, `getFullTreeOrgIds`, and `findMembershipsByUserId`. Add a `getRootAllowMultiTreeMembership` spy.

Add this test (follow the existing patterns for member invite tests in this file):

```typescript
it('should skip hierarchy removal when tree allows multi-membership for member invite', async () => {
  // Create root org with allowMultiTreeMembership=true
  const rootOrg = Organization.reconstitute({
    id: 'org-root',
    name: 'Root Org',
    description: 'desc',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: true,
  });
  orgRepo.addOrganization(rootOrg);

  // Create child org
  const childOrg = Organization.reconstitute({
    id: 'org-child',
    name: 'Child Org',
    description: 'desc',
    parentId: 'org-root',
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: null,
  });
  orgRepo.addOrganization(childOrg);
  orgRepo.setAdmin('org-child', 'admin-1');

  // Mock getRootAllowMultiTreeMembership to return true
  orgRepo.getRootAllowMultiTreeMembership = vi.fn().mockResolvedValue(true);

  // User exists
  const inviteePhone = PhoneNumber.create('+79991234567');
  if (!inviteePhone.success) return;
  const invitee = User.reconstitute({
    id: 'invitee-1',
    phoneNumber: inviteePhone.value,
    passwordHash: 'hash',
    firstName: 'Test',
    lastName: 'User',
    middleName: null,
    defaultLanguage: 'en',
    createdAt: new Date(),
  });
  userRepo.addUser(invitee);

  // Create a member invite for the child org
  const inviteResult = Invitation.create({
    type: 'member_invite',
    organizationId: 'org-child',
    boardId: null,
    inviterId: 'admin-1',
    inviteeId: 'invitee-1',
  });
  expect(inviteResult.success).toBe(true);
  if (!inviteResult.success) return;
  invitationRepo.addInvitation(inviteResult.value);

  const result = await useCase.execute({
    invitationId: inviteResult.value.id,
    userId: 'invitee-1',
    action: 'accept',
  });

  expect(result.success).toBe(true);

  // removeUserFromOrganization should NOT have been called
  expect(orgRepo.removeUserFromOrganization).not.toHaveBeenCalled();
});
```

Adjust mock setup as needed to match the existing test patterns in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/invitation/__tests__/HandleInviteUseCase.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement conditional skip**

In `src/application/invitation/HandleInviteUseCase.ts`, wrap lines 192-196:

```typescript
// Remove from hierarchy orgs (unless multi-membership allowed)
const allowsMulti =
  await this.deps.organizationRepository.getRootAllowMultiTreeMembership(
    invitation.organizationId
  );

if (!allowsMulti) {
  await OrganizationMembershipService.removeUserFromHierarchyOrgs(
    invitation.inviteeId,
    invitation.organizationId,
    this.deps.organizationRepository
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/invitation/__tests__/HandleInviteUseCase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/invitation/HandleInviteUseCase.ts src/application/invitation/__tests__/HandleInviteUseCase.test.ts
```

---

### Task 9: JoinOrganizationUseCase — relax hierarchy blocking

**Files:**

- Modify: `src/application/organization/JoinOrganizationUseCase.ts:72-85`
- Test: `src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/application/organization/__tests__/JoinOrganizationUseCase.test.ts` (extend mock as needed):

```typescript
it('should allow join when user has pending request in hierarchy and tree allows multi-membership', async () => {
  const rootOrg = Organization.reconstitute({
    id: 'org-root',
    name: 'Root Org',
    description: 'desc',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: true,
  });
  orgRepo.addOrganization(rootOrg);

  const childOrg = Organization.reconstitute({
    id: 'org-child',
    name: 'Child Org',
    description: 'desc',
    parentId: 'org-root',
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: null,
  });
  orgRepo.addOrganization(childOrg);

  // User has pending request in child org
  orgRepo.addPendingRequest('user-1', 'org-child');

  // User tries to join root org
  const result = await useCase.execute({
    organizationId: 'org-root',
    userId: 'user-1',
  });

  // Should NOT be blocked by PENDING_HIERARCHY_REQUEST
  expect(result.success).toBe(true);
});
```

Note: Extend the mock `OrganizationRepository` to support `getRootAllowMultiTreeMembership` (walk to root, return `allowMultiTreeMembership`), `addPendingRequest(userId, orgId)` helper, and `findPendingRequestsByUserId` to return pending orgs from the helper data. Follow existing patterns in the test file.

Fill in the concrete setup following the existing test patterns in this file.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`
Expected: FAIL — blocked by `PENDING_HIERARCHY_REQUEST`

- [ ] **Step 3: Implement conditional hierarchy blocking**

In `src/application/organization/JoinOrganizationUseCase.ts`, wrap lines 72-85:

```typescript
// Check hierarchy constraints - block if pending request anywhere in hierarchy tree
// (unless multi-membership is allowed for this tree)
const allowsMulti =
  await this.deps.organizationRepository.getRootAllowMultiTreeMembership(
    organizationId
  );

if (!allowsMulti) {
  const hierarchyIds =
    await this.deps.organizationRepository.getFullTreeOrgIds(organizationId);

  const pendingOrgs =
    await this.deps.organizationRepository.findPendingRequestsByUserId(userId);

  for (const pendingOrg of pendingOrgs) {
    if (hierarchyIds.includes(pendingOrg.id)) {
      return failure(OrganizationErrors.PENDING_HIERARCHY_REQUEST);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/application/organization/JoinOrganizationUseCase.ts src/application/organization/__tests__/JoinOrganizationUseCase.test.ts
```

---

## Chunk 3: Notification + UpdateOrganizationUseCase

### Task 10: NotifyMultiMembershipSettingChangedUseCase

**Files:**

- Create: `src/application/notification/NotifyMultiMembershipSettingChangedUseCase.ts`
- Create: `src/application/notification/__tests__/NotifyMultiMembershipSettingChangedUseCase.test.ts`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add localization keys**

Add to `notification.types` in `messages/en.json`:

```json
"multiMembershipSettingChanged": {
  "title": "Organization membership setting changed",
  "body": "The multi-membership setting for {organizationName} has been {action}"
}
```

Add to `messages/ru.json`:

```json
"multiMembershipSettingChanged": {
  "title": "Настройка членства в организации изменена",
  "body": "Настройка множественного членства для {organizationName} была {action}"
}
```

Also add action values if not already present in the notification namespace:

- en: `"enabled": "enabled"`, `"disabled": "disabled"`
- ru: `"enabled": "включена"`, `"disabled": "отключена"`

- [ ] **Step 2: Write failing tests**

Create `src/application/notification/__tests__/NotifyMultiMembershipSettingChangedUseCase.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyMultiMembershipSettingChangedUseCase } from '../NotifyMultiMembershipSettingChangedUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Create minimal mock OrganizationRepository (same pattern as NotifyOrgJoinedParentUseCase tests)
// - stores organizations in a Map
// - supports findById, findAcceptedMemberUserIdsIncludingDescendants, findAdminUserIds
// Create MockNotificationRepository that tracks saved notifications via saveBatch

describe('NotifyMultiMembershipSettingChangedUseCase', () => {
  let useCase: NotifyMultiMembershipSettingChangedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notificationRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notificationRepo = new MockNotificationRepository();
    useCase = new NotifyMultiMembershipSettingChangedUseCase({
      organizationRepository: orgRepo,
      notificationRepository: notificationRepo,
    });
  });

  it('should send notification to all tree members when setting changes', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'root-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAcceptedMembers('root-1', ['user-1', 'user-2']);

    await useCase.execute({ rootOrgId: 'root-1', allowed: true });

    const saved = notificationRepo.getSaved();
    expect(saved).toHaveLength(2);
    expect(saved[0].type).toBe('multi_membership_setting_changed');
    expect(saved[0].data).toEqual({
      organizationId: 'root-1',
      organizationName: 'Root Org',
      allowed: true,
    });
    expect(saved.map((n: Notification) => n.userId).sort()).toEqual([
      'user-1',
      'user-2',
    ]);
  });

  it('should not send notifications when org has no members', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'root-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAcceptedMembers('root-1', []);

    await useCase.execute({ rootOrgId: 'root-1', allowed: true });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });

  it('should not send notifications when org not found', async () => {
    await useCase.execute({ rootOrgId: 'nonexistent', allowed: true });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/application/notification/__tests__/NotifyMultiMembershipSettingChangedUseCase.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create the notification use case**

Create `src/application/notification/NotifyMultiMembershipSettingChangedUseCase.ts`:

```typescript
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMultiMembershipSettingChangedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMultiMembershipSettingChangedUseCase {
  constructor(private deps: NotifyMultiMembershipSettingChangedDependencies) {}

  async execute(input: { rootOrgId: string; allowed: boolean }): Promise<void> {
    const { rootOrgId, allowed } = input;

    const rootOrg = await this.deps.organizationRepository.findById(rootOrgId);

    if (!rootOrg) {
      return;
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        rootOrgId
      );

    if (memberUserIds.length === 0) {
      return;
    }

    const notifications = memberUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'multi_membership_setting_changed',
          title: 'notification.types.multiMembershipSettingChanged.title',
          body: 'notification.types.multiMembershipSettingChanged.body',
          data: {
            organizationId: rootOrgId,
            organizationName: rootOrg.name,
            allowed,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/application/notification/__tests__/NotifyMultiMembershipSettingChangedUseCase.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/application/notification/NotifyMultiMembershipSettingChangedUseCase.ts src/application/notification/__tests__/NotifyMultiMembershipSettingChangedUseCase.test.ts messages/en.json messages/ru.json
```

---

### Task 11: UpdateOrganizationUseCase — toggle allowMultiTreeMembership

**Files:**

- Modify: `src/application/organization/UpdateOrganizationUseCase.ts`
- Test: `src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts`:

Note: The existing mock in this test file needs to be extended with:

- `setAllowMultiTreeMembership` tracking (spy or manual tracking)
- `getDescendantIds` returning descendant org IDs
- `findUsersWithMultipleMembershipsInOrgs` returning configurable results
- `getRootAllowMultiTreeMembership` returning configurable values
- Constructor needs `notificationRepository` added (mock with no-op `saveBatch`)

```typescript
describe('allowMultiTreeMembership toggle', () => {
  it('should allow root org to enable multi-membership', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Root Org',
      description: 'desc',
      allowMultiTreeMembership: true,
    });

    expect(result.success).toBe(true);
    expect(orgRepo.getSetAllowMultiTreeMembershipCalls()).toContainEqual({
      orgId: 'org-1',
      value: true,
    });
  });

  it('should reject toggle on child org with NOT_ROOT_ORG', async () => {
    const childOrg = Organization.reconstitute({
      id: 'org-child',
      name: 'Child Org',
      description: 'desc',
      parentId: 'org-parent',
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: null,
    });
    orgRepo.addOrganization(childOrg);
    orgRepo.setAdmin('org-child', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-child',
      userId: 'admin-1',
      name: 'Child Org',
      description: 'desc',
      allowMultiTreeMembership: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ROOT_ORG);
    }
  });

  it('should reject disabling when users have multiple memberships', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setUsersWithMultipleMemberships(['user-1']);

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Root Org',
      description: 'desc',
      allowMultiTreeMembership: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        OrganizationErrors.MULTI_MEMBERSHIP_CONFLICTS_EXIST
      );
    }
  });

  it('should allow disabling when no users have multiple memberships', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setUsersWithMultipleMemberships([]);

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Root Org',
      description: 'desc',
      allowMultiTreeMembership: false,
    });

    expect(result.success).toBe(true);
    expect(orgRepo.getSetAllowMultiTreeMembershipCalls()).toContainEqual({
      orgId: 'org-1',
      value: false,
    });
  });

  it('should not call setAllowMultiTreeMembership when value unchanged', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Root Org',
      description: 'desc',
      allowMultiTreeMembership: false,
    });

    expect(result.success).toBe(true);
    expect(orgRepo.getSetAllowMultiTreeMembershipCalls()).toHaveLength(0);
  });

  it('should not change setting when allowMultiTreeMembership not in input', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Root Org',
      description: 'desc',
    });

    expect(result.success).toBe(true);
    expect(orgRepo.getSetAllowMultiTreeMembershipCalls()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts`
Expected: FAIL

- [ ] **Step 3: Update UpdateOrganizationInput and dependencies**

In `src/application/organization/UpdateOrganizationUseCase.ts`:

```typescript
export interface UpdateOrganizationInput {
  organizationId: string;
  userId: string;
  name: string;
  description: string;
  allowMultiTreeMembership?: boolean;
}

export interface UpdateOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}
```

Update constructor:

```typescript
  private notificationRepository: NotificationRepository;

  constructor(dependencies: UpdateOrganizationDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }
```

- [ ] **Step 4: Implement the toggle logic**

After the existing `this.organizationRepository.update(organization)` call (line 74), add:

```typescript
// Handle allowMultiTreeMembership toggle (root orgs only)
if (input.allowMultiTreeMembership !== undefined) {
  if (organization.parentId !== null) {
    return failure(OrganizationErrors.NOT_ROOT_ORG);
  }

  const currentValue = organization.allowMultiTreeMembership ?? false;
  const newValue = input.allowMultiTreeMembership;

  if (currentValue !== newValue) {
    if (!newValue) {
      const conflictingUsers =
        await OrganizationMembershipService.findUsersWithMultipleTreeMemberships(
          input.organizationId,
          this.organizationRepository
        );

      if (conflictingUsers.length > 0) {
        return failure(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICTS_EXIST);
      }
    }

    await this.organizationRepository.setAllowMultiTreeMembership(
      input.organizationId,
      newValue
    );

    // Notify all tree members (fire-and-forget)
    new NotifyMultiMembershipSettingChangedUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        rootOrgId: input.organizationId,
        allowed: newValue,
      })
      .catch((err) =>
        console.error('Failed to notify multi-membership setting change:', err)
      );
  }
}
```

Add imports at top:

```typescript
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { OrganizationMembershipService } from '../../domain/organization/OrganizationMembershipService';
import { NotifyMultiMembershipSettingChangedUseCase } from '../notification/NotifyMultiMembershipSettingChangedUseCase';
```

- [ ] **Step 5: Fix callers of UpdateOrganizationUseCase**

Search for `new UpdateOrganizationUseCase` in the codebase. Update `updateOrganizationAction` in `src/web/actions/organization.ts` to pass `notificationRepository` to the constructor.

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts`
Expected: PASS

- [ ] **Step 7: Run all tests**

Run: `yarn vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/application/organization/UpdateOrganizationUseCase.ts src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts src/web/actions/organization.ts
```

---

## Chunk 4: UI Changes

### Task 12: Server actions — update + details + new root info endpoint

**Files:**

- Modify: `src/web/actions/organization.ts`

- [ ] **Step 1: Update updateOrganizationAction to handle the new field**

In `updateOrganizationAction` (~line 1276), extract and pass:

```typescript
const allowMultiTreeMembershipRaw = formData.get('allowMultiTreeMembership');
const allowMultiTreeMembership =
  allowMultiTreeMembershipRaw !== null
    ? allowMultiTreeMembershipRaw === 'true'
    : undefined;
```

Pass to use case execute:

```typescript
allowMultiTreeMembership,
```

- [ ] **Step 2: Update getOrganizationDetailsAction to return the setting**

In the serialized response data (~line 819), add:

- `allowMultiTreeMembership: organization.allowMultiTreeMembership`
- `parentId: organization.parentId` (if not already included)

For child orgs, also compute and return:

```typescript
rootOrgMultiMembershipSetting: organization.parentId
  ? {
      allowed: await organizationRepository.getRootAllowMultiTreeMembership(id),
      rootOrgName: /* fetch root org name via ancestors */,
    }
  : null
```

- [ ] **Step 3: Add getRootMultiMembershipInfoAction**

Add new server action for the create dialog's dynamic fetch:

```typescript
export async function getRootMultiMembershipInfoAction(
  orgId: string
): Promise<ActionResult<{ allowed: boolean; rootOrgName: string }>> {
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'common.errors.unauthorized' };
  }

  const allowed =
    await organizationRepository.getRootAllowMultiTreeMembership(orgId);

  const ancestorIds = await organizationRepository.getAncestorIds(orgId);
  const rootId =
    ancestorIds.length > 0 ? ancestorIds[ancestorIds.length - 1] : orgId;
  const rootOrg = await organizationRepository.findById(rootId);

  return {
    success: true,
    data: {
      allowed,
      rootOrgName: rootOrg?.name ?? '',
    },
  };
}
```

- [ ] **Step 4: Update CreateOrganizationUseCase + schema to accept allowMultiTreeMembership**

In `src/application/organization/CreateOrganizationSchema.ts`, add:

```typescript
allowMultiTreeMembership: z.boolean().optional().default(false),
```

In `src/application/organization/CreateOrganizationUseCase.ts`, pass the value to `Organization.create()`:

```typescript
const orgResult = Organization.create(
  input.name,
  input.description,
  userId,
  input.parentId,
  input.allowMultiTreeMembership
);
```

- [ ] **Step 5: Update createOrganizationAction**

Extract from FormData:

```typescript
const allowMultiTreeMembershipRaw = formData.get('allowMultiTreeMembership');
const allowMultiTreeMembership = parentId
  ? false
  : allowMultiTreeMembershipRaw === 'true';
```

Pass in the validated data to the use case.

- [ ] **Step 6: Run all tests**

Run: `yarn vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/web/actions/organization.ts src/application/organization/CreateOrganizationUseCase.ts src/application/organization/CreateOrganizationSchema.ts
```

---

### Task 13: Modify Org Page — add toggle / read-only display

**Files:**

- Modify: `src/app/[locale]/organizations/[id]/modify/page.tsx`
- Modify: `src/app/[locale]/organizations/[id]/modify/OrgEditForm.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add localization keys**

Add to `organization.modify` in `messages/en.json`:

```json
"allowMultiTreeMembershipLabel": "Allow multi-membership within hierarchy",
"allowMultiTreeMembershipDescription": "When enabled, users can be members of multiple organizations within this hierarchy tree",
"allowMultiTreeMembershipInherited": "Multi-membership: {status} (setting from root org \"{rootOrgName}\")",
"allowed": "allowed",
"disallowed": "disallowed"
```

Add Russian translations to `messages/ru.json`:

```json
"allowMultiTreeMembershipLabel": "Разрешить множественное членство в иерархии",
"allowMultiTreeMembershipDescription": "Если включено, пользователи могут состоять в нескольких организациях в рамках этого дерева иерархии",
"allowMultiTreeMembershipInherited": "Множественное членство: {status} (настройка от корневой организации «{rootOrgName}»)",
"allowed": "разрешено",
"disallowed": "запрещено"
```

- [ ] **Step 2: Update OrgEditForm props and state**

In `src/app/[locale]/organizations/[id]/modify/OrgEditForm.tsx`:

Update Props:

```typescript
type Props = {
  organizationId: string;
  currentName: string;
  currentDescription: string;
  isRootOrg: boolean;
  currentAllowMultiTreeMembership: boolean;
  rootOrgMultiMembershipInfo?: {
    allowed: boolean;
    rootOrgName: string;
  };
};
```

Add state:

```typescript
const [allowMultiTreeMembership, setAllowMultiTreeMembership] = useState(
  currentAllowMultiTreeMembership
);
```

Import `SwitchField`, `Switch`, `Description` from catalyst switch module.

- [ ] **Step 3: Add toggle / read-only display to form**

After the description `<Field>`, before closing `</FieldGroup>`, add:

```tsx
{
  isRootOrg ? (
    <SwitchField>
      <Label>{t('allowMultiTreeMembershipLabel')}</Label>
      <Description>{t('allowMultiTreeMembershipDescription')}</Description>
      <Switch
        checked={allowMultiTreeMembership}
        onChange={(val: boolean) => {
          setAllowMultiTreeMembership(val);
          setError(null);
          setSuccess(null);
        }}
        color="brand-green"
        disabled={isPending}
      />
    </SwitchField>
  ) : rootOrgMultiMembershipInfo ? (
    <div className="text-sm text-zinc-600 dark:text-zinc-400">
      {t('allowMultiTreeMembershipInherited', {
        status: rootOrgMultiMembershipInfo.allowed
          ? t('allowed')
          : t('disallowed'),
        rootOrgName: rootOrgMultiMembershipInfo.rootOrgName,
      })}
    </div>
  ) : null;
}
```

Add hidden input inside form (before the submit button):

```tsx
{
  isRootOrg && (
    <input
      type="hidden"
      name="allowMultiTreeMembership"
      value={allowMultiTreeMembership ? 'true' : 'false'}
    />
  );
}
```

- [ ] **Step 4: Update page.tsx to pass new props**

In `src/app/[locale]/organizations/[id]/modify/page.tsx`, the response from `getOrganizationDetailsAction` now includes the new fields. Pass to `<OrgEditForm>`:

```tsx
<OrgEditForm
  organizationId={id}
  currentName={organization.name}
  currentDescription={organization.description}
  isRootOrg={!organization.parentId}
  currentAllowMultiTreeMembership={
    organization.allowMultiTreeMembership ?? false
  }
  rootOrgMultiMembershipInfo={
    result.data.rootOrgMultiMembershipSetting ?? undefined
  }
/>
```

The `organization` object from the action response needs `parentId` and `allowMultiTreeMembership` — ensure Task 12 Step 2 exposes these.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/organizations/[id]/modify/ messages/en.json messages/ru.json
```

---

### Task 14: Create Organization Dialog — add toggle / read-only display

**Files:**

- Modify: `src/web/components/organization/CreateOrganizationDialog.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add localization keys for create dialog**

Add to `organization.create` in `messages/en.json`:

```json
"allowMultiTreeMembership": "Allow multi-membership within hierarchy",
"allowMultiTreeMembershipDescription": "When enabled, users can be members of multiple organizations within this hierarchy tree",
"multiMembershipInherited": "Multi-membership: {status} (inherited from root org \"{rootOrgName}\")"
```

Add corresponding Russian translations to `messages/ru.json`.

- [ ] **Step 2: Update CreateOrganizationDialog state and effects**

In `src/web/components/organization/CreateOrganizationDialog.tsx`:

Add state:

```typescript
const [allowMultiTreeMembership, setAllowMultiTreeMembership] = useState(false);
const [parentRootMultiMembershipInfo, setParentRootMultiMembershipInfo] =
  useState<{ allowed: boolean; rootOrgName: string } | null>(null);
```

Import `getRootMultiMembershipInfoAction` from `@/web/actions/organization`.

When parent is selected (`onChange` of parentId Select), fetch root info:

```typescript
onChange={(e) => {
  const value = e.target.value;
  setSelectedParentId(value);

  if (value) {
    setAutoJoin(false);
    setAllowMultiTreeMembership(false);
    // Fetch root multi-membership info
    getRootMultiMembershipInfoAction(value).then((result) => {
      if (result.success) {
        setParentRootMultiMembershipInfo(result.data);
      }
    });
  } else {
    setAutoJoin(true);
    setParentRootMultiMembershipInfo(null);
  }
}}
```

Reset in `resetForm()`:

```typescript
setAllowMultiTreeMembership(false);
setParentRootMultiMembershipInfo(null);
```

- [ ] **Step 3: Add toggle / read-only display**

After the autoJoin section (after line ~215), add:

```tsx
{
  /* Multi-tree membership setting */
}
{
  !selectedParentId ? (
    <SwitchField>
      <Label>{t('allowMultiTreeMembership')}</Label>
      <Description>{t('allowMultiTreeMembershipDescription')}</Description>
      <Switch
        checked={allowMultiTreeMembership}
        onChange={setAllowMultiTreeMembership}
        color="brand-green"
        disabled={isSubmitting}
      />
    </SwitchField>
  ) : parentRootMultiMembershipInfo ? (
    <div className="text-sm text-zinc-600 dark:text-zinc-400">
      {t('multiMembershipInherited', {
        status: parentRootMultiMembershipInfo.allowed
          ? tModify('allowed')
          : tModify('disallowed'),
        rootOrgName: parentRootMultiMembershipInfo.rootOrgName,
      })}
    </div>
  ) : null;
}

{
  !selectedParentId && (
    <input
      type="hidden"
      name="allowMultiTreeMembership"
      value={allowMultiTreeMembership ? 'true' : 'false'}
    />
  );
}
```

Import `SwitchField`, `Switch` from catalyst. For the `tModify('allowed')`/`tModify('disallowed')` translation keys, either reuse from the modify namespace or add to the create namespace. Simplest: add `"allowed"` and `"disallowed"` to `organization.create` as well.

- [ ] **Step 4: Commit**

```bash
git add src/web/components/organization/CreateOrganizationDialog.tsx messages/en.json messages/ru.json
```

---

## Chunk 5: Final Verification

### Task 15: Verify remove-user-from-archived-org works

**Files:**

- Check: `src/infrastructure/repositories/PrismaOrganizationRepository.ts` (`removeUserFromOrganization`)
- Check: manage-members page for archived org access

- [ ] **Step 1: Verify removeUserFromOrganization works for archived orgs**

`PrismaOrganizationRepository.removeUserFromOrganization()` does a direct `prisma.organizationUser.delete()` with no archive check. Confirmed: no repository changes needed.

- [ ] **Step 2: Verify the manage-members UI allows access to archived orgs**

Check if the manage-members page or server action guards against archived orgs. If it blocks, admins won't be able to remove users from archived orgs to resolve conflicts. If blocked, add a bypass for member removal in archived orgs.

- [ ] **Step 3: Commit if changes needed**

```bash
git add src/app/[locale]/organizations/[id]/manage-members/
```

---

### Task 16: Full test suite + lint + type check

- [ ] **Step 1: Run full test suite**

Run: `yarn vitest run`
Expected: All tests pass

- [ ] **Step 2: Lint check**

Run: `yarn lint`
Expected: No errors

- [ ] **Step 3: Type check**

Run: `yarn tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Manual smoke test**

1. Create root org → toggle shows, defaults to off
2. Create child org under root → read-only display with root name
3. Root org modify page → toggle visible, can enable/disable
4. Child org modify page → read-only display
5. Enable multi-membership → user joins child org while in parent → stays in both
6. Disable multi-membership (no conflicts) → succeeds
7. Try to disable with conflicts → error shown
8. Merge two trees with overlap + both allow → succeeds
9. Merge two trees with overlap + one disallows → error shown

---

## Unresolved Questions

1. Should the toggle-off conflict check return which users/orgs have conflicts so the admin knows who to resolve? Nice UX improvement, not in current spec.
2. Full transactional wrapping of overlap check + setParentId in HandleJoinParentRequestUseCase — noted in Task 6 Step 3 as a potential follow-up. The race window is small (admin-initiated) but not zero.
