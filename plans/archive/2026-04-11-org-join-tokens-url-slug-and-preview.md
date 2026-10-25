# Org Join Tokens: URL Slug + Link Preview Implementation Plan

> **For the executor:** This is a multi-phase plan. At the end of each phase, stop and let the user review the diff before moving to the next phase. Never run `git commit` — user commits themselves. `git add` is allowed.

**Goal:** Change the join token URL from `/join/[token]` to `/join/[orgSlug]/[token]`, and add Open Graph metadata + a dynamically-generated preview image so messenger link previews show the org name with a branded card.

**Architecture:** The `orgSlug` segment is purely cosmetic — derived on the fly from `organization.name` and ignored by the server. Only the `token` identifies the join link in the DB. A new `opengraph-image.tsx` colocated with the page renders a brand-green card via `next/og` edge runtime. A pure-function `buildJoinUrl` helper centralizes URL construction.

**Tech Stack:** Next.js 15 app router, `next/og` (edge runtime `ImageResponse`), Vitest for unit tests, next-intl for translations.

**Related spec:** `readmes/2026-03-16-org-join-tokens-design.md` (see URL Structure + Link Preview sections).

---

## File Structure

**Created:**

- `src/web/lib/orgSlug.ts` — `slugifyOrgName(name)` pure function
- `src/web/lib/__tests__/orgSlug.test.ts` — unit tests
- `src/web/lib/buildJoinUrl.ts` — `buildJoinUrl(orgName, token)` pure function returning a relative path
- `src/web/lib/__tests__/buildJoinUrl.test.ts` — unit tests
- `src/app/[locale]/join/[orgSlug]/[token]/page.tsx` — moved + `generateMetadata` added
- `src/app/[locale]/join/[orgSlug]/[token]/JoinConfirmButton.tsx` — moved unchanged
- `src/app/[locale]/join/[orgSlug]/[token]/SetReturnTo.tsx` — moved unchanged
- `src/app/[locale]/join/[orgSlug]/[token]/opengraph-image.tsx` — new edge route

**Modified:**

- `messages/en.json` — add `joinToken.preview.*` keys
- `messages/ru.json` — add `joinToken.preview.*` keys
- `src/app/[locale]/organizations/[id]/manage-tokens/page.tsx` — pass `organizationName` down
- `src/app/[locale]/organizations/[id]/manage-tokens/ManageTokensClient.tsx` — thread `organizationName` prop
- `src/app/[locale]/organizations/[id]/manage-tokens/TokenList.tsx` — use `buildJoinUrl(orgName, token)` in `handleCopyLink`

**Deleted:**

- `src/app/[locale]/join/[token]/` — old directory (clean cutover; feature is on `dev` branch, not shipped)

---

## Phase 1: Utilities (TDD) ✓

### Task 1: `slugifyOrgName` utility

**Files:**

- Create: `src/web/lib/orgSlug.ts`
- Create: `src/web/lib/__tests__/orgSlug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/web/lib/__tests__/orgSlug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { slugifyOrgName } from '../orgSlug';

describe('slugifyOrgName', () => {
  it('lowercases ASCII org names', () => {
    expect(slugifyOrgName('Acme Corp')).toBe('acme-corp');
  });

  it('preserves Cyrillic letters', () => {
    expect(slugifyOrgName('Московский Клуб')).toBe('московский-клуб');
  });

  it('handles mixed Latin and Cyrillic', () => {
    expect(slugifyOrgName('NOMOS НОМОС')).toBe('nomos-номос');
  });

  it('replaces non-letter non-digit sequences with a single dash', () => {
    expect(slugifyOrgName('Foo!!!  Bar???')).toBe('foo-bar');
  });

  it('keeps digits', () => {
    expect(slugifyOrgName('Club 42')).toBe('club-42');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugifyOrgName('!!!Foo!!!')).toBe('foo');
  });

  it('caps length at 60 characters', () => {
    const longName = 'a'.repeat(100);
    expect(slugifyOrgName(longName)).toBe('a'.repeat(60));
  });

  it('returns "org" as fallback for empty input', () => {
    expect(slugifyOrgName('')).toBe('org');
  });

  it('returns "org" as fallback for punctuation-only input', () => {
    expect(slugifyOrgName('!!!???')).toBe('org');
  });

  it('trims whitespace on the edges before slugifying', () => {
    expect(slugifyOrgName('   Foo Bar   ')).toBe('foo-bar');
  });

  it('collapses multiple consecutive spaces into a single dash', () => {
    expect(slugifyOrgName('Foo     Bar')).toBe('foo-bar');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/web/lib/__tests__/orgSlug.test.ts`

