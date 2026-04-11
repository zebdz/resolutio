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

**Problem:** Current auth flow has hardcoded redirects (login -> /home, register -> /confirm-phone -> /privacy-setup -> /home). Need to redirect to `/join/[orgSlug]/[token]` after auth.

**Solution:** Cookie-based `returnTo` mechanism.

### How it works:

1. `/join/[orgSlug]/[token]` page sets `returnTo` cookie server-side on render (value = `/join/[orgSlug]/[token]` without locale prefix)
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

## URL Structure

**Shareable URL:** `/join/[orgSlug]/[token]` — org slug is human-readable context for senders/receivers; the token alone is the source of truth.

**Slug derivation** (on the fly, never persisted): `src/web/lib/orgSlug.ts`

```typescript
export function slugifyOrgName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-') // non-letter/digit (incl. Cyrillic) -> dash
      .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
      .slice(0, 60) || 'org'
  ); // cap length, fallback if empty
}
```

Cyrillic is preserved (not transliterated) — modern browsers and Telegram/WhatsApp/VK display Cyrillic URLs natively, and Russian is the default app language.

**Server behavior:** The `orgSlug` segment is **ignored** for validation. `GetJoinTokenPublicInfoUseCase` looks up by `token` only. Consequences:

- Org renames don't break existing links
- Page renders with the _current_ org name from DB (not the possibly-stale slug)
- No redirect needed on slug mismatch — the URL stays as-is cosmetically

**Link builder:** `src/web/lib/buildJoinUrl.ts` — `buildJoinUrl(orgName, token): string` returns `/join/{slugifyOrgName(orgName)}/{token}`. Used everywhere a shareable URL is constructed (admin "Copy link" button, future share flows, etc.).

**Migration note:** The previously-planned `/join/[token]` route is replaced by `/join/[orgSlug]/[token]`. Clean cutover — no redirect from the old path, as the feature has not shipped to prod.

---

## Frontend

### `/join/[orgSlug]/[token]` Page (PUBLIC)

**Route:** `src/app/[locale]/join/[orgSlug]/[token]/page.tsx`

Server component. Sets returnTo cookie. Calls `GetJoinTokenPublicInfoUseCase` (using `token` only — `orgSlug` is ignored).

**2 states:**
| State | Behavior |
|-------|----------|
| Logged in | Show org info + "Confirm Join Request" button |
| Not logged in | Show org info + "Sign in to join" / "Create account to join" links to `/login` and `/register` |

**Error states** (shown inline):

- Token not found / expired / exhausted -> appropriate message
- Org archived -> "This organization is no longer active"
- Already a member / pending request / pending invite / pending hierarchy request -> shown after auth, on confirm action

### Link Preview (Open Graph)

Messengers (Telegram, WhatsApp, VK, Signal, etc.) fetch the page and render a card from its metadata. Two pieces:

**1. `generateMetadata` in `page.tsx`:**

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const { token } = await params;
  const result = await getJoinTokenPublicInfoUseCase.execute(token);
  const t = await getTranslations('joinToken.preview');

  if (!result.success) {
    return { title: t('fallbackTitle') }; // "НОМОС"
  }

  const { organizationName, organizationDescription } = result.data;
  const title = t('title', { orgName: organizationName }); // "Присоединиться к {orgName}"
  const description = organizationDescription.slice(0, 200);

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}
```

Next.js auto-associates the co-located `opengraph-image.tsx` with `openGraph.images` and `twitter.images`.

**2. `opengraph-image.tsx`** co-located with `page.tsx`:

```typescript
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }) {
  const { token } = await params;
  const result = await getJoinTokenPublicInfoUseCase.execute(token);
  const orgName = result.success ? result.data.organizationName : 'НОМОС';

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: '#247063', // --color-brand-green
        color: '#ffffff',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: 80,
      }}>
        {/* Inline SVG from public/images/logo-icon.svg, bundled at build time */}
        <svg {/* ...logo markup... */} />
        <div style={{ fontSize: 96, fontWeight: 800, textAlign: 'center', marginTop: 40 }}>
          {orgName}
        </div>
        <div style={{ fontSize: 40, marginTop: 24, opacity: 0.9 }}>
          Присоединиться к организации
        </div>
        <div style={{ fontSize: 28, marginTop: 60, opacity: 0.7 }}>
          НОМОС
        </div>
      </div>
    ),
    { ...size }
  );
}
```

**Design choices:**

- **Russian only.** Messenger bots send no useful `Accept-Language`; reliable locale detection is impossible for crawlers. The actual `/join` page is still fully localized for real visitors.
- **Inline SVG logo.** Bundled at build time; no runtime fetch from edge runtime (simpler, faster, avoids fetch failures).
- **Text-minimal image.** Only org name (hero) + CTA line + "НОМОС" brand mark. Org description does NOT appear on the image — it appears only in the OG `description` field below the card.
- **Fallback.** On token error (not found / expired / exhausted), both `generateMetadata` and `opengraph-image` return a generic "НОМОС" card rather than failing. Error details are shown on the page body itself.

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

**Copy link:** build URL via `buildJoinUrl(orgName, token)` (see URL Structure), then `navigator.clipboard.writeText(url)` with toast notification.

**Navigation:** Add "Manage Join Tokens" link to modify page's MembershipSection area.

---

## Localization

New namespace `joinToken` in `messages/en.json` and `messages/ru.json`:

- `joinToken.page.*` - public join page strings
- `joinToken.errors.*` - error messages
- `joinToken.manage.*` - admin management page strings
- `joinToken.preview.*` - link preview (Open Graph) strings:
  - `joinToken.preview.title` — parameterized, e.g. `"Присоединиться к {orgName}"`
  - `joinToken.preview.fallbackTitle` — e.g. `"НОМОС"` (used when token is invalid)
  - `joinToken.preview.cta` — e.g. `"Присоединиться к организации"` (used on the OG image)
- `domain.joinToken.*` - domain validation codes

---

## Error Handling

| Error                     | Where                        | Code                                                |
| ------------------------- | ---------------------------- | --------------------------------------------------- |
| Token not found           | /join/[orgSlug]/[token] page | `joinToken.errors.notFound`                         |
| Token expired             | /join/[orgSlug]/[token] page | `joinToken.errors.expired`                          |
| Token exhausted           | /join/[orgSlug]/[token] page | `joinToken.errors.exhausted`                        |
| Org archived              | /join/[orgSlug]/[token] page | Reuse `organization.errors.archived`                |
| Already member            | Confirm action               | Reuse `organization.errors.alreadyMember`           |
| Pending request           | Confirm action               | Reuse `organization.errors.pendingRequest`          |
| Pending invite            | Confirm action               | Reuse `organization.errors.pendingInvite`           |
| Pending hierarchy request | Confirm action               | Reuse `organization.errors.pendingHierarchyRequest` |
| Not admin                 | Token management             | Reuse `organization.errors.notAdmin`                |

---

## Resolved Decisions

- Token format: 10-char lowercase alphanumeric (a-z, 2-9)
- Public page: Shows org name, description, member count to unauthenticated users
- Use count: Increments on join request submission (even if later rejected)
- Reactivation: Allowed (admins can un-expire tokens)
- Re-request overwrite: joinTokenId overwritten with most recent token (intentional)
- maxUses below useCount: Allowed, token becomes immediately exhausted
- URL structure: `/join/[orgSlug]/[token]`, slug derived on the fly from org name, Cyrillic preserved (no transliteration), server ignores slug and validates by token only
- No persistent slug column on Organization — slug is purely cosmetic, recomputed every time a URL is built
- OG link preview: Russian only (messenger bots don't send reliable locale); title `"Присоединиться к {orgName}"`; description = org description truncated to 200 chars
- OG image: brand-green (`#247063`) background, inline SVG logo, org name hero + static CTA line + "НОМОС" brand mark, no per-org icon upload feature
- OG image on token error: generic "НОМОС" fallback card (error details shown on the page body, not the preview)
