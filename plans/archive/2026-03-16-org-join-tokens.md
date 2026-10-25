# Org Join Tokens Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add token-based shareable join links so admins can share URLs that let anyone request to join their organization.

**Architecture:** New `JoinToken` domain entity + repository, 6 use cases, server actions, `/join/[token]` public page, admin token management page. Auth redirect via `returnTo` cookie. Delegates to existing `JoinOrganizationUseCase` for the actual join logic.

**Tech Stack:** Next.js 15 App Router, Prisma, vitest, next-intl, Tailwind + Catalyst components

**Spec:** `docs/superpowers/specs/2026-03-16-org-join-tokens-design.md`

---

## Chunk 1: Domain Layer + Database

### Task 1: Prisma Schema + Migration

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add OrganizationJoinToken model and joinTokenId to OrganizationUser**

Add to `prisma/schema.prisma` after the `OrganizationUser` model:

```prisma
model OrganizationJoinToken {
  id             String    @id @default(cuid())
  organizationId String    @map("organization_id")
  token          String    @unique
  description    String
  maxUses        Int?      @map("max_uses")
  useCount       Int       @default(0) @map("use_count")
  createdById    String    @map("created_by_id")
  createdAt      DateTime  @default(now()) @map("created_at")
  expiredAt      DateTime? @map("expired_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  createdBy    User         @relation("JoinTokenCreator", fields: [createdById], references: [id])
  usages       OrganizationUser[]

  @@index([organizationId])
  @@map("organization_join_tokens")
}
```

Add to `OrganizationUser` model (after `rejectedByUserId` field):

```prisma
  joinTokenId      String?   @map("join_token_id")
  joinToken        OrganizationJoinToken? @relation(fields: [joinTokenId], references: [id])
```

Add to `User` model relations:

```prisma
  joinTokensCreated  OrganizationJoinToken[] @relation("JoinTokenCreator")
```

Add to `Organization` model relations:

```prisma
  joinTokens          OrganizationJoinToken[]
```

- [ ] **Step 2: Generate migration**

Run: `yarn prisma migrate dev --name add_join_tokens`

- [ ] **Step 3: Generate Prisma client**

Run: `yarn prisma generate`

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add OrganizationJoinToken schema + migration"
```

---

### Task 2: JoinToken Domain Codes

**Files:**

- Create: `src/domain/organization/JoinTokenDomainCodes.ts`

- [ ] **Step 1: Create domain codes file**

```typescript
export const JoinTokenDomainCodes = {
  DESCRIPTION_EMPTY: 'domain.joinToken.descriptionEmpty',
  DESCRIPTION_TOO_LONG: 'domain.joinToken.descriptionTooLong',
  MAX_USES_INVALID: 'domain.joinToken.maxUsesInvalid',
  ALREADY_EXPIRED: 'domain.joinToken.alreadyExpired',
  NOT_EXPIRED: 'domain.joinToken.notExpired',
  TOKEN_EXHAUSTED: 'domain.joinToken.tokenExhausted',
} as const;

export type JoinTokenDomainCode =
  (typeof JoinTokenDomainCodes)[keyof typeof JoinTokenDomainCodes];
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/organization/JoinTokenDomainCodes.ts
git commit -m "feat: add JoinToken domain codes"
```

---

### Task 3: JoinToken Domain Entity

**Files:**

- Create: `src/domain/organization/JoinToken.ts`
- Create: `src/domain/organization/__tests__/JoinToken.test.ts`

- [ ] **Step 1: Write failing tests for JoinToken entity**

Follow pattern from `src/domain/organization/__tests__/Organization.test.ts`. Test file: `src/domain/organization/__tests__/JoinToken.test.ts`

Tests to write:

- `JoinToken.create` succeeds with valid description
- `JoinToken.create` fails with empty description
- `JoinToken.create` fails with description > 500 chars
- `JoinToken.create` fails with maxUses <= 0
- `JoinToken.create` succeeds with null maxUses (unlimited)
- `JoinToken.create` generates a 10-char token (a-z, 2-9 only)
- `reconstitute` creates entity from props
- `expire()` sets expiredAt, fails if already expired
- `reactivate()` clears expiredAt, fails if not expired
- `updateMaxUses()` updates value, fails with <= 0
- `updateMaxUses(null)` sets unlimited
- `incrementUseCount()` increments, fails if exhausted
- `canBeUsed()` returns false when expired
- `canBeUsed()` returns false when useCount >= maxUses
- `canBeUsed()` returns true when active and under limit
- `toJSON()` returns all props

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/domain/organization/__tests__/JoinToken.test.ts`
Expected: FAIL (JoinToken not defined)

- [ ] **Step 3: Implement JoinToken entity**

File: `src/domain/organization/JoinToken.ts`

Follow pattern from `src/domain/organization/JoinParentRequest.ts`:

- Private constructor with `JoinTokenProps`
- Static `create()` factory with validation
- Static `reconstitute()` for DB hydration
- Getters for all props
- `expire()`, `reactivate()`, `updateMaxUses()`, `incrementUseCount()` transition methods
- `isActive()`, `isExpired()`, `hasReachedMaxUses()`, `canBeUsed()` status methods
- `toJSON()` serialization

Token generation: use `crypto.randomBytes(10)` converted to 31-char charset `abcdefghjkmnpqrstuvwxyz23456789` (no 0, 1, i, l, o), take first 10 chars.

```typescript
import { randomBytes } from 'crypto';

const TOKEN_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';
const TOKEN_LENGTH = 10;

function generateToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let token = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_CHARSET[bytes[i] % TOKEN_CHARSET.length];
  }
  return token;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/organization/__tests__/JoinToken.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/JoinToken.ts src/domain/organization/__tests__/JoinToken.test.ts
git commit -m "feat: add JoinToken domain entity with tests"
```

---

### Task 4: JoinToken Repository Interface

**Files:**

- Create: `src/domain/organization/JoinTokenRepository.ts`

- [ ] **Step 1: Create repository interface**

```typescript
import { JoinToken } from './JoinToken';

export interface JoinTokenWithCreator {
  joinToken: JoinToken;
  creatorName: string;
}

export interface JoinTokenSearchFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface JoinTokenRepository {
  save(joinToken: JoinToken): Promise<JoinToken>;
  update(joinToken: JoinToken): Promise<JoinToken>;
  findById(id: string): Promise<JoinToken | null>;
  findByToken(token: string): Promise<JoinToken | null>;
  findByOrganizationId(
    organizationId: string,
    filters: JoinTokenSearchFilters
  ): Promise<{ tokens: JoinTokenWithCreator[]; totalCount: number }>;
  tryIncrementUseCount(id: string): Promise<boolean>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/organization/JoinTokenRepository.ts
git commit -m "feat: add JoinTokenRepository interface"
```

---

### Task 5: Prisma JoinToken Repository Implementation

**Files:**

- Create: `src/infrastructure/repositories/PrismaJoinTokenRepository.ts`
- Modify: `src/infrastructure/index.ts`

- [ ] **Step 1: Implement PrismaJoinTokenRepository**

Follow pattern from `src/infrastructure/repositories/PrismaJoinParentRequestRepository.ts`.

Key implementation details:

- `save()`: maps domain entity props to Prisma create
- `update()`: maps entity props to Prisma update (description, maxUses, expiredAt)
- `findById()` / `findByToken()`: query + reconstitute
- `findByOrganizationId()`: search with `OR` on `token` and `description` fields using `contains` (case-insensitive via `mode: 'insensitive'`), include `createdBy` for creator name, paginate with `skip`/`take`, return `totalCount` via `count()`
- `tryIncrementUseCount()`: atomic conditional update:

  ```typescript
  const result = await this.prisma.organizationJoinToken.updateMany({
    where: {
      id,
      OR: [
        { maxUses: null },
        { useCount: { lt: this.prisma.organizationJoinToken.fields.maxUses } },
      ],
    },
    data: { useCount: { increment: 1 } },
  });
  return result.count > 0;
  ```

  Note: Prisma `updateMany` with field comparison may need raw SQL. Use `$executeRaw` if needed:

  ```typescript
  const count = await this.prisma.$executeRaw`
    UPDATE organization_join_tokens
    SET use_count = use_count + 1
    WHERE id = ${id}
    AND (max_uses IS NULL OR use_count < max_uses)
  `;
  return count > 0;
  ```

- [ ] **Step 2: Export from infrastructure index**

Add to `src/infrastructure/index.ts`:

```typescript
export { PrismaJoinTokenRepository } from './repositories/PrismaJoinTokenRepository';
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/PrismaJoinTokenRepository.ts src/infrastructure/index.ts
git commit -m "feat: add PrismaJoinTokenRepository"
```

---

## Chunk 2: Application Layer (Use Cases)

### Task 6: JoinToken Application Errors

**Files:**

- Create: `src/application/organization/JoinTokenErrors.ts`

- [ ] **Step 1: Create error codes**

```typescript
// Token-specific errors only. For org/admin errors, reuse OrganizationErrors.
export const JoinTokenErrors = {
  NOT_FOUND: 'joinToken.errors.notFound',
  EXPIRED: 'joinToken.errors.expired',
  EXHAUSTED: 'joinToken.errors.exhausted',
} as const;

export type JoinTokenError =
  (typeof JoinTokenErrors)[keyof typeof JoinTokenErrors];
```

For org not found, org archived, and not admin errors, use `OrganizationErrors.NOT_FOUND`, `OrganizationErrors.ARCHIVED`, and `OrganizationErrors.NOT_ADMIN` from `src/application/organization/OrganizationErrors.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/application/organization/JoinTokenErrors.ts
git commit -m "feat: add JoinToken application error codes"
```

---

### Task 7: CreateJoinTokenUseCase

**Files:**

