# Deep links survive login and registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor who opens a deep link (e.g. an open poll's ballot) while logged out ends up on that page after logging in — or after registering, confirming their phone and completing privacy setup — instead of on `/home`.

**Architecture:** The middleware records the requested path in the existing `returnTo` cookie (no new redirects; pages keep doing the gating). The existing consumers — `LoginForm`, `PrivacySetupForm`, and the login/privacy-setup pages — already read it. Server-side reads switch from consume-and-delete to read-only, because deleting a cookie in a Server Component throws in Next 15. Open polls additionally get a public preview screen for anonymous visitors, modelled on the organization join page.

**Tech Stack:** Next.js 15 (App Router, middleware in `src/proxy.ts`), next-intl (locale-prefixed routes), vitest, Prisma.

**Spec:** `readmes/2026-07-31-deep-link-return-to-design.md`

## Global Constraints

- **Never run `git commit`.** Each task ends by staging with `git add`; the user commits.
- At the end of each **phase**, mark the phase complete in this file and stop for user review.
- TDD: failing test first for anything with a pure or use-case-level surface.
- `returnTo` values are stored **without** the locale prefix (`/polls/x/vote`), because `useRouter`/`Link` from `@/src/i18n/routing` re-add the active locale.
- A Server Component must never write cookies — read-only helpers there; the middleware writes via `response.cookies.set`.
- Nothing about a non-open poll may reach an anonymous visitor: regular, archived and nonexistent polls must all produce the same `redirect('/login')`.
- Errors are codes, translated at the edge; new UI strings go into BOTH `messages/en.json` and `messages/ru.json`.
- Test command `yarn test <path>`; `yarn typecheck`; `yarn lf`.

---

## Phase 1 — The destination survives the auth chain

### Task 1: `resolveReturnToPath` — the capture rules as a pure function

**Files:**

- Create: `src/web/lib/returnToCapture.ts`
- Create: `src/web/lib/__tests__/returnToCapture.test.ts`

**Interfaces:**

- Consumes: `locales` from `@/src/i18n/locales`, `isValidReturnToPath` from `./returnToValidation`.
- Produces: `resolveReturnToPath({ pathname, method, accept }): string | null` and `RETURN_TO_SKIP_PATHS`.

- [ ] **Step 1: Write the failing test**

Create `src/web/lib/__tests__/returnToCapture.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveReturnToPath } from '../returnToCapture';

const htmlGet = { method: 'GET', accept: 'text/html,application/xhtml+xml' };

describe('resolveReturnToPath', () => {
  it('strips the locale prefix', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/ru/polls/abc/vote' })
    ).toBe('/polls/abc/vote');
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/en/polls/abc/vote' })
    ).toBe('/polls/abc/vote');
  });

  it('keeps a path that has no locale prefix', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/polls/abc/vote' })
    ).toBe('/polls/abc/vote');
  });

  it.each([
    '/',
    '/login',
    '/register',
    '/confirm-phone',
    '/privacy-setup',
    '/blocked',
    '/rate-limited',
    '/ip-blocked',
  ])('skips %s under both locales', (path) => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: `/ru${path}` })
    ).toBeNull();
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: `/en${path}` })
    ).toBeNull();
    expect(resolveReturnToPath({ ...htmlGet, pathname: path })).toBeNull();
  });

  it('skips the bare locale root', () => {
    expect(resolveReturnToPath({ ...htmlGet, pathname: '/ru' })).toBeNull();
    expect(resolveReturnToPath({ ...htmlGet, pathname: '/ru/' })).toBeNull();
  });

  it('skips non-GET requests', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, method: 'POST', pathname: '/ru/polls' })
    ).toBeNull();
  });

  it('skips non-HTML requests', () => {
    expect(
      resolveReturnToPath({
        method: 'GET',
        accept: 'image/png',
        pathname: '/ru/polls',
      })
    ).toBeNull();
    expect(
      resolveReturnToPath({
        method: 'GET',
        accept: null,
        pathname: '/ru/polls',
      })
    ).toBeNull();
  });

  it('skips API routes', () => {
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/api/polls/x/results/pdf' })
    ).toBeNull();
  });

  it('keeps other authenticated pages', () => {
    expect(resolveReturnToPath({ ...htmlGet, pathname: '/ru/reports' })).toBe(
      '/reports'
    );
    expect(
      resolveReturnToPath({ ...htmlGet, pathname: '/ru/organizations/123' })
    ).toBe('/organizations/123');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/web/lib/__tests__/returnToCapture.test.ts`
