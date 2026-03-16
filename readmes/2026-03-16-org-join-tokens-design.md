# Org Join Tokens

## Problem

Users can only join organizations via the "Request to Join" button on the org detail page. Admins need shareable links they can post on social media, print on flyers, etc. to let people join their organization easily.

## Solution

Token-based join links at `/join/[token]`. Admins create tokens with descriptions, optional max uses, and can expire/reactivate them. Tokens track how many users joined through each one.

---

## Domain Entity: JoinToken

```
JoinTokenProps:
  id: string
  organizationId: string
  token: string              // 10-char lowercase alphanumeric (a-z, 2-9, no ambiguous chars)
  description: string        // required, max 500 chars
  maxUses: number | null     // null = unlimited
  useCount: number           // incremented on join request submission (even if later rejected)
  createdById: string
  createdAt: Date
  expiredAt: Date | null     // null = active; set = expired
```

**Factory:** `JoinToken.create(organizationId, description, createdById, maxUses?)` - validates description not empty/too long, maxUses > 0 if set, generates random token.

**Reconstitute:** `JoinToken.reconstitute(props: JoinTokenProps): JoinToken` - hydrates from DB.

**Serialization:** `toJSON(): JoinTokenProps` - for server/client boundary.

**Status methods:** `isActive()`, `isExpired()`, `hasReachedMaxUses()`, `canBeUsed()`

**Transitions:**

- `expire()` - sets expiredAt, fails if already expired
- `reactivate()` - clears expiredAt, fails if not expired
- `updateMaxUses(newMax)` - validates > 0 if not null. Setting below current useCount is allowed (token becomes immediately exhausted).
- `incrementUseCount()` - fails if !canBeUsed()

**Domain codes** in `JoinTokenDomainCodes.ts` (values follow `domain.joinToken.*` pattern):

- `DESCRIPTION_EMPTY` = `'domain.joinToken.descriptionEmpty'`
- `DESCRIPTION_TOO_LONG` = `'domain.joinToken.descriptionTooLong'`
- `MAX_USES_INVALID` = `'domain.joinToken.maxUsesInvalid'`
- `ALREADY_EXPIRED` = `'domain.joinToken.alreadyExpired'`
- `NOT_EXPIRED` = `'domain.joinToken.notExpired'`
- `TOKEN_EXHAUSTED` = `'domain.joinToken.tokenExhausted'`

---

## Database

New Prisma model `OrganizationJoinToken`:

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
  @@index([token])
  @@map("organization_join_tokens")
}
```

Add to `OrganizationUser`:

```prisma
  joinTokenId  String? @map("join_token_id")
  joinToken    OrganizationJoinToken? @relation(fields: [joinTokenId], references: [id])