- Create: `src/application/organization/CreateJoinTokenUseCase.ts`
- Create: `src/application/organization/CreateJoinTokenSchema.ts`
- Create: `src/application/organization/__tests__/CreateJoinTokenUseCase.test.ts`

- [ ] **Step 1: Create Zod schema**

```typescript
import { z } from 'zod';

export const CreateJoinTokenSchema = z.object({
  organizationId: z.string().min(1),
  description: z.string().min(1).max(500),
  maxUses: z.number().int().positive().nullable().optional(),
});

export type CreateJoinTokenInput = z.infer<typeof CreateJoinTokenSchema>;
```

- [ ] **Step 2: Write failing tests**

Test cases:

- Succeeds when admin creates token with description only
- Succeeds when admin creates token with description + maxUses
- Fails when org not found
- Fails when org archived
- Fails when actor is not admin or superadmin
- Succeeds when actor is superadmin (not org admin)

Use mock pattern from `src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`:

- MockOrganizationRepository, MockJoinTokenRepository, MockUserRepository
- Create test orgs via `Organization.reconstitute()`

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/CreateJoinTokenUseCase.test.ts`

- [ ] **Step 4: Implement use case**

```typescript
export interface CreateJoinTokenDependencies {
  organizationRepository: OrganizationRepository;
  joinTokenRepository: JoinTokenRepository;
  userRepository: UserRepository;
}

export class CreateJoinTokenUseCase {
  constructor(private deps: CreateJoinTokenDependencies) {}