Expected: FAIL — cannot resolve `../returnToCapture`.

- [ ] **Step 3: Implement**

Create `src/web/lib/returnToCapture.ts`:

```ts
import { locales } from '@/src/i18n/locales';
import { isValidReturnToPath } from './returnToValidation';

// Never worth returning to: the auth chain itself (returning there would loop)
// and the error pages. Compared after the locale prefix is stripped.
export const RETURN_TO_SKIP_PATHS = [
  '/',
  '/login',
  '/register',
  '/confirm-phone',
  '/privacy-setup',
  '/blocked',
  '/rate-limited',
  '/ip-blocked',
];

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/');

  if (segments.length > 1 && locales.includes(segments[1] as never)) {
    const rest = `/${segments.slice(2).join('/')}`;

    return rest === '/' ? '/' : rest.replace(/\/$/, '');
  }

  return pathname === '/' ? '/' : pathname.replace(/\/$/, '');
}

/**
 * Decides whether a request is worth remembering as a post-login destination,
 * and in what form. Returns the locale-less path to store, or null to skip.
 * Pure on purpose: the rules are the part worth testing, not the plumbing.
 */
export function resolveReturnToPath(input: {
  pathname: string;
  method: string;
  accept: string | null;
}): string | null {
  if (input.method !== 'GET') {
    return null;
  }

  if (!(input.accept ?? '').includes('text/html')) {
    return null;
  }

  if (input.pathname.startsWith('/api')) {
    return null;
  }

  const path = stripLocalePrefix(input.pathname);

  if (RETURN_TO_SKIP_PATHS.includes(path)) {
    return null;
  }

  if (!isValidReturnToPath(path)) {
    return null;
  }

  return path;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/web/lib/__tests__/returnToCapture.test.ts`
Expected: PASS.

- [ ] **Step 5: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/web/lib/returnToCapture.ts src/web/lib/__tests__/returnToCapture.test.ts
```

---

### Task 2: Wire the capture into the middleware

**Files:**

- Modify: `src/proxy.ts`

**Interfaces:**

- Consumes: `resolveReturnToPath` (Task 1), `RETURN_TO_COOKIE_NAME` from `@/web/lib/returnToValidation`.
- Produces: `returnTo` cookie on eligible responses. No behaviour change to routing, rate limiting or blocking.

- [ ] **Step 1: Add the wrapper**

In `src/proxy.ts`, add the imports:

```ts
import { resolveReturnToPath } from './web/lib/returnToCapture';
import { RETURN_TO_COOKIE_NAME } from './web/lib/returnToValidation';
```

and, next to the other helpers near the top:

```ts
const RETURN_TO_MAX_AGE = 1800; // 30 minutes, matches the join-link flow

// Remembers where the visitor was heading so the login / registration chain can
// land them there afterwards. Records only — never redirects — so it cannot
// make a public page private.
function captureReturnTo(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const path = resolveReturnToPath({
    pathname: request.nextUrl.pathname,
    method: request.method,
    accept: request.headers.get('accept'),
  });

  if (!path) {
    return response;
  }

  response.cookies.set(RETURN_TO_COOKIE_NAME, path, {
    httpOnly: false, // the client helper reads it after login
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: RETURN_TO_MAX_AGE,
    path: '/',
  });

  return response;
}
```

- [ ] **Step 2: Apply it at BOTH page-serving exits**

Development branch (around `proxy.ts:56`) — miss this one and the feature silently does nothing locally:

```ts
if (process.env.NODE_ENV === 'development') {
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  return captureReturnTo(request, intlMiddleware(request));
}
```

Final return at the bottom of the middleware:

```ts
return captureReturnTo(request, intlMiddleware(request));
```

Leave the rate-limited / IP-blocked / `next-action` early returns untouched: those paths are in the skip list or are not GET HTML navigations.

- [ ] **Step 3: Verify against the running app**

Run (start `yarn dev` first if needed):

```bash
curl -sI -H 'Accept: text/html' http://localhost:8080/ru/polls/SOME_ID/vote | grep -i '^set-cookie'
curl -sI -H 'Accept: text/html' http://localhost:8080/ru/login | grep -i '^set-cookie'
curl -sI -H 'Accept: application/json' http://localhost:8080/ru/polls | grep -i '^set-cookie'
```

Expected: the first prints `returnTo=%2Fpolls%2FSOME_ID%2Fvote`; the second prints no `returnTo`; the third prints no `returnTo`.

- [ ] **Step 4: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/proxy.ts
```