Expected: FAIL — "Cannot find module '../orgSlug'" (or similar).

- [ ] **Step 3: Implement `slugifyOrgName`**

Create `src/web/lib/orgSlug.ts`:

```typescript
export function slugifyOrgName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || 'org';
}
```

Notes:

- `\p{L}` matches any Unicode letter (Latin, Cyrillic, etc.); `\p{N}` matches any digit. The `u` flag is required for Unicode property escapes.
- Non-matching runs collapse to a single dash (the `+` in the character class).
- Length cap happens _before_ the fallback so a 60-char-trimmed result that's non-empty wins over `"org"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/web/lib/__tests__/orgSlug.test.ts`

Expected: PASS (all 11 tests).

- [ ] **Step 5: Stage**

```bash
git add src/web/lib/orgSlug.ts src/web/lib/__tests__/orgSlug.test.ts
```

(Do not commit — user commits.)

---

### Task 2: `buildJoinUrl` utility

**Files:**

- Create: `src/web/lib/buildJoinUrl.ts`
- Create: `src/web/lib/__tests__/buildJoinUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/web/lib/__tests__/buildJoinUrl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildJoinUrl } from '../buildJoinUrl';

describe('buildJoinUrl', () => {
  it('builds a path with slugified org name and token', () => {
    expect(buildJoinUrl('Acme Corp', 'abcd123xyz')).toBe(
      '/join/acme-corp/abcd123xyz'
    );
  });

  it('preserves Cyrillic in the slug', () => {
    expect(buildJoinUrl('Московский Клуб', 'abcd123xyz')).toBe(
      '/join/московский-клуб/abcd123xyz'
    );
  });

  it('uses the "org" fallback when the org name has no slug-able characters', () => {
    expect(buildJoinUrl('!!!', 'abcd123xyz')).toBe('/join/org/abcd123xyz');
  });

  it('returns a relative path starting with /join/', () => {
    expect(buildJoinUrl('Any Org', 'tok')).toMatch(/^\/join\//);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/web/lib/__tests__/buildJoinUrl.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildJoinUrl`**

Create `src/web/lib/buildJoinUrl.ts`:

```typescript
import { slugifyOrgName } from './orgSlug';

export function buildJoinUrl(orgName: string, token: string): string {
  return `/join/${slugifyOrgName(orgName)}/${token}`;
}
```

Notes:

- Returns a **relative path** (not a full URL). Callers that need an absolute URL prepend `window.location.origin` and the current locale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/web/lib/__tests__/buildJoinUrl.test.ts`

Expected: PASS (all 4 tests).

- [ ] **Step 5: Run the whole suite as a sanity check**

Run: `yarn vitest run`

Expected: no regressions.

- [ ] **Step 6: Stage**

```bash
git add src/web/lib/buildJoinUrl.ts src/web/lib/__tests__/buildJoinUrl.test.ts
```

---

**Phase 1 checkpoint.** Mark Phase 1 complete in this file (change `## Phase 1` to `## Phase 1 ✓`) and stop for user review.

---

## Phase 2: Route Migration ✓

### Task 3: Create the new route files

**Files:**

- Create: `src/app/[locale]/join/[orgSlug]/[token]/page.tsx`
- Create: `src/app/[locale]/join/[orgSlug]/[token]/JoinConfirmButton.tsx`
- Create: `src/app/[locale]/join/[orgSlug]/[token]/SetReturnTo.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/[locale]/join/[orgSlug]/[token]"
```

- [ ] **Step 2: Create `JoinConfirmButton.tsx`** (identical to old file)