  async execute(
    input: CreateJoinTokenInput,
    actorUserId: string
  ): Promise<Result<JoinToken, string>> {
    // 1. Check org exists + not archived
    // 2. Check actor is admin or superadmin
    // 3. JoinToken.create(...)
    // 4. Save via repository
    // 5. Return token
  }
}
```

Admin check pattern (from `RemoveOrgAdminUseCase.ts` / `RequestJoinParentUseCase.ts`):

```typescript
const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(actorUserId);
if (!isSuperAdmin) {
  const isAdmin = await this.deps.organizationRepository.isUserAdmin(
    actorUserId,
    organizationId
  );
  if (!isAdmin) return failure(OrganizationErrors.NOT_ADMIN);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/CreateJoinTokenUseCase.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/application/organization/CreateJoinTokenUseCase.ts src/application/organization/CreateJoinTokenSchema.ts src/application/organization/__tests__/CreateJoinTokenUseCase.test.ts
git commit -m "feat: add CreateJoinTokenUseCase"
```

---

### Task 8: ExpireJoinTokenUseCase

**Files:**

- Create: `src/application/organization/ExpireJoinTokenUseCase.ts`
- Create: `src/application/organization/__tests__/ExpireJoinTokenUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:

- Succeeds when admin expires active token
- Fails when token not found
- Fails when actor is not admin/superadmin of token's org
- Fails when token already expired

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/ExpireJoinTokenUseCase.test.ts`

- [ ] **Step 3: Implement use case**

Pattern: find token → check admin/superadmin of `token.organizationId` → call `token.expire()` → update via repository.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/ExpireJoinTokenUseCase.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/application/organization/ExpireJoinTokenUseCase.ts src/application/organization/__tests__/ExpireJoinTokenUseCase.test.ts
git commit -m "feat: add ExpireJoinTokenUseCase"
```

---

### Task 9: ReactivateJoinTokenUseCase

**Files:**

- Create: `src/application/organization/ReactivateJoinTokenUseCase.ts`
- Create: `src/application/organization/__tests__/ReactivateJoinTokenUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:

- Succeeds when admin reactivates expired token
- Fails when token not found
- Fails when actor not admin/superadmin
- Fails when token not expired

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/ReactivateJoinTokenUseCase.test.ts`

- [ ] **Step 3: Implement use case**

Pattern: find token → check admin/superadmin → call `token.reactivate()` → update via repository.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/ReactivateJoinTokenUseCase.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/application/organization/ReactivateJoinTokenUseCase.ts src/application/organization/__tests__/ReactivateJoinTokenUseCase.test.ts
git commit -m "feat: add ReactivateJoinTokenUseCase"
```

---

### Task 10: UpdateJoinTokenMaxUsesUseCase

**Files:**

- Create: `src/application/organization/UpdateJoinTokenMaxUsesUseCase.ts`
- Create: `src/application/organization/UpdateJoinTokenMaxUsesSchema.ts`
- Create: `src/application/organization/__tests__/UpdateJoinTokenMaxUsesUseCase.test.ts`

- [ ] **Step 1: Create schema**

```typescript
import { z } from 'zod';

export const UpdateJoinTokenMaxUsesSchema = z.object({
  tokenId: z.string().min(1),
  maxUses: z.number().int().positive().nullable(),
});

export type UpdateJoinTokenMaxUsesInput = z.infer<
  typeof UpdateJoinTokenMaxUsesSchema
>;
```

- [ ] **Step 2: Write failing tests**

Test cases:

- Succeeds when admin updates maxUses to a number
- Succeeds when admin sets maxUses to null (unlimited)
- Fails when token not found
- Fails when actor not admin/superadmin

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/UpdateJoinTokenMaxUsesUseCase.test.ts`

- [ ] **Step 4: Implement use case**

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/UpdateJoinTokenMaxUsesUseCase.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/application/organization/UpdateJoinTokenMaxUsesUseCase.ts src/application/organization/UpdateJoinTokenMaxUsesSchema.ts src/application/organization/__tests__/UpdateJoinTokenMaxUsesUseCase.test.ts
git commit -m "feat: add UpdateJoinTokenMaxUsesUseCase"
```

---

### Task 11: GetJoinTokensByOrgUseCase

**Files:**

- Create: `src/application/organization/GetJoinTokensByOrgUseCase.ts`
- Create: `src/application/organization/__tests__/GetJoinTokensByOrgUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:

- Returns paginated tokens for admin
- Returns empty list when no tokens
- Fails when org not found
- Fails when actor not admin/superadmin
- Filters by search term

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/GetJoinTokensByOrgUseCase.test.ts`

- [ ] **Step 3: Implement use case**

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/GetJoinTokensByOrgUseCase.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/application/organization/GetJoinTokensByOrgUseCase.ts src/application/organization/__tests__/GetJoinTokensByOrgUseCase.test.ts
git commit -m "feat: add GetJoinTokensByOrgUseCase"
```

---

### Task 12: GetJoinTokenPublicInfoUseCase

**Files:**

- Create: `src/application/organization/GetJoinTokenPublicInfoUseCase.ts`
- Create: `src/application/organization/__tests__/GetJoinTokenPublicInfoUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:

- Returns org name, description, member count for valid active token
- Fails when token not found
- Fails when token expired
- Fails when token exhausted (useCount >= maxUses)
- Fails when org archived

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/GetJoinTokenPublicInfoUseCase.test.ts`

- [ ] **Step 3: Implement use case**

No auth required. Dependencies: `JoinTokenRepository`, `OrganizationRepository`, `PrismaClient` (for member count query).

```typescript
export class GetJoinTokenPublicInfoUseCase {
  async execute(tokenValue: string): Promise<
    Result<
      {
        organizationId: string;
        organizationName: string;
        organizationDescription: string;
        memberCount: number;
      },
      string
    >
  > {
    // 1. Find token by value
    // 2. Check token.canBeUsed()
    // 3. Find org, check not archived
    // 4. Count accepted members
    // 5. Return public info
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/GetJoinTokenPublicInfoUseCase.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/application/organization/GetJoinTokenPublicInfoUseCase.ts src/application/organization/__tests__/GetJoinTokenPublicInfoUseCase.test.ts
git commit -m "feat: add GetJoinTokenPublicInfoUseCase"
```

---

### Task 13: Modify JoinOrganizationUseCase + UseJoinTokenUseCase

**Files:**

- Modify: `src/application/organization/JoinOrganizationSchema.ts`
- Modify: `src/application/organization/JoinOrganizationUseCase.ts`
- Modify: `src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`
- Create: `src/application/organization/UseJoinTokenUseCase.ts`
- Create: `src/application/organization/__tests__/UseJoinTokenUseCase.test.ts`

- [ ] **Step 1: Add joinTokenId to JoinOrganizationSchema**

In `src/application/organization/JoinOrganizationSchema.ts`, add optional field:

```typescript
export const JoinOrganizationSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  joinTokenId: z.string().optional(),
});
```

- [ ] **Step 2: Modify JoinOrganizationUseCase to pass joinTokenId**

In `src/application/organization/JoinOrganizationUseCase.ts`:

- Line 102 (`create` data): add `joinTokenId: input.joinTokenId ?? null`
- Line 93 (`update` data): add `joinTokenId: input.joinTokenId ?? null`

- [ ] **Step 3: Add test for joinTokenId in existing test file**

Add test to `src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`:

- "should pass joinTokenId to create when provided"
- Verify the `prisma.organizationUser.create` call includes `joinTokenId`

- [ ] **Step 4: Run existing JoinOrganization tests**

Run: `yarn vitest run src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`
Expected: PASS (existing tests unaffected, new test passes)

- [ ] **Step 5: Write failing tests for UseJoinTokenUseCase**

Test cases:

- Succeeds: valid token → delegates to JoinOrganizationUseCase → increments useCount
- Fails when token not found
- Fails when token expired
- Fails when token exhausted (tryIncrementUseCount returns false)
- Fails when org archived
- Fails when JoinOrganizationUseCase fails (already member, etc.)
- When join fails, useCount is NOT incremented (tryIncrementUseCount called before delegation, but we need to handle rollback)

Implementation note: The use case should call `tryIncrementUseCount` FIRST (optimistic), then delegate to JoinOrganizationUseCase. If join fails, best-effort decrement. This prevents race conditions.

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn vitest run src/application/organization/__tests__/UseJoinTokenUseCase.test.ts`

- [ ] **Step 7: Implement UseJoinTokenUseCase**

```typescript
export class UseJoinTokenUseCase {
  constructor(
    private deps: {
      joinTokenRepository: JoinTokenRepository;
      organizationRepository: OrganizationRepository;
      joinOrganizationUseCase: JoinOrganizationUseCase;
    }
  ) {}

  async execute(
    tokenValue: string,
    userId: string
  ): Promise<Result<{ organizationId: string }, string>> {
    // 1. Find token
    // 2. Check not expired, org not archived
    // 3. tryIncrementUseCount (atomic, race-safe)
    // 4. Delegate to JoinOrganizationUseCase with joinTokenId
    // 5. If join fails, best-effort decrement (update useCount - 1)
    // 6. Return { organizationId }
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/UseJoinTokenUseCase.test.ts`

- [ ] **Step 9: Commit**

```bash
git add src/application/organization/JoinOrganizationSchema.ts src/application/organization/JoinOrganizationUseCase.ts src/application/organization/__tests__/JoinOrganizationUseCase.test.ts src/application/organization/UseJoinTokenUseCase.ts src/application/organization/__tests__/UseJoinTokenUseCase.test.ts
git commit -m "feat: add UseJoinTokenUseCase, modify JoinOrganizationUseCase for joinTokenId"
```

---

## Chunk 3: Server Actions + Auth Redirect

### Task 14: Localization Messages

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add English messages**

Add to `messages/en.json`:

Under `"domain"` section:

```json
"joinToken": {
  "descriptionEmpty": "Token description is required",
  "descriptionTooLong": "Token description is too long (max 500 characters)",
  "maxUsesInvalid": "Max uses must be a positive number",
  "alreadyExpired": "Token is already expired",
  "notExpired": "Token is not expired",
  "tokenExhausted": "Token has reached its maximum number of uses"
}
```

Add new top-level `"joinToken"` section:

```json
"joinToken": {
  "page": {
    "title": "Join {orgName}",
    "description": "You have been invited to request membership in this organization",
    "confirmButton": "Confirm Join Request",
    "confirming": "Submitting...",
    "loginToJoin": "Sign in to join",
    "registerToJoin": "Create account to join",
    "requestSent": "Your join request has been sent. You will be notified when it is reviewed.",
    "memberCount": "{count} members"
  },
  "errors": {
    "notFound": "This join link is invalid",
    "expired": "This join link has expired",
    "exhausted": "This join link is no longer active",
    "orgArchived": "This organization is no longer active"
  },
  "manage": {
    "title": "Manage Join Links",
    "backToModify": "Back to organization settings",
    "createTitle": "Create Join Link",
    "description": "Description",
    "descriptionPlaceholder": "e.g., Posted on community bulletin board",
    "maxUses": "Max uses",
    "maxUsesPlaceholder": "Leave empty for unlimited",
    "create": "Create",
    "creating": "Creating...",
    "searchPlaceholder": "Search tokens...",
    "noTokens": "No join links yet",
    "copyLink": "Copy link",
    "copySuccess": "Link copied to clipboard",
    "expire": "Expire",
    "reactivate": "Reactivate",
    "editMaxUses": "Edit max uses",
    "save": "Save",
    "cancel": "Cancel",
    "status": {
      "active": "Active",
      "expired": "Expired",
      "exhausted": "Exhausted"
    },
    "table": {
      "description": "Description",
      "token": "Token",
      "created": "Created",
      "creator": "Creator",
      "uses": "Uses",
      "status": "Status",
      "actions": "Actions",
      "unlimited": "Unlimited"
    }
  }
}
```

Add to `"organization"."modify"` section:

```json
"manageTokens": "Manage Join Links"
```

- [ ] **Step 2: Add Russian messages**

Same structure in `messages/ru.json` with Russian translations.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/ru.json
git commit -m "feat: add joinToken localization messages (en + ru)"
```

---

### Task 15: Server Actions

**Files:**

- Create: `src/web/actions/joinToken.ts`

- [ ] **Step 1: Create server actions file**

Follow pattern from `src/web/actions/organization.ts`:

```typescript
'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { ActionResult } from '@/web/actions/organization';
// ... import use cases, schemas, repositories
```

Actions to implement:

- `createJoinTokenAction(formData)` → rate limit, auth, admin check via use case, Zod validate, returns `{ token: string }`
- `expireJoinTokenAction(formData)` → rate limit, auth, execute use case
- `reactivateJoinTokenAction(formData)` → rate limit, auth, execute use case
- `updateJoinTokenMaxUsesAction(formData)` → rate limit, auth, Zod validate, execute use case
- `getJoinTokensByOrgAction(orgId, search?, page?, pageSize?)` → rate limit, auth, execute use case
- `joinViaTokenAction(formData)` → rate limit, auth, execute UseJoinTokenUseCase, translate error codes

Error code translation pattern (from `joinOrganizationAction` lines 467-476):

```typescript
if (!result.success) {
  const errorKey = result.error;
  if (errorKey.startsWith('joinToken.errors.')) {
    const tJoinToken = await getTranslations('joinToken');
    return {
      success: false,
      error: tJoinToken(errorKey.replace('joinToken.', '') as any),
    };
  }
  if (errorKey.startsWith('organization.errors.')) {
    const tOrg = await getTranslations('organization');
    return {
      success: false,
      error: tOrg(errorKey.replace('organization.', '') as any),
    };
  }
  return { success: false, error: errorKey };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/web/actions/joinToken.ts
git commit -m "feat: add joinToken server actions"
```

---

### Task 16: returnTo Cookie Utility

**IMPORTANT:** Server and client code must be in separate files. Mixing `cookies()` from `next/headers` with client-side `document.cookie` in one file causes build errors when client components import it.

**Files:**

- Create: `src/web/lib/returnToValidation.ts` (shared validation, no server/client deps)
- Create: `src/web/lib/returnTo.server.ts` (server-side cookie operations)
- Create: `src/web/lib/returnTo.client.ts` (client-side cookie operations)

- [ ] **Step 1: Create shared validation utility**

`src/web/lib/returnToValidation.ts`:

```typescript
export const RETURN_TO_COOKIE_NAME = 'returnTo';

export function isValidReturnToPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  const afterSlash = path.substring(1);
  const slashIndex = afterSlash.indexOf('/');
  const colonIndex = afterSlash.indexOf(':');
  if (colonIndex !== -1 && (slashIndex === -1 || colonIndex < slashIndex))
    return false;
  return true;
}
```

- [ ] **Step 2: Create server-side utility**

`src/web/lib/returnTo.server.ts`:

```typescript
import { cookies } from 'next/headers';
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from './returnToValidation';

const MAX_AGE = 600; // 10 minutes

/** Server-side: set returnTo cookie */
export async function setReturnToCookie(path: string): Promise<void> {
  if (!isValidReturnToPath(path)) return;
  const cookieStore = await cookies();
  cookieStore.set(RETURN_TO_COOKIE_NAME, path, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

/** Server-side: consume returnTo cookie (read + delete) */
export async function consumeReturnToCookieServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(RETURN_TO_COOKIE_NAME)?.value ?? null;
  if (value) {
    cookieStore.delete(RETURN_TO_COOKIE_NAME);
    if (!isValidReturnToPath(value)) return null;
  }
  return value;
}
```

- [ ] **Step 3: Create client-side utility**

`src/web/lib/returnTo.client.ts`:

```typescript
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from './returnToValidation';

/** Client-side: consume returnTo cookie (read + delete) */
export function consumeReturnToClient(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${RETURN_TO_COOKIE_NAME}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  if (value) {
    document.cookie = `${RETURN_TO_COOKIE_NAME}=; max-age=0; path=/`;
    if (!isValidReturnToPath(value)) return null;
  }
  return value;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/web/lib/returnToValidation.ts src/web/lib/returnTo.server.ts src/web/lib/returnTo.client.ts
git commit -m "feat: add returnTo cookie utility for auth redirect"
```

---

### Task 17: Modify Auth Components for returnTo

**Files:**

- Modify: `src/web/components/auth/LoginForm.tsx`
- Modify: `src/web/components/privacy/PrivacySetupForm.tsx`
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `src/app/[locale]/privacy-setup/page.tsx`

- [ ] **Step 1: Modify LoginForm.tsx**

In `src/web/components/auth/LoginForm.tsx`:

Add import at top:

```typescript
import { consumeReturnToClient } from '@/web/lib/returnTo.client';
```

Change line 86 (`router.push('/home')`) to:

```typescript
const returnTo = consumeReturnToClient();
router.push(returnTo || '/home');
```

Change the `useRouter` import from `next/navigation` to `@/src/i18n/routing` for consistent locale handling (line 5):

```typescript
import { useRouter } from '@/src/i18n/routing';
```

**Note:** This change affects both `router.push('/confirm-phone')` (line 84) and `router.push('/home')` (line 86). The i18n router auto-prepends the locale, which is the correct behavior. Verify both paths work after the change.

- [ ] **Step 2: Modify PrivacySetupForm.tsx**

In `src/web/components/privacy/PrivacySetupForm.tsx`:

Add import at top:

```typescript
import { consumeReturnToClient } from '@/web/lib/returnTo.client';
```

Change line 54 (`router.push('/home')`) to:

```typescript
const returnTo = consumeReturnToClient();
router.push(returnTo || '/home');
```

Note: PrivacySetupForm already uses `useRouter` from `@/src/i18n/routing` (line 5).

- [ ] **Step 3: Modify login/page.tsx server redirect**

In `src/app/[locale]/login/page.tsx`, the server-side redirect when user is already logged in:

Add import:

```typescript
import { consumeReturnToCookieServer } from '@/web/lib/returnTo.server';
```

Change `if (user) redirect('/home')` to:

```typescript
if (user) {
  const returnTo = await consumeReturnToCookieServer();
  redirect(returnTo || '/home');
}
```

- [ ] **Step 4: Modify privacy-setup/page.tsx server redirect**

In `src/app/[locale]/privacy-setup/page.tsx`, line 30-32:

Add import:

```typescript
import { consumeReturnToCookieServer } from '@/web/lib/returnTo.server';
```

Change `if (user.privacySetupCompleted) redirect('/home')` to:

```typescript
if (user.privacySetupCompleted) {
  const returnTo = await consumeReturnToCookieServer();
  redirect(returnTo || '/home');
}
```

- [ ] **Step 5: Commit**

```bash
git add src/web/components/auth/LoginForm.tsx src/web/components/privacy/PrivacySetupForm.tsx src/app/[locale]/login/page.tsx src/app/[locale]/privacy-setup/page.tsx
git commit -m "feat: add returnTo cookie support to auth flow"
```

---

## Chunk 4: Frontend Pages

### Task 18: /join/[token] Public Page

**Files:**

- Create: `src/app/[locale]/join/[token]/page.tsx`
- Create: `src/app/[locale]/join/[token]/JoinConfirmButton.tsx`

- [ ] **Step 1: Create the server component page**

`src/app/[locale]/join/[token]/page.tsx`:

This is a PUBLIC page (no `AuthenticatedLayout`). Server component that:

1. Extracts `token` from params
2. Sets returnTo cookie: `await setReturnToCookie('/join/' + token)`
3. Calls `GetJoinTokenPublicInfoUseCase` to get org info
4. Checks `getCurrentUser()` to determine auth state
5. Renders:
   - Error state: centered card with error message
   - Logged in: org info card + `<JoinConfirmButton>` client component
   - Not logged in: org info card + "Sign in to join" and "Create account to join" links (to `/login` and `/register`)

Follows the styling pattern from `privacy-setup/page.tsx` — centered card layout with max-w-lg.

Use `Link` from `@/src/i18n/routing` for login/register links. Use `prefetch={false}`.

- [ ] **Step 2: Create JoinConfirmButton client component**

`src/app/[locale]/join/[token]/JoinConfirmButton.tsx`:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { joinViaTokenAction } from '@/web/actions/joinToken';
import { toast } from 'sonner';

export function JoinConfirmButton({ token }: { token: string }) {
  const t = useTranslations('joinToken.page');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('token', token);
      const result = await joinViaTokenAction(formData);
      if (!result.success) {
        setError(result.error);
      } else {
        toast.success(t('requestSent'));
        router.push(`/organizations/${result.data.organizationId}`);
      }
    });
  }

  return (
    <>
      {error && <AlertBanner color="red">{error}</AlertBanner>}
      <Button
        color="brand-green"
        className="w-full"
        onClick={handleConfirm}
        disabled={isPending}
      >
        {isPending ? t('confirming') : t('confirmButton')}
      </Button>
    </>
  );
}
```

- [ ] **Step 3: Verify page renders**

Run: `yarn dev` and navigate to `/ru/join/nonexistent` — should see "This join link is invalid" error.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/join/
git commit -m "feat: add /join/[token] public page with confirm button"
```