---

### Task 3: Read-only server reads, and close the two chain leaks

**Files:**

- Modify: `src/web/lib/returnTo.server.ts`
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `src/app/[locale]/privacy-setup/page.tsx`
- Modify: `src/app/[locale]/confirm-phone/page.tsx`
- Modify: `src/app/[locale]/register/page.tsx`

**Interfaces:**

- Produces: `readReturnToCookieServer(): Promise<string | null>` — reads and validates, never writes. `consumeReturnToCookieServer` and the unused `setReturnToCookie` are removed.

Background: a Server Component that deletes a cookie throws `Cookies can only be modified in a Server Action or Route Handler` (verified against the running app — HTTP 500). Task 2 makes the cookie present almost always, so this must be fixed in the same phase.

- [ ] **Step 1: Replace the server helper**

Rewrite `src/web/lib/returnTo.server.ts`:

```ts
import { cookies } from 'next/headers';
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from './returnToValidation';

/**
 * Read-only on purpose: a Server Component may not write cookies in Next 15,
 * and deleting here throws. The middleware overwrites the cookie on the next
 * navigation and it expires on its own, so treat it as a hint, not a token.
 */
export async function readReturnToCookieServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(RETURN_TO_COOKIE_NAME)?.value ?? null;

  if (!value || !isValidReturnToPath(value)) {
    return null;
  }

  return value;
}
```

- [ ] **Step 2: Update the two existing callers**

In `src/app/[locale]/login/page.tsx` and `src/app/[locale]/privacy-setup/page.tsx`, change the import to `readReturnToCookieServer` and the call sites from

```ts
const returnTo = await consumeReturnToCookieServer();
```

to

```ts
const returnTo = await readReturnToCookieServer();
```

- [ ] **Step 3: Close the confirm-phone leak**

In `src/app/[locale]/confirm-phone/page.tsx`, add the import and replace the `/home` branch:

```ts
// Already confirmed — go to privacy setup or wherever the visitor was headed
if (user.isConfirmed()) {
  if (!user.privacySetupCompleted) {
    redirect('/privacy-setup');
  }

  const returnTo = await readReturnToCookieServer();
  redirect(returnTo || '/home');
}
```

- [ ] **Step 4: Close the register leak**

In `src/app/[locale]/register/page.tsx`:

```ts
// Already logged in — resume the deep link if there is one
if (user) {
  const returnTo = await readReturnToCookieServer();
  redirect(returnTo || '/home');
}
```

- [ ] **Step 5: Verify no consumer of the removed helpers is left**

Run: `grep -rn "consumeReturnToCookieServer\|setReturnToCookie" src`
Expected: no matches.

- [ ] **Step 6: Manual check — login lands on the deep link**

With `yarn dev` running, in a logged-out browser: open `/ru/polls/{an ACTIVE poll id}/vote`, log in, and confirm you land on the ballot rather than `/home`. Repeat once with `/ru/reports` to confirm the fix is generic.