Create `src/app/[locale]/join/[orgSlug]/[token]/JoinConfirmButton.tsx`:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { joinViaTokenAction } from '@/src/web/actions/organization/joinToken';
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
    <div className="space-y-4">
      {error && <AlertBanner color="red">{error}</AlertBanner>}
      <Button
        color="brand-green"
        className="w-full"
        onClick={handleConfirm}
        disabled={isPending}
      >
        {isPending ? t('confirming') : t('confirmButton')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create `SetReturnTo.tsx`** (identical to old file)

Create `src/app/[locale]/join/[orgSlug]/[token]/SetReturnTo.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import {
  RETURN_TO_COOKIE_NAME,
  isValidReturnToPath,
} from '@/web/lib/returnToValidation';

export function SetReturnTo({ path }: { path: string }) {
  useEffect(() => {
    if (!isValidReturnToPath(path)) {
      return;
    }

    document.cookie = `${RETURN_TO_COOKIE_NAME}=${encodeURIComponent(path)}; max-age=1800; path=/; samesite=lax`;
  }, [path]);

  return null;
}
```

- [ ] **Step 4: Create `page.tsx`** (adapted to new params + new SetReturnTo path)

Create `src/app/[locale]/join/[orgSlug]/[token]/page.tsx`:

```typescript
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaJoinTokenRepository,
} from '@/infrastructure/index';
import { GetJoinTokenPublicInfoUseCase } from '@/application/organization/GetJoinTokenPublicInfoUseCase';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { buildJoinUrl } from '@/web/lib/buildJoinUrl';
import { JoinConfirmButton } from './JoinConfirmButton';
import { SetReturnTo } from './SetReturnTo';

export default async function JoinTokenPage({
  params,
}: {
  params: Promise<{ orgSlug: string; token: string; locale: string }>;
}) {
  const { token } = await params;

  const organizationRepository = new PrismaOrganizationRepository(prisma);
  const joinTokenRepository = new PrismaJoinTokenRepository(prisma);
  const getPublicInfoUseCase = new GetJoinTokenPublicInfoUseCase({
    joinTokenRepository,
    organizationRepository,
    prisma,
  });

  const result = await getPublicInfoUseCase.execute(token);

  if (!result.success) {
    const errorMessage = await translateErrorCode(result.error);

    const tCommonErr = await getTranslations('common');

    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="space-y-4">
          <Link
            href="/home"
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {tCommonErr('backToHome')}
          </Link>
          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <Text className="text-center text-red-600 dark:text-red-400">
              {errorMessage}
            </Text>
          </div>
        </div>
      </div>
    );
  }

  const data = result.value;
  const t = await getTranslations('joinToken.page');
  const user = await getCurrentUser();

  const tCommon = await getTranslations('common');

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="space-y-6">
        {user && (
          <Link
            href="/home"
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {tCommon('backToHome')}
          </Link>
        )}
        <div className="space-y-2 text-center">
          <Heading>{t('title', { orgName: data.organizationName })}</Heading>
          <Text>{t('description')}</Text>
        </div>

        <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="space-y-4">
            {data.organizationDescription && (
              <Text className="text-zinc-700 dark:text-zinc-300">
                {data.organizationDescription}
              </Text>
            )}
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('memberCount', { count: data.memberCount })}
            </Text>

            {user ? (
              <JoinConfirmButton token={token} />
            ) : (
              <div className="flex flex-col gap-3">
                <SetReturnTo
                  path={buildJoinUrl(data.organizationName, token)}
                />
                <Link href="/login" prefetch={false}>
                  <Button color="brand-green" className="w-full">
                    {t('loginToJoin')}
                  </Button>
                </Link>
                <Link href="/register" prefetch={false}>
                  <Button color="zinc" className="w-full">
                    {t('registerToJoin')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Key diffs from old `page.tsx`:

1. `params` type now `{ orgSlug: string; token: string; locale: string }` — `orgSlug` is destructured but **not used** (server ignores it)
2. `buildJoinUrl` imported from `@/web/lib/buildJoinUrl`
3. `SetReturnTo`'s `path` prop is now `buildJoinUrl(data.organizationName, token)` instead of `'/join/' + token`

- [ ] **Step 5: Type-check**

Run: `yarn tsc --noEmit`

Expected: no errors in the new files. (The old `/join/[token]/` directory still exists and may or may not type-check depending on your Next.js version; that's OK — it's deleted in Task 4.)

---

### Task 4: Delete the old route directory

**Files:**

- Delete: `src/app/[locale]/join/[token]/` (whole directory)

- [ ] **Step 1: Remove the old directory**

```bash
rm -rf "src/app/[locale]/join/[token]"
```

- [ ] **Step 2: Verify no dangling references**

Run: `yarn tsc --noEmit`

Expected: no errors.

Run: `grep -rn "'/join/' + token\|\"/join/\" + token\|/join/\${token" src --include="*.ts" --include="*.tsx"` (via Grep tool)

Expected: no matches (all references should go through `buildJoinUrl`).

- [ ] **Step 3: Smoke-test the new route manually**

Start the dev server if not running: `yarn dev`

Navigate in the browser to `http://localhost:3000/en/join/some-org/abcd123xyz` using any real token from your dev DB (or a fake one to see the error state).

Expected:

- Valid token → org info page renders with the new URL structure
- Invalid token → error state shows

- [ ] **Step 4: Stage**

```bash
git add "src/app/[locale]/join"
```

---

**Phase 2 checkpoint.** Mark Phase 2 complete. Stop for user review.

---

## Phase 3: Link Preview (Open Graph) ✓

### Task 5: Add `joinToken.preview.*` localization keys

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add keys to `messages/en.json`**

In `messages/en.json`, locate the existing `"joinToken"` block (around line 1564) and add a `"preview"` sibling section after `"manage"`:

```json
    "preview": {
      "title": "Join {orgName}",
      "fallbackTitle": "НОМОС",
      "cta": "Присоединиться к организации"
    },
```

Note: `fallbackTitle` and `cta` are intentionally Russian in both locale files — the OG image and fallback are served to messenger crawlers that don't send a reliable `Accept-Language`, and Russian is the default app language. The `title` key **is** localized (English here, Russian below) because messengers sometimes do send Accept-Language, and when they do we honor it.

- [ ] **Step 2: Add keys to `messages/ru.json`**

In `messages/ru.json`, locate the matching `"joinToken"` block and add:

```json
    "preview": {
      "title": "Присоединиться к {orgName}",
      "fallbackTitle": "НОМОС",
      "cta": "Присоединиться к организации"
    },
```

- [ ] **Step 3: Verify the JSON is valid**

Run: `yarn tsc --noEmit`

Expected: no errors. (next-intl validates key shape at build / via types if set up.)

Alternative quick check: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"` and same for `ru.json`.

- [ ] **Step 4: Stage**

```bash
git add messages/en.json messages/ru.json
```

---

### Task 6: Add `generateMetadata` to the join page

**Files:**

- Modify: `src/app/[locale]/join/[orgSlug]/[token]/page.tsx`

- [ ] **Step 1: Add imports at the top of `page.tsx`**

Add after the existing imports:

```typescript
import type { Metadata } from 'next';
```

- [ ] **Step 2: Add `generateMetadata` export above the default export**

Insert before `export default async function JoinTokenPage(...)`:

```typescript
export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; token: string; locale: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  const organizationRepository = new PrismaOrganizationRepository(prisma);
  const joinTokenRepository = new PrismaJoinTokenRepository(prisma);
  const getPublicInfoUseCase = new GetJoinTokenPublicInfoUseCase({
    joinTokenRepository,
    organizationRepository,
    prisma,
  });

  const result = await getPublicInfoUseCase.execute(token);
  const t = await getTranslations('joinToken.preview');

  if (!result.success) {
    const fallbackTitle = t('fallbackTitle');
    return {
      title: fallbackTitle,
      openGraph: { title: fallbackTitle, type: 'website' },
      twitter: { card: 'summary_large_image', title: fallbackTitle },
    };
  }

  const { organizationName, organizationDescription } = result.value;
  const title = t('title', { orgName: organizationName });
  const description = (organizationDescription ?? '').slice(0, 200);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
```

Notes:

- Result shape: the existing `page.tsx` uses `result.value` (line 58), not `result.data`. Match that convention.
- `organizationDescription` is defensively coalesced in case the use case ever returns null/undefined.
- `images` is **not** set explicitly. Next.js auto-picks up `opengraph-image.tsx` colocated in the same route segment (added in the next task).

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Smoke-test metadata**

Start dev server: `yarn dev`

In a browser, open `http://localhost:3000/en/join/some-org/<real-token>` and view page source. Expected:

- `<title>Join <OrgName></title>` (EN locale) or `<title>Присоединиться к <OrgName></title>` (RU locale)
- `<meta property="og:title" content="..."/>`
- `<meta property="og:description" content="..."/>`
- `<meta name="twitter:card" content="summary_large_image"/>`

For an invalid token, expected: `<title>НОМОС</title>` and matching `og:title`.

- [ ] **Step 5: Stage**

```bash
git add "src/app/[locale]/join/[orgSlug]/[token]/page.tsx"
```

---

### Task 7: Create `opengraph-image.tsx`

**Files:**

- Create: `src/app/[locale]/join/[orgSlug]/[token]/opengraph-image.tsx`

- [ ] **Step 1: Create the file**

Create `src/app/[locale]/join/[orgSlug]/[token]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaJoinTokenRepository,
} from '@/infrastructure/index';
import { GetJoinTokenPublicInfoUseCase } from '@/application/organization/GetJoinTokenPublicInfoUseCase';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'НОМОС';

export default async function OgImage({
  params,
}: {
  params: Promise<{ orgSlug: string; token: string; locale: string }>;
}) {
  const { token } = await params;

  const organizationRepository = new PrismaOrganizationRepository(prisma);
  const joinTokenRepository = new PrismaJoinTokenRepository(prisma);
  const getPublicInfoUseCase = new GetJoinTokenPublicInfoUseCase({
    joinTokenRepository,
    organizationRepository,
    prisma,
  });

  const result = await getPublicInfoUseCase.execute(token);
  const t = await getTranslations('joinToken.preview');

  const orgName = result.success ? result.value.organizationName : t('fallbackTitle');
  const showCta = result.success;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#247063',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Inline circle logo mark — avoids fs access on edge-style runtimes */}
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '60px',
            background: '#ffffff',
            color: '#247063',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '60px',
            fontWeight: 900,
            marginBottom: '40px',
          }}
        >
          Н
        </div>

        <div
          style={{
            fontSize: '96px',
            fontWeight: 800,
            textAlign: 'center',
            maxWidth: '1000px',
            lineHeight: 1.1,
          }}
        >
          {orgName}
        </div>

        {showCta && (
          <div
            style={{
              fontSize: '40px',
              marginTop: '32px',
              opacity: 0.9,
            }}
          >
            {t('cta')}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '28px',
            opacity: 0.7,
          }}
        >
          НОМОС
        </div>
      </div>
    ),
    { ...size }
  );
}
```

Notes:

- **Runtime: `'nodejs'`** — the use case reaches Prisma, which isn't edge-compatible. Per Next.js docs, `opengraph-image.tsx` supports both `'nodejs'` and `'edge'`. We use nodejs so we can reuse the same `GetJoinTokenPublicInfoUseCase` that powers the page.
- **Logo:** rendered as a CSS circle with the Cyrillic "Н" glyph inside. This sidesteps the problem of loading `public/images/logo-icon.svg` at render time (inline SVG markup as JSX is supported by `next/og` but the existing logo is a complex multi-path SVG; a simple monogram is cleaner and renders reliably). If the user wants the actual logo SVG inlined later, that's a follow-up.
- **Layout:**
  - Brand-green `#247063` background
  - White monogram circle (logo placeholder)
  - Org name as hero (96px, bold)
  - CTA line only on success (40px)
  - "НОМОС" brand mark bottom (28px, faded)
- **Fallback:** on token error, `orgName` is replaced with `fallbackTitle` ("НОМОС") and the CTA line is hidden to avoid the awkward "join this nothing" wording.
- **Duplicate brand mark:** on error, hero text is "НОМОС" and bottom is also "НОМОС". Acceptable — the alternative is a separate template, which adds complexity for a rarely-seen case.

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Smoke-test the OG image**

Dev server: `yarn dev`

Open `http://localhost:3000/en/join/some-org/<real-token>/opengraph-image` in a browser.

Expected: a 1200×630 PNG renders showing brand-green background, white "Н" monogram, org name, CTA line, and "НОМОС" footer.

Also test error case: `http://localhost:3000/en/join/some-org/aaaaaaaaaa/opengraph-image` (non-existent token)

Expected: same template but "НОМОС" as the hero, no CTA line.

- [ ] **Step 4: Smoke-test messenger preview (optional but recommended)**

Use one of:

- `https://metatags.io` — paste your dev URL (only works if dev server is publicly reachable, e.g. via ngrok/localtunnel)
- Or test on a deployed preview build if the team has preview URLs set up
- Or simply inspect the page source and confirm `og:image` points at `/en/join/some-org/<token>/opengraph-image` and `twitter:image` matches

Expected: the preview card shows the generated image + title + description.

- [ ] **Step 5: Stage**

```bash
git add "src/app/[locale]/join/[orgSlug]/[token]/opengraph-image.tsx"
```

---

**Phase 3 checkpoint.** Mark Phase 3 complete. Stop for user review.

---

## Phase 4: Admin "Copy link" Integration ✓

### Task 8: Thread `organizationName` through the manage-tokens component tree

**Files:**

- Modify: `src/app/[locale]/organizations/[id]/manage-tokens/page.tsx`
- Modify: `src/app/[locale]/organizations/[id]/manage-tokens/ManageTokensClient.tsx`

- [ ] **Step 1: Update `page.tsx` to pass `organizationName`**

In `src/app/[locale]/organizations/[id]/manage-tokens/page.tsx`:

Before:

```tsx
<ManageTokensClient
  organizationId={id}
  initialTokens={tokensResult.success ? tokensResult.data.tokens : []}
  initialTotalCount={tokensResult.success ? tokensResult.data.totalCount : 0}
/>
```

After:

```tsx
<ManageTokensClient
  organizationId={id}
  organizationName={orgResult.success ? orgResult.data.name : ''}
  initialTokens={tokensResult.success ? tokensResult.data.tokens : []}
  initialTotalCount={tokensResult.success ? tokensResult.data.totalCount : 0}
/>
```

Notes:

- `orgResult` is already awaited above (line 28-31 `const [orgResult, isSuperAdmin] = await Promise.all(...)`).
- Fallback to empty string if the org fetch failed — `slugifyOrgName('')` returns `'org'` so links still work, just without the descriptive slug.
- **Check shape:** before running, verify `orgResult.data.name` exists. Search the action: `grep -n "name" src/web/actions/organization/organization.ts` and look at the `getOrganizationDetailsAction` return type. If the property is called something other than `name` (e.g. `organizationName`), adjust accordingly.

- [ ] **Step 2: Update `ManageTokensClient.tsx` to accept and forward the prop**

In `src/app/[locale]/organizations/[id]/manage-tokens/ManageTokensClient.tsx`:

Before:

```tsx
export function ManageTokensClient({
  organizationId,
  initialTokens,
  initialTotalCount,
}: {
  organizationId: string;
  initialTokens: TokenData[];
  initialTotalCount: number;
}) {
```

After:

```tsx
export function ManageTokensClient({
  organizationId,
  organizationName,
  initialTokens,
  initialTotalCount,
}: {
  organizationId: string;
  organizationName: string;
  initialTokens: TokenData[];
  initialTotalCount: number;
}) {
```

And in the JSX, pass `organizationName` down to `TokenList`:

Before:

```tsx
<TokenList
  ref={tokenListRef}
  organizationId={organizationId}
  initialTokens={initialTokens}
  initialTotalCount={initialTotalCount}
/>
```

After:

```tsx
<TokenList
  ref={tokenListRef}
  organizationId={organizationId}
  organizationName={organizationName}
  initialTokens={initialTokens}
  initialTotalCount={initialTotalCount}
/>
```

- [ ] **Step 3: Type-check**

Run: `yarn tsc --noEmit`

Expected: one error in `TokenList.tsx` — "Property `organizationName` does not exist on type..." (because we haven't added it yet). This is expected; fixed in the next task.

---

### Task 9: Use `buildJoinUrl` in `handleCopyLink`

**Files:**

- Modify: `src/app/[locale]/organizations/[id]/manage-tokens/TokenList.tsx`

- [ ] **Step 1: Accept `organizationName` in `TokenList` props**

In `src/app/[locale]/organizations/[id]/manage-tokens/TokenList.tsx` at the `forwardRef` generic type:

Before:

```tsx
export const TokenList = forwardRef<
  TokenListHandle,
  {
    organizationId: string;
    initialTokens: TokenData[];
    initialTotalCount: number;
  }
>(function TokenList(
  { organizationId, initialTokens, initialTotalCount },
  ref
) {
```

After:

```tsx
export const TokenList = forwardRef<
  TokenListHandle,
  {
    organizationId: string;
    organizationName: string;
    initialTokens: TokenData[];
    initialTotalCount: number;
  }
>(function TokenList(
  { organizationId, organizationName, initialTokens, initialTotalCount },
  ref
) {
```

- [ ] **Step 2: Import `buildJoinUrl`**

Add to the imports near the top of `TokenList.tsx`:

```typescript
import { buildJoinUrl } from '@/web/lib/buildJoinUrl';
```

- [ ] **Step 3: Update `handleCopyLink` to use `buildJoinUrl`**

Before (`TokenList.tsx:148-152`):

```typescript
const handleCopyLink = (tokenValue: string) => {
  const url = `${window.location.origin}/${locale}/join/${tokenValue}`;
  navigator.clipboard.writeText(url);
  toast.success(t('copySuccess'));
};
```

After:

```typescript
const handleCopyLink = (tokenValue: string) => {
  const path = buildJoinUrl(organizationName, tokenValue);
  const url = `${window.location.origin}/${locale}${path}`;
  navigator.clipboard.writeText(url);
  toast.success(t('copySuccess'));
};
```

- [ ] **Step 4: Type-check**

Run: `yarn tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `yarn vitest run`

Expected: all tests pass (the utility tests from Phase 1 should still be green).

- [ ] **Step 6: Smoke-test "Copy link" in the browser**

With dev server running, navigate to `/en/organizations/<some-id>/manage-tokens` (must be admin/superadmin). Click "Copy link" on a token row and paste the result into an address bar.

Expected:

- URL has the pattern `http://localhost:3000/en/join/<slugified-org-name>/<token>`
- Slug is derived from the org name (Cyrillic preserved if org has Cyrillic name)
- Navigating to the pasted URL loads the join page successfully

- [ ] **Step 7: Stage**

```bash
git add "src/app/[locale]/organizations/[id]/manage-tokens"
```

---

**Phase 4 checkpoint.** Mark Phase 4 complete. Stop for user review.

---

## Final Verification

- [ ] **All tests pass:** `yarn vitest run`
- [ ] **Type check clean:** `yarn tsc --noEmit`
- [ ] **Lint clean:** `yarn lint` (if available) or `yarn eslint .`
- [ ] **Manual smoke of both flows:**
  - Admin creates token → clicks "Copy link" → pasted URL includes slugified org name → URL opens valid join page
  - Pasting the URL into a messenger (or metatags.io) shows preview card with org name + description + branded image
  - Invalid/expired token → still shows error inline on page; preview falls back to "НОМОС" card
- [ ] **No dangling references:** no code outside the utilities constructs `/join/...` URLs by hand

---

## Unresolved questions

1. Should the actual `logo-icon.svg` be inlined in the OG image instead of the "Н" monogram placeholder? (Plan uses the monogram for simplicity.)
2. OG description currently uses raw `organizationDescription` truncated to 200 chars. Any HTML/markdown in descriptions? If yes, strip before truncation.
3. `alt` text on the OG image is hardcoded as `'НОМОС'`. Should it be localized per-org (`"Join {orgName}"`)? Screen readers rarely see OG `alt`, so this may be low-value.