---

### Task 19: Token Management Page

**Files:**

- Create: `src/app/[locale]/organizations/[id]/manage-tokens/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-tokens/CreateTokenSection.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-tokens/TokenList.tsx`
- Modify: `src/app/[locale]/organizations/[id]/modify/page.tsx`

- [ ] **Step 1: Create the server component page**

`src/app/[locale]/organizations/[id]/manage-tokens/page.tsx`:

Follow pattern from `src/app/[locale]/organizations/[id]/modify/page.tsx`:

- Auth check (getCurrentUser)
- Admin/superadmin check (redirect to org detail if not)
- Fetch initial tokens via `getJoinTokensByOrgAction`
- Render `AuthenticatedLayout` with back link, heading, CreateTokenSection, TokenList

- [ ] **Step 2: Create CreateTokenSection client component**

Form with:

- Description textarea (required)
- Max uses number input (optional)
- Submit button calling `createJoinTokenAction`
- Success: refresh page, show toast
- Error: show AlertBanner

- [ ] **Step 3: Create TokenList client component**

Features:

- Search input with debounce
- Paginated list of tokens (use existing pagination patterns)
- Each row: description, token value (truncated), created date, creator name, uses (current/max or "Unlimited"), status badge, actions
- Actions per row:
  - Copy link button: `navigator.clipboard.writeText(url)` + toast
  - Expire/Reactivate button (calls respective action)
  - Edit max uses (inline edit with save/cancel)