- [ ] **Step 7: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/web/lib/returnTo.server.ts "src/app/[locale]/login/page.tsx" "src/app/[locale]/privacy-setup/page.tsx" "src/app/[locale]/confirm-phone/page.tsx" "src/app/[locale]/register/page.tsx"
```

---

**Phase 1 complete — stop for user review.** Mark this line `[x]` when done: - [x] Phase 1 implemented (2026-07-31), awaiting review

Notes from execution:

- `src/__tests__/proxy.test.ts` mocks the intl middleware as **async**, so `captureReturnTo` received
  a promise and 5 rate-limit tests failed. Call sites now `await intlMiddleware(request)`; the real
  API is synchronous, so TS flags the await as no-op — a comment in `proxy.ts` explains why it stays.
- `curl -I` sends HEAD, which the capture rule correctly rejects; verify with
  `curl -s -D - -o /dev/null` instead.
- Verified in the browser: visiting `/ru/login` while logged in with `returnTo=/reports` now
  redirects to `/reports` instead of throwing the cookie-write 500.

---

## Phase 2 — Public preview for open-poll links

### Task 4: `GetOpenPollPreviewUseCase`

**Files:**

- Create: `src/application/poll/GetOpenPollPreviewUseCase.ts`
- Create: `src/application/poll/__tests__/GetOpenPollPreviewUseCase.test.ts`

**Interfaces:**

- Consumes: `PollRepository.getPollById`, `OrganizationRepository.findById`, `poll.isOpen()`, `poll.isArchived()`.
- Produces:

  ```ts
  interface OpenPollPreview {
    title: string;
    description: string;
    state: PollState;
    organizationName: string;
  }
  class GetOpenPollPreviewUseCase {
    constructor(
      pollRepository: PollRepository,
      organizationRepository: OrganizationRepository
    );
    execute(input: {
      pollId: string;
    }): Promise<Result<OpenPollPreview | null, string>>;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `src/application/poll/__tests__/GetOpenPollPreviewUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetOpenPollPreviewUseCase } from '../GetOpenPollPreviewUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollState } from '../../../domain/poll/PollState';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { success } from '../../../domain/shared/Result';

function makePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = Poll.create(
    'Should we repave the yard?',
    'Full description here',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    pollType
  ).value;
  (poll as any).props.id = 'poll-1';
  (poll as any).props.state = PollState.ACTIVE;

  return poll;
}

const organization = Organization.reconstitute({
  id: 'org-1',
  name: 'ТСЖ "Орион"',
  description: 'desc',
  parentId: null,
  createdById: 'user-admin',
  createdAt: new Date(),
  archivedAt: null,
  allowMultiTreeMembership: false,
});

describe('GetOpenPollPreviewUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let useCase: GetOpenPollPreviewUseCase;

  beforeEach(() => {
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(makePoll('OPEN'))),
    };
    organizationRepository = {
      findById: vi.fn().mockResolvedValue(organization),
    };
    useCase = new GetOpenPollPreviewUseCase(
      pollRepository as PollRepository,
      organizationRepository as OrganizationRepository
    );
  });

  it('returns the preview for an open poll', async () => {
    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      title: 'Should we repave the yard?',
      description: 'Full description here',
      state: PollState.ACTIVE,
      organizationName: 'ТСЖ "Орион"',
    });
  });

  it('returns null for an organization poll', async () => {
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(makePoll('ORGANIZATION')));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.success).toBe(true);
    expect(result.value).toBeNull();
  });

  it('returns null for an archived open poll', async () => {
    const archived = makePoll('OPEN');
    (archived as any).props.archivedAt = new Date();
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(archived));

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.value).toBeNull();
  });

  it('returns null for an unknown poll', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({ pollId: 'nope' });

    expect(result.value).toBeNull();
  });

  it('returns null when the organization is archived', async () => {
    organizationRepository.findById = vi.fn().mockResolvedValue(
      Organization.reconstitute({
        id: 'org-1',
        name: 'Archived',
        description: 'desc',
        parentId: null,
        createdById: 'user-admin',
        createdAt: new Date(),
        archivedAt: new Date(),
        allowMultiTreeMembership: false,
      })
    );

    const result = await useCase.execute({ pollId: 'poll-1' });

    expect(result.value).toBeNull();
  });

  it('does not ask for the organization when the poll is not open', async () => {
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(makePoll('ORGANIZATION')));

    await useCase.execute({ pollId: 'poll-1' });

    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/application/poll/__tests__/GetOpenPollPreviewUseCase.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/application/poll/GetOpenPollPreviewUseCase.ts`:

```ts
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollState } from '../../domain/poll/PollState';

export interface OpenPollPreview {
  title: string;
  description: string;
  state: PollState;
  organizationName: string;
}

/**
 * The only poll read that needs no authentication. An open poll is voted on by
 * anyone holding the link, so its headline is safe to show before sign-in —
 * everything else (questions, answers, participants) stays behind the gate.
 *
 * Anything that is not a live open poll returns null, so a regular poll, an
 * archived one and a poll id that never existed are indistinguishable to the
 * caller.
 */
export class GetOpenPollPreviewUseCase {
  constructor(
    private pollRepository: PollRepository,
    private organizationRepository: OrganizationRepository
  ) {}

  async execute(input: {
    pollId: string;
  }): Promise<Result<OpenPollPreview | null, string>> {
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll || poll.isArchived() || !poll.isOpen()) {
      return success(null);
    }

    const organization = await this.organizationRepository.findById(
      poll.organizationId
    );

    if (!organization || organization.isArchived()) {
      return success(null);
    }

    return success({
      title: poll.title,
      description: poll.description,
      state: poll.state,
      organizationName: organization.name,
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/application/poll/__tests__/GetOpenPollPreviewUseCase.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/poll/GetOpenPollPreviewUseCase.ts src/application/poll/__tests__/GetOpenPollPreviewUseCase.test.ts
```

---

### Task 5: The preview screen and the anonymous branch on the vote page

**Files:**

- Create: `src/web/components/shared/SetReturnTo.tsx` (moved from the join folder)
- Delete: `src/app/[locale]/join/[orgSlug]/[token]/SetReturnTo.tsx`
- Modify: `src/app/[locale]/join/[orgSlug]/[token]/page.tsx` (import path only)
- Create: `src/web/components/polls/PublicOpenPollPreview.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/vote/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `GetOpenPollPreviewUseCase` (Task 4), `getCurrentUser`, `PollState`.
- Produces: `PublicOpenPollPreview({ pollId, preview })` server component; `SetReturnTo` at its new shared path.

- [ ] **Step 1: Move `SetReturnTo` to a shared location**

`git mv "src/app/[locale]/join/[orgSlug]/[token]/SetReturnTo.tsx" src/web/components/shared/SetReturnTo.tsx`

Fix its import (it now sits outside the app folder, the alias is unchanged) and update the join page:

```ts
import { SetReturnTo } from '@/web/components/shared/SetReturnTo';
```

Keep the file's existing contents and comments as they are.

- [ ] **Step 2: Create the preview screen**

Create `src/web/components/polls/PublicOpenPollPreview.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PollState } from '@/src/domain/poll/PollState';
import { SetReturnTo } from '@/web/components/shared/SetReturnTo';
import { OpenPollPreview } from '@/application/poll/GetOpenPollPreviewUseCase';