```

Add reverse relations to `User` and `Organization` models.

**Note on `usages` relation:** This tracks provenance (which token a join request came through), not "successful uses." `useCount` increments on request submission regardless of eventual accept/reject outcome.

**Note on `joinTokenId` for re-requests:** When a previously-rejected user re-requests via a token, the `joinTokenId` is overwritten with the new token. This is intentional — it records the most recent join mechanism.

---

## Repository: JoinTokenRepository

```typescript
interface JoinTokenRepository {
  save(joinToken: JoinToken): Promise<JoinToken>;
  update(joinToken: JoinToken): Promise<JoinToken>;
  findById(id: string): Promise<JoinToken | null>;
  findByToken(token: string): Promise<JoinToken | null>;
  findByOrganizationId(
    orgId: string,
    filters: {
      search?: string; // matches token value, description
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ tokens: JoinTokenWithCreator[]; totalCount: number }>;
  tryIncrementUseCount(id: string): Promise<boolean>;
  // ^ Atomic conditional: UPDATE SET use_count = use_count + 1
  //   WHERE id = ? AND (max_uses IS NULL OR use_count < max_uses)
  //   Returns true if incremented, false if token was exhausted (race-safe)
}
```

---

## Use Cases

### CreateJoinTokenUseCase

- **Input:** `{ organizationId, description, maxUses?, actorUserId }`
- **Checks:** org exists, not archived, actor is admin/superadmin
- **Returns:** created JoinToken

### ExpireJoinTokenUseCase

- **Input:** `{ tokenId, actorUserId }`
- **Checks:** token exists, actor is admin/superadmin of token's org
- **Calls:** `token.expire()`

### ReactivateJoinTokenUseCase

- **Input:** `{ tokenId, actorUserId }`
- **Checks:** token exists, actor is admin/superadmin of token's org
- **Calls:** `token.reactivate()`

### UpdateJoinTokenMaxUsesUseCase

- **Input:** `{ tokenId, maxUses: number | null, actorUserId }`
- **Checks:** token exists, actor is admin/superadmin
- **Calls:** `token.updateMaxUses(newMax)`

### GetJoinTokensByOrgUseCase

- **Input:** `{ organizationId, actorUserId, search?, page?, pageSize? }`
- **Checks:** org exists, actor is admin/superadmin
- **Returns:** paginated tokens with creator names

### GetJoinTokenPublicInfoUseCase

- **Input:** `{ token: string }`
- **No auth required** (public page)
- **Checks:** token exists, not expired, not exhausted, org not archived
- **Returns:** `{ organizationName, organizationDescription, memberCount }`

### UseJoinTokenUseCase

- **Input:** `{ token: string, userId: string }`
- **Flow:**
  1. Find token by value
  2. Validate: exists, active, org not archived
  3. Call `tryIncrementUseCount(token.id)` — if false, return TOKEN_EXHAUSTED (race-safe)
  4. Delegate to `JoinOrganizationUseCase` with `joinTokenId`
  5. If join fails, decrement useCount (best-effort rollback)
- **Returns:** `{ organizationId }`

**JoinOrganizationUseCase modification:** Add optional `joinTokenId?: string` to `JoinOrganizationInput`. Pass through to `prisma.organizationUser.create()` / `.update()` data.

---

## Server Actions

All server actions in `src/web/actions/joinToken.ts` must include `checkRateLimit()` at the top per project convention:

- `createJoinTokenAction` — rate limit, auth, admin check, Zod validate, execute CreateJoinTokenUseCase
- `expireJoinTokenAction` — rate limit, auth, execute ExpireJoinTokenUseCase
- `reactivateJoinTokenAction` — rate limit, auth, execute ReactivateJoinTokenUseCase
- `updateJoinTokenMaxUsesAction` — rate limit, auth, execute UpdateJoinTokenMaxUsesUseCase
- `getJoinTokensByOrgAction` — rate limit, auth, execute GetJoinTokensByOrgUseCase
- `useJoinTokenAction` — rate limit, auth, execute UseJoinTokenUseCase

---

## Auth Redirect: `returnTo` Cookie

**Problem:** Current auth flow has hardcoded redirects (login -> /home, register -> /confirm-phone -> /privacy-setup -> /home). Need to redirect to `/join/[token]` after auth.

**Solution:** Cookie-based `returnTo` mechanism.

### How it works:

1. `/join/[token]` page sets `returnTo` cookie server-side on render (value = `/join/[token]` without locale prefix)
2. Cookie config: `httpOnly: false`, `sameSite: lax`, `maxAge: 600` (10 min), `path: /`
3. Not httpOnly so client components can read it

### Security: Path validation (defense in depth)

Both `setReturnToCookie()` (server) and `consumeReturnTo()` (client) must validate the path:

- Must start with `/`
- Must NOT start with `//` (protocol-relative URL)
- Must NOT contain `:` before the first `/` after the leading slash (no scheme injection)
- If validation fails, return `null` (fall through to `/home`)

### Where consumed (4 places — 2 client, 2 server):

**Client-side** (final redirect after auth action):

1. **`LoginForm.tsx` line 86:** `router.push('/home')` -> consume cookie, push to cookie value if present
2. **`PrivacySetupForm.tsx` line 54:** `router.push('/home')` -> consume cookie, push to cookie value if present

Both must use `useRouter` from `@/src/i18n/routing` (not `next/navigation`) for consistent locale handling.

**Server-side** (already-authenticated user redirects): 3. **`login/page.tsx` line ~19:** `if (user) redirect('/home')` -> check cookie, redirect to cookie value instead 4. **`privacy-setup/page.tsx` line ~30:** `if (user.privacySetupCompleted) redirect('/home')` -> check cookie, redirect to cookie value instead

### Utility (`src/web/lib/returnTo.ts`):

- `setReturnToCookie(path)` - server-side (`cookies().set()`), validates path
- `consumeReturnToCookieServer()` - server-side, reads and deletes cookie, validates path, returns path or null
- `consumeReturnTo()` - client-side, reads from `document.cookie`, validates, deletes, returns path or null

Intermediate auth steps (confirm-phone -> privacy-setup) remain unchanged — they don't touch the cookie.

---

## Frontend

### `/join/[token]` Page (PUBLIC)

**Route:** `src/app/[locale]/join/[token]/page.tsx`

Server component. Sets returnTo cookie. Calls `GetJoinTokenPublicInfoUseCase`.

**2 states:**
| State | Behavior |
|-------|----------|
| Logged in | Show org info + "Confirm Join Request" button |
| Not logged in | Show org info + "Sign in to join" / "Create account to join" links to `/login` and `/register` |

**Error states** (shown inline):

- Token not found / expired / exhausted -> appropriate message
- Org archived -> "This organization is no longer active"
- Already a member / pending request / pending invite / pending hierarchy request -> shown after auth, on confirm action

### Token Management Page (ADMIN)

**Route:** `src/app/[locale]/organizations/[id]/manage-tokens/page.tsx`

**Access:** Admin + superadmin only (same pattern as modify page).

**Layout:**

- Back link to modify page
- "Create Join Token" form: description (required), max uses (optional, default unlimited)
- Token list: search by token/description, paginated
- Each row: description, token, created date, creator, uses (current/max), status (active/expired/exhausted), actions
- Actions: Copy link, Expire/Reactivate, Edit max uses
- Use `prefetch={false}` on all `<Link>` components in lists

**Copy link:** `navigator.clipboard.writeText(url)` with toast notification.

**Navigation:** Add "Manage Join Tokens" link to modify page's MembershipSection area.

---

## Localization

New namespace `joinToken` in `messages/en.json` and `messages/ru.json`:

- `joinToken.page.*` - public join page strings
- `joinToken.errors.*` - error messages
- `joinToken.manage.*` - admin management page strings
- `domain.joinToken.*` - domain validation codes

---

## Error Handling

| Error                     | Where              | Code                                                |
| ------------------------- | ------------------ | --------------------------------------------------- |
| Token not found           | /join/[token] page | `joinToken.errors.notFound`                         |
| Token expired             | /join/[token] page | `joinToken.errors.expired`                          |
| Token exhausted           | /join/[token] page | `joinToken.errors.exhausted`                        |
| Org archived              | /join/[token] page | Reuse `organization.errors.archived`                |
| Already member            | Confirm action     | Reuse `organization.errors.alreadyMember`           |
| Pending request           | Confirm action     | Reuse `organization.errors.pendingRequest`          |
| Pending invite            | Confirm action     | Reuse `organization.errors.pendingInvite`           |
| Pending hierarchy request | Confirm action     | Reuse `organization.errors.pendingHierarchyRequest` |
| Not admin                 | Token management   | Reuse `organization.errors.notAdmin`                |

---

## Resolved Decisions

- Token format: 10-char lowercase alphanumeric (a-z, 2-9)
- Public page: Shows org name, description, member count to unauthenticated users
- Use count: Increments on join request submission (even if later rejected)
- Reactivation: Allowed (admins can un-expire tokens)
- Re-request overwrite: joinTokenId overwritten with most recent token (intentional)
- maxUses below useCount: Allowed, token becomes immediately exhausted