- Use `prefetch={false}` on any Link components in the list

- [ ] **Step 4: Add "Manage Join Links" link to modify page**

In `src/app/[locale]/organizations/[id]/modify/page.tsx`, add a link after the MembershipSection (around line 170):

```tsx
<Divider />
<div>
  <Link href={`/organizations/${id}/manage-tokens`}>
    <Button color="zinc">{t('manageTokens')}</Button>
  </Link>
</div>
```

- [ ] **Step 5: Verify token management page works**

Run: `yarn dev`, navigate to an org's modify page, click "Manage Join Links", create a token, copy link, test the link.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/organizations/[id]/manage-tokens/ src/app/[locale]/organizations/[id]/modify/page.tsx
git commit -m "feat: add token management page for admins"
```

---

## Chunk 5: Verification + Cleanup

### Task 20: End-to-End Verification

- [ ] **Step 1: Run all tests**

Run: `yarn vitest run`
Expected: All tests pass

- [ ] **Step 2: Run linter**

Run: `yarn lint`
Expected: No errors

- [ ] **Step 3: Manual E2E test — logged in user flow**

1. Log in as org admin
2. Go to org modify page → click "Manage Join Links"
3. Create a token with description "Test link"
4. Copy the link
5. Open the link in same browser → see confirmation page → click "Confirm Join Request"
6. Verify join request appears in org's pending requests

- [ ] **Step 4: Manual E2E test — not logged in user flow**

1. Copy a join link
2. Open in incognito browser
3. See org info + "Sign in to join" / "Create account to join"
4. Click "Create account to join"
5. Complete registration → OTP → privacy-setup
6. Should redirect to `/join/[token]` confirmation page
7. Click "Confirm Join Request"
8. Verify join request created

- [ ] **Step 5: Manual E2E test — error states**

1. Try an invalid token URL → "This join link is invalid"
2. Expire a token → try its URL → "This join link has expired"
3. Create a token with maxUses=1, use it, try again → "This join link is no longer active"

- [ ] **Step 6: Manual E2E test — edge cases**

1. Use the same join token twice as the same user → should see "pending request" or "already member"
2. Test mobile responsiveness on the /join/[token] page and manage-tokens page
3. Test that returnTo cookie doesn't leak: visit /join/[token], don't log in, browse other pages, manually go to login, complete login → should go to /join/[token] (cookie still valid within 10 min)

- [ ] **Step 7: Final commit (if any fixes needed)**

---

## Files Summary

### New files:

- `src/domain/organization/JoinToken.ts`
- `src/domain/organization/JoinTokenDomainCodes.ts`
- `src/domain/organization/JoinTokenRepository.ts`
- `src/domain/organization/__tests__/JoinToken.test.ts`
- `src/application/organization/JoinTokenErrors.ts`
- `src/application/organization/CreateJoinTokenUseCase.ts`
- `src/application/organization/CreateJoinTokenSchema.ts`
- `src/application/organization/ExpireJoinTokenUseCase.ts`
- `src/application/organization/ReactivateJoinTokenUseCase.ts`
- `src/application/organization/UpdateJoinTokenMaxUsesUseCase.ts`
- `src/application/organization/UpdateJoinTokenMaxUsesSchema.ts`
- `src/application/organization/GetJoinTokensByOrgUseCase.ts`
- `src/application/organization/GetJoinTokenPublicInfoUseCase.ts`
- `src/application/organization/UseJoinTokenUseCase.ts`
- `src/application/organization/__tests__/CreateJoinTokenUseCase.test.ts`
- `src/application/organization/__tests__/ExpireJoinTokenUseCase.test.ts`
- `src/application/organization/__tests__/ReactivateJoinTokenUseCase.test.ts`
- `src/application/organization/__tests__/UpdateJoinTokenMaxUsesUseCase.test.ts`
- `src/application/organization/__tests__/GetJoinTokensByOrgUseCase.test.ts`
- `src/application/organization/__tests__/GetJoinTokenPublicInfoUseCase.test.ts`
- `src/application/organization/__tests__/UseJoinTokenUseCase.test.ts`
- `src/infrastructure/repositories/PrismaJoinTokenRepository.ts`
- `src/web/actions/joinToken.ts`
- `src/web/lib/returnToValidation.ts`
- `src/web/lib/returnTo.server.ts`
- `src/web/lib/returnTo.client.ts`
- `src/app/[locale]/join/[token]/page.tsx`
- `src/app/[locale]/join/[token]/JoinConfirmButton.tsx`
- `src/app/[locale]/organizations/[id]/manage-tokens/page.tsx`
- `src/app/[locale]/organizations/[id]/manage-tokens/CreateTokenSection.tsx`
- `src/app/[locale]/organizations/[id]/manage-tokens/TokenList.tsx`

### Modified files:

- `prisma/schema.prisma`
- `src/infrastructure/index.ts`
- `src/application/organization/JoinOrganizationSchema.ts`
- `src/application/organization/JoinOrganizationUseCase.ts`
- `src/application/organization/__tests__/JoinOrganizationUseCase.test.ts`
- `messages/en.json`
- `messages/ru.json`
- `src/web/components/auth/LoginForm.tsx`
- `src/web/components/privacy/PrivacySetupForm.tsx`
- `src/app/[locale]/login/page.tsx`
- `src/app/[locale]/privacy-setup/page.tsx`
- `src/app/[locale]/organizations/[id]/modify/page.tsx`