interface PublicOpenPollPreviewProps {
  pollId: string;
  preview: OpenPollPreview;
}

export async function PublicOpenPollPreview({
  pollId,
  preview,
}: PublicOpenPollPreviewProps) {
  const t = await getTranslations('poll.publicPreview');

  const statusNote =
    preview.state === PollState.ACTIVE
      ? null
      : preview.state === PollState.FINISHED
        ? t('votingEnded')
        : t('votingNotStarted');

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      {/* Belt and braces: the middleware already recorded this path, but the
          preview keeps working even if that rule is ever narrowed. */}
      <SetReturnTo path={`/polls/${pollId}/vote`} />

      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          {t('openPollBadge')}
        </span>
        <Heading className="text-2xl font-bold">{preview.title}</Heading>
        <Text>{preview.organizationName}</Text>
      </div>

      {preview.description && (
        <Text className="text-center">{preview.description}</Text>
      )}

      {statusNote && (
        <p className="rounded-lg bg-yellow-50 p-3 text-center text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          {statusNote}
        </p>
      )}

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {t('explainer')}
      </p>

      <div className="flex flex-col gap-3">
        <Link href="/login" prefetch={false}>
          <Button color="brand-green" className="w-full">
            {t('loginToVote')}
          </Button>
        </Link>
        <Link href="/register" prefetch={false}>
          <Button color="zinc" className="w-full">
            {t('registerToVote')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the anonymous branch to the vote page**

In `src/app/[locale]/polls/[pollId]/vote/page.tsx`, add the imports:

```ts
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
} from '@/infrastructure/index';
import { GetOpenPollPreviewUseCase } from '@/application/poll/GetOpenPollPreviewUseCase';
import { PublicOpenPollPreview } from '@/src/web/components/polls/PublicOpenPollPreview';
```

and, immediately after `const { pollId } = await params;`:

```ts
  // Anonymous visitor: an open poll shows a public headline so a shared link
  // explains itself; anything else is indistinguishable from "no such poll".
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    const previewUseCase = new GetOpenPollPreviewUseCase(
      new PrismaPollRepository(prisma),
      new PrismaOrganizationRepository(prisma)
    );
    const previewResult = await previewUseCase.execute({ pollId });
    const preview = previewResult.success ? previewResult.value : null;

    if (!preview) {
      redirect('/login');
    }

    return <PublicOpenPollPreview pollId={pollId} preview={preview} />;
  }
```

Leave the rest of the page untouched — it runs only for authenticated visitors now.

- [ ] **Step 4: Add the translations**

`messages/en.json`, inside `poll`:

```json
"publicPreview": {
  "openPollBadge": "Open poll",
  "explainer": "Anyone with the link can vote once. Log in or create an account to cast your vote.",
  "loginToVote": "Log in to vote",
  "registerToVote": "Create an account",
  "votingNotStarted": "Voting has not started yet",
  "votingEnded": "Voting has ended"
}
```

`messages/ru.json`, inside `poll`:

```json
"publicPreview": {
  "openPollBadge": "Открытое голосование",
  "explainer": "Проголосовать может любой, у кого есть ссылка, — один раз. Войдите или создайте аккаунт, чтобы отдать свой голос.",
  "loginToVote": "Войти и проголосовать",
  "registerToVote": "Создать аккаунт",
  "votingNotStarted": "Голосование ещё не началось",
  "votingEnded": "Голосование завершено"
}
```

Edit the JSON by hand or with a script that preserves the existing `←` escapes — writing these files with Python's `ensure_ascii=False` rewrites unrelated lines.

- [ ] **Step 5: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf && yarn build
git add src/web/components/shared/SetReturnTo.tsx src/web/components/polls/PublicOpenPollPreview.tsx "src/app/[locale]/join" "src/app/[locale]/polls/[pollId]/vote/page.tsx" messages/en.json messages/ru.json
```

---

### Task 6: End-to-end verification

**Files:** none — verification only.

- [ ] **Step 1: Existing account, open poll**

Logged out, open `/ru/polls/{ACTIVE open poll}/vote`.
Expected: preview screen with the poll title, org name and both buttons. Click _log in to vote_, sign in → the ballot, not `/home`.

- [ ] **Step 2: Brand-new account**

Logged out, open the same link → _create an account_ → register → phone confirmation → privacy setup.
Expected: the last step lands on the ballot.

- [ ] **Step 3: Regular poll leaks nothing**

Logged out, open `/ru/polls/{an ORGANIZATION poll}/vote` and `/ru/polls/does-not-exist/vote`.
Expected: both go straight to the login screen with no poll details, and the two responses are indistinguishable.

- [ ] **Step 4: Non-active open poll**

Logged out, open a FINISHED open poll link.
Expected: preview with "Голосование завершено"; after logging in, the ballot page shows its usual finished-poll message.

- [ ] **Step 5: Generic deep links still work**

Logged out, open `/ru/reports` → log in → land on `/reports`.

- [ ] **Step 6: No regression for ordinary browsing**

While logged in, visit `/ru/home`, `/ru/polls`, a poll's results page.
Expected: no redirects, no errors in the dev server log, and `/ru/login` while logged in still redirects (no 500 from cookie writes).

---

**Phase 2 complete — stop for user review.** Mark this line `[x]` when done: - [x] Phase 2 implemented (2026-07-31), awaiting review

Verification results (anonymous paths driven with curl, since signing in requires a password):

| Case                | Result                                                       |
| ------------------- | ------------------------------------------------------------ |
| ACTIVE open poll    | HTTP 200 preview, `returnTo` cookie set, no status note      |
| FINISHED open poll  | HTTP 200 preview + "Голосование завершено"                   |
| DRAFT open poll     | HTTP 200 preview + "Голосование ещё не началось"             |
| ORGANIZATION poll   | HTTP 307 → `/login`, nothing revealed                        |
| Nonexistent poll id | HTTP 307 → `/login`, byte-identical to the regular-poll case |
| Logged-in visitor   | ballot renders exactly as before                             |

Still owed by a human (password entry): logging in from the preview and landing on the ballot, and
the full register → OTP → privacy-setup chain. The server-side half of both is proven — `/ru/login`
while logged in with `returnTo=/reports` redirects to `/reports`.

Note: the "not started" case needed a freshly created draft; the earlier draft poll had since been
finished through the UI, which briefly looked like a wrong status note.

---

## Done criteria

- A logged-out visitor opening an open-poll link sees a public preview and, after logging in or registering fully, lands on the ballot.
- Regular, archived and nonexistent polls all send anonymous visitors to the login screen with nothing revealed.
- Deep links to other authenticated pages survive login too.
- No Server Component writes cookies; `/ru/login` and `/ru/privacy-setup` no longer risk a 500 when the cookie is present.
- `yarn test`, `yarn typecheck`, `yarn lf` and `yarn build` are clean.
