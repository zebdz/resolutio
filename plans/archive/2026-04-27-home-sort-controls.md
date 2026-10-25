# Home Page Sort Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-section sort pill controls to the home page (`UserOrganizationsList.tsx`) that let users sort each list by a chosen field with asc/desc direction, persisted in `localStorage`.

**Architecture:** Three independent UI sections each get their own `<SortPills />` row. State is managed by a `usePersistedSort` hook that hydrates from `localStorage` after mount and writes back on change. Sorting logic is split into pure comparator factories (testable) and a tiny React presentational component. No server-side changes.

**Tech Stack:** Next.js 15 + React, `next-intl` for locale, Tailwind + Catalyst for styling, vitest for tests (node env, pure-logic tests — no React Testing Library available).

**Spec:** `readmes/2026-04-27-home-sort-controls-design.md`

**Project rules to remember:**

- Per `CLAUDE.md`: **NEVER `git commit`** — `git add` is fine. After each task, stage changes; the user commits at their discretion.
- Per `CLAUDE.md`: **Ask for confirmation before any file edit/write/bash that modifies the filesystem** (this is a learning project).
- All clickable native `<button>` elements MUST include `cursor-pointer` (and `disabled:cursor-not-allowed` if disablable).
- Localize everything — no hardcoded UI strings.

---

## File Structure

### New files

| Path                                                        | Responsibility                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/home/sortOrganizations.ts`                | Pure comparator factories: `sortMemberOrganizations`, `sortAdminOrganizations`, `sortExternalBoards`. Returns new sorted arrays. |
| `src/app/[locale]/home/__tests__/sortOrganizations.test.ts` | Unit tests for all three comparator factories.                                                                                   |
| `src/app/[locale]/home/sortStorage.ts`                      | Pure helpers `loadSort` / `saveSort` accepting an injected `Storage`-like object. Validates stored value against allowed fields. |
| `src/app/[locale]/home/__tests__/sortStorage.test.ts`       | Unit tests for storage helpers.                                                                                                  |
| `src/app/[locale]/home/usePersistedSort.ts`                 | Thin React hook around the storage helpers, wired to `window.localStorage`.                                                      |
| `src/app/[locale]/home/SortPills.tsx`                       | Presentational client component: renders a row of pill buttons; emits `onChange`.                                                |

### Modified files

| Path                                              | Change                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/[locale]/home/UserOrganizationsList.tsx` | Add three `usePersistedSort` calls (one per section), apply comparator before rendering, render `<SortPills />` next to each section heading. |
| `messages/en.json`                                | Add three keys under `home.sort`.                                                                                                             |
| `messages/ru.json`                                | Add three keys under `home.sort`.                                                                                                             |

---

## Task 1: Comparator for member organizations (TDD)

**Files:**

- Create: `src/app/[locale]/home/sortOrganizations.ts`
- Create: `src/app/[locale]/home/__tests__/sortOrganizations.test.ts`

- [ ] **Step 1.1: Write failing tests for `sortMemberOrganizations`**

Create `src/app/[locale]/home/__tests__/sortOrganizations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sortMemberOrganizations } from '../sortOrganizations';

const make = (name: string, joinedAt: Date, id = name.toLowerCase()) => ({
  id,
  name,
  description: '',
  joinedAt,
});

describe('sortMemberOrganizations', () => {
  it('sorts by name asc', () => {
    const list = [
      make('Charlie', new Date('2020-01-01')),
      make('Alpha', new Date('2020-01-01')),
      make('Bravo', new Date('2020-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by name desc', () => {
    const list = [
      make('Alpha', new Date('2020-01-01')),
      make('Charlie', new Date('2020-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'desc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Charlie', 'Alpha']);
  });

  it('sorts by joinedAt asc (oldest first)', () => {
    const list = [
      make('A', new Date('2022-01-01')),
      make('B', new Date('2020-01-01')),
      make('C', new Date('2021-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'joinedAt', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by joinedAt desc (newest first)', () => {
    const list = [
      make('A', new Date('2020-01-01')),
      make('B', new Date('2022-01-01')),
      make('C', new Date('2021-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'joinedAt', direction: 'desc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['B', 'C', 'A']);
  });

  it('uses locale-aware comparison for Cyrillic', () => {
    const list = [
      make('Яблоко', new Date('2020-01-01')),
      make('Апельсин', new Date('2020-01-01')),
      make('Банан', new Date('2020-01-01')),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'ru'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Апельсин', 'Банан', 'Яблоко']);
  });

  it('does not mutate the input list', () => {
    const list = [
      make('B', new Date('2020-01-01')),
      make('A', new Date('2020-01-01')),
    ];
    const before = list.map((o) => o.name);
    sortMemberOrganizations(list, { field: 'name', direction: 'asc' }, 'en');
    expect(list.map((o) => o.name)).toEqual(before);
  });

  it('preserves insertion order for equal-name items (stable)', () => {
    const list = [
      make('Same', new Date('2020-01-01'), 'first'),
      make('Same', new Date('2020-01-01'), 'second'),
      make('Same', new Date('2020-01-01'), 'third'),
    ];
    const sorted = sortMemberOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.id)).toEqual(['first', 'second', 'third']);
  });
});
```

- [ ] **Step 1.2: Run test — verify it fails**

Run: `yarn test src/app/[locale]/home/__tests__/sortOrganizations.test.ts`
Expected: fail with "Cannot find module '../sortOrganizations'".

- [ ] **Step 1.3: Implement `sortMemberOrganizations`**

Create `src/app/[locale]/home/sortOrganizations.ts`:

```ts
export type SortDirection = 'asc' | 'desc';

export type MemberSortField = 'name' | 'joinedAt';

export interface MemberSortable {
  name: string;
  joinedAt?: Date;
}

const compareStrings = (
  a: string,
  b: string,
  locale: string,
  direction: SortDirection
): number => {
  const result = a.localeCompare(b, locale);
  return direction === 'asc' ? result : -result;
};

const compareDates = (
  a: Date | undefined,
  b: Date | undefined,
  direction: SortDirection
): number => {
  const aTime = a ? a.getTime() : 0;
  const bTime = b ? b.getTime() : 0;
  const result = aTime - bTime;
  return direction === 'asc' ? result : -result;
};

export function sortMemberOrganizations<T extends MemberSortable>(
  list: T[],
  sort: { field: MemberSortField; direction: SortDirection },
  locale: string
): T[] {
  const copy = [...list];

  if (sort.field === 'name') {
    copy.sort((a, b) => compareStrings(a.name, b.name, locale, sort.direction));
  } else {
    copy.sort((a, b) => compareDates(a.joinedAt, b.joinedAt, sort.direction));
  }

  return copy;
}
```

- [ ] **Step 1.4: Run tests — verify all pass**

Run: `yarn test src/app/[locale]/home/__tests__/sortOrganizations.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 1.5: Stage changes**

```bash
git add src/app/[locale]/home/sortOrganizations.ts src/app/[locale]/home/__tests__/sortOrganizations.test.ts
```

(Do NOT commit — user will commit at their discretion.)

---

## Task 2: Comparator for admin orgs and external boards (TDD)

**Files:**

- Modify: `src/app/[locale]/home/sortOrganizations.ts`
- Modify: `src/app/[locale]/home/__tests__/sortOrganizations.test.ts`

- [ ] **Step 2.1: Add failing tests for `sortAdminOrganizations` and `sortExternalBoards`**

Append to `src/app/[locale]/home/__tests__/sortOrganizations.test.ts`:

```ts
import {
  sortAdminOrganizations,
  sortExternalBoards,
} from '../sortOrganizations';

describe('sortAdminOrganizations', () => {
  it('sorts by name asc', () => {
    const list = [
      { id: '1', name: 'Beta', description: '' },
      { id: '2', name: 'Alpha', description: '' },
    ];
    const sorted = sortAdminOrganizations(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Alpha', 'Beta']);
  });

  it('sorts by name desc', () => {
    const list = [
      { id: '1', name: 'Alpha', description: '' },
      { id: '2', name: 'Beta', description: '' },
    ];
    const sorted = sortAdminOrganizations(
      list,
      { field: 'name', direction: 'desc' },
      'en'
    );
    expect(sorted.map((o) => o.name)).toEqual(['Beta', 'Alpha']);
  });
});

describe('sortExternalBoards', () => {
  const make = (name: string, organizationName: string, id = name) => ({
    id,
    name,
    organizationId: 'org-' + organizationName,
    organizationName,
  });

  it('sorts by name asc', () => {
    const list = [make('Z-board', 'Org B'), make('A-board', 'Org A')];
    const sorted = sortExternalBoards(
      list,
      { field: 'name', direction: 'asc' },
      'en'
    );
    expect(sorted.map((b) => b.name)).toEqual(['A-board', 'Z-board']);
  });

  it('sorts by name desc', () => {
    const list = [make('A-board', 'Org A'), make('Z-board', 'Org B')];
    const sorted = sortExternalBoards(
      list,
      { field: 'name', direction: 'desc' },
      'en'
    );
    expect(sorted.map((b) => b.name)).toEqual(['Z-board', 'A-board']);
  });

  it('sorts by organizationName asc', () => {
    const list = [make('B1', 'Zulu Org'), make('B2', 'Alpha Org')];
    const sorted = sortExternalBoards(
      list,
      { field: 'organizationName', direction: 'asc' },
      'en'
    );
    expect(sorted.map((b) => b.organizationName)).toEqual([
      'Alpha Org',
      'Zulu Org',
    ]);
  });

  it('sorts by organizationName desc', () => {
    const list = [make('B1', 'Alpha Org'), make('B2', 'Zulu Org')];
    const sorted = sortExternalBoards(
      list,
      { field: 'organizationName', direction: 'desc' },
      'en'
    );
    expect(sorted.map((b) => b.organizationName)).toEqual([
      'Zulu Org',
      'Alpha Org',
    ]);
  });
});
```

- [ ] **Step 2.2: Run tests — verify failures**

Run: `yarn test src/app/[locale]/home/__tests__/sortOrganizations.test.ts`
Expected: 6 new tests fail with "is not a function" / module export errors.

- [ ] **Step 2.3: Add implementations**

Append to `src/app/[locale]/home/sortOrganizations.ts`:

```ts
export type AdminSortField = 'name';

export interface AdminSortable {
  name: string;
}

export function sortAdminOrganizations<T extends AdminSortable>(
  list: T[],
  sort: { field: AdminSortField; direction: SortDirection },
  locale: string
): T[] {
  const copy = [...list];
  copy.sort((a, b) => compareStrings(a.name, b.name, locale, sort.direction));
  return copy;
}

export type ExternalBoardSortField = 'name' | 'organizationName';

export interface ExternalBoardSortable {
  name: string;
  organizationName: string;
}

export function sortExternalBoards<T extends ExternalBoardSortable>(
  list: T[],
  sort: { field: ExternalBoardSortField; direction: SortDirection },
  locale: string
): T[] {
  const copy = [...list];
  const key: keyof ExternalBoardSortable = sort.field;
  copy.sort((a, b) => compareStrings(a[key], b[key], locale, sort.direction));
  return copy;
}
```

- [ ] **Step 2.4: Run tests — verify all pass**

Run: `yarn test src/app/[locale]/home/__tests__/sortOrganizations.test.ts`
Expected: all 13 tests pass.

- [ ] **Step 2.5: Stage changes**

```bash
git add src/app/[locale]/home/sortOrganizations.ts src/app/[locale]/home/__tests__/sortOrganizations.test.ts
```

---

## Task 3: Storage helpers (TDD)

**Files:**

- Create: `src/app/[locale]/home/sortStorage.ts`
- Create: `src/app/[locale]/home/__tests__/sortStorage.test.ts`

- [ ] **Step 3.1: Write failing tests for `loadSort` and `saveSort`**

Create `src/app/[locale]/home/__tests__/sortStorage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSort, saveSort } from '../sortStorage';

class FakeStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe('loadSort', () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('returns default when key not present', () => {
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });

  it('returns stored value when valid', () => {
    storage.setItem(
      'home.sort.member',
      JSON.stringify({ field: 'joinedAt', direction: 'desc' })
    );
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'joinedAt', direction: 'desc' });
  });

  it('returns default when stored field is not allowed', () => {
    storage.setItem(
      'home.sort.member',
      JSON.stringify({ field: 'rogue', direction: 'asc' })
    );
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });

  it('returns default when stored direction is invalid', () => {
    storage.setItem(
      'home.sort.member',
      JSON.stringify({ field: 'name', direction: 'sideways' })
    );
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });

  it('returns default when stored value is malformed JSON', () => {
    storage.setItem('home.sort.member', '{not-json');
    const result = loadSort(
      storage,
      'home.sort.member',
      ['name', 'joinedAt'] as const,
      {
        field: 'name',
        direction: 'asc',
      }
    );
    expect(result).toEqual({ field: 'name', direction: 'asc' });
  });
});

describe('saveSort', () => {
  it('writes JSON-stringified value to storage', () => {
    const storage = new FakeStorage();
    saveSort(storage, 'home.sort.member', {
      field: 'joinedAt',
      direction: 'desc',
    });
    expect(storage.getItem('home.sort.member')).toBe(
      JSON.stringify({ field: 'joinedAt', direction: 'desc' })
    );
  });
});
```

- [ ] **Step 3.2: Run tests — verify failure**

Run: `yarn test src/app/[locale]/home/__tests__/sortStorage.test.ts`
Expected: fail with "Cannot find module '../sortStorage'".

- [ ] **Step 3.3: Implement storage helpers**

Create `src/app/[locale]/home/sortStorage.ts`:

```ts
import type { SortDirection } from './sortOrganizations';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

export function loadSort<F extends string>(
  storage: StorageLike,
  key: string,
  allowedFields: readonly F[],
  defaultValue: SortState<F>
): SortState<F> {
  const raw = storage.getItem(key);
  if (raw === null) return defaultValue;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultValue;
  }

  if (typeof parsed !== 'object' || parsed === null) return defaultValue;

  const obj = parsed as Record<string, unknown>;
  const field = obj.field;
  const direction = obj.direction;

  if (typeof field !== 'string' || !allowedFields.includes(field as F))
    return defaultValue;
  if (direction !== 'asc' && direction !== 'desc') return defaultValue;

  return { field: field as F, direction };
}

export function saveSort<F extends string>(
  storage: StorageLike,
  key: string,
  value: SortState<F>
): void {
  storage.setItem(key, JSON.stringify(value));
}
```

- [ ] **Step 3.4: Run tests — verify all pass**

Run: `yarn test src/app/[locale]/home/__tests__/sortStorage.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 3.5: Stage changes**

```bash
git add src/app/[locale]/home/sortStorage.ts src/app/[locale]/home/__tests__/sortStorage.test.ts
```

---

## Task 4: `usePersistedSort` hook

**Files:**

- Create: `src/app/[locale]/home/usePersistedSort.ts`

This hook is a thin wrapper over the storage helpers — there is no React Testing Library or jsdom in this project, so we don't write a unit test for the hook itself; the testable logic already lives in `sortStorage.ts`.

- [ ] **Step 4.1: Implement the hook**

Create `src/app/[locale]/home/usePersistedSort.ts`:

```ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadSort, saveSort, type SortState } from './sortStorage';

export function usePersistedSort<F extends string>(
  storageKey: string,
  allowedFields: readonly F[],
  defaultValue: SortState<F>
): [SortState<F>, (next: SortState<F>) => void] {
  const [value, setValue] = useState<SortState<F>>(defaultValue);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setValue(
      loadSort(window.localStorage, storageKey, allowedFields, defaultValue)
    );
    // We intentionally hydrate only once on mount — storageKey, allowedFields,
    // and defaultValue are stable per usage site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (next: SortState<F>) => {
      setValue(next);
      if (typeof window !== 'undefined') {
        saveSort(window.localStorage, storageKey, next);
      }
    },
    [storageKey]
  );

  return [value, update];
}
```

- [ ] **Step 4.2: Type-check**

Run: `yarn typecheck`
Expected: passes.

- [ ] **Step 4.3: Stage changes**

```bash
git add src/app/[locale]/home/usePersistedSort.ts
```

---

## Task 5: `SortPills` component

**Files:**

- Create: `src/app/[locale]/home/SortPills.tsx`

- [ ] **Step 5.1: Implement the component**

Create `src/app/[locale]/home/SortPills.tsx`:

```tsx
'use client';

import type { SortDirection } from './sortOrganizations';

interface SortField {
  value: string;
  label: string;
}

interface SortPillsProps {
  fields: SortField[];
  active: { field: string; direction: SortDirection };
  onChange: (next: { field: string; direction: SortDirection }) => void;
}

export function SortPills({ fields, active, onChange }: SortPillsProps) {
  const handleClick = (fieldValue: string) => {
    if (fieldValue === active.field) {
      onChange({
        field: fieldValue,
        direction: active.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onChange({ field: fieldValue, direction: 'asc' });
    }
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Sort">
      {fields.map((field) => {
        const isActive = field.value === active.field;
        const arrow = isActive ? (active.direction === 'asc' ? '↑' : '↓') : '';
        return (
          <button
            key={field.value}
            type="button"
            onClick={() => handleClick(field.value)}
            aria-pressed={isActive}
            className={
              'inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
              (isActive
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800')
            }
          >
            <span>{field.label}</span>
            {isActive && <span aria-hidden="true">{arrow}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5.2: Type-check**

Run: `yarn typecheck`
Expected: passes.

- [ ] **Step 5.3: Stage changes**

```bash
git add src/app/[locale]/home/SortPills.tsx
```

---

## Task 6: Localization strings

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 6.1: Add `sort` block to `home` in `messages/en.json`**

Inside the existing `"home": { ... }` object (around line 112), add a new `"sort"` key. Place it after `"archivedBadge": "Archived",` (line 130) for grouping with other UI labels:

```json
    "sort": {
      "byName": "Name",
      "byJoined": "Joined",
      "byOrganization": "Organization"
    },
```

- [ ] **Step 6.2: Add `sort` block to `home` in `messages/ru.json`**

Same location in `messages/ru.json`:

```json
    "sort": {
      "byName": "Имя",
      "byJoined": "Дата вступления",
      "byOrganization": "Организация"
    },
```

- [ ] **Step 6.3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ru.json','utf8')); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 6.4: Stage changes**

```bash
git add messages/en.json messages/ru.json
```

---

## Task 7: Wire sort controls into `UserOrganizationsList`

**Files:**

- Modify: `src/app/[locale]/home/UserOrganizationsList.tsx`

- [ ] **Step 7.1: Add imports**

Open `src/app/[locale]/home/UserOrganizationsList.tsx`. Update the imports at the top:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
```

Then add three new imports below the existing local imports:

```tsx
import { SortPills } from './SortPills';
import { usePersistedSort } from './usePersistedSort';
import {
  sortMemberOrganizations,
  sortAdminOrganizations,
  sortExternalBoards,
} from './sortOrganizations';
```

- [ ] **Step 7.2: Add sort state inside the component**

In the function body, after `const tShortcut = useTranslations('propertyClaim.shortcut');` add:

```tsx
const tSort = useTranslations('home.sort');
const locale = useLocale();

const [memberSort, setMemberSort] = usePersistedSort(
  'home.sort.member',
  ['name', 'joinedAt'] as const,
  { field: 'name', direction: 'asc' }
);
const [adminSort, setAdminSort] = usePersistedSort(
  'home.sort.adminOnly',
  ['name'] as const,
  { field: 'name', direction: 'asc' }
);
const [externalSort, setExternalSort] = usePersistedSort(
  'home.sort.external',
  ['name', 'organizationName'] as const,
  { field: 'name', direction: 'asc' }
);
```

- [ ] **Step 7.3: Compute sorted lists with `useMemo`**

After the existing `adminOnlyOrgs`/`adminIdSet`/`hasOrganizations` derivation block (around line 141-147 in the current file), add:

```tsx
const sortedMember = useMemo(
  () => sortMemberOrganizations(member, memberSort, locale),
  [member, memberSort, locale]
);
const sortedAdminOnly = useMemo(
  () => sortAdminOrganizations(adminOnlyOrgs, adminSort, locale),
  [adminOnlyOrgs, adminSort, locale]
);
const sortedExternalBoards = useMemo(
  () => sortExternalBoards(externalBoards, externalSort, locale),
  [externalBoards, externalSort, locale]
);
```

- [ ] **Step 7.4: Replace the three `.map()` calls to use the sorted lists**

In the JSX:

- Replace `member.length > 0 &&` with `sortedMember.length > 0 &&` (the gate) — actually, keep `member.length > 0` for the gate (sortedMember has the same length). Just replace `member.map((org) => {` → `sortedMember.map((org) => {`.
- Replace `adminOnlyOrgs.map((org) => (` → `sortedAdminOnly.map((org) => (`.
- Replace `externalBoards.map((board) => (` → `sortedExternalBoards.map((board) => (`.

- [ ] **Step 7.5: Render `<SortPills />` in each section header**

For the **Member** section, replace this block:

```tsx
<Heading level={2} className="mb-4">
  {t('myOrganizations')}
</Heading>
```

with:

```tsx
<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
  <Heading level={2}>{t('myOrganizations')}</Heading>
  <SortPills
    fields={[
      { value: 'name', label: tSort('byName') },
      { value: 'joinedAt', label: tSort('byJoined') },
    ]}
    active={memberSort}
    onChange={(next) =>
      setMemberSort(
        next as { field: 'name' | 'joinedAt'; direction: 'asc' | 'desc' }
      )
    }
  />
</div>
```

For the **Admin-only** section, replace:

```tsx
<Heading level={2} className="mb-4">
  {t('myAdminOrganizations')}
</Heading>
```

with:

```tsx
<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
  <Heading level={2}>{t('myAdminOrganizations')}</Heading>
  <SortPills
    fields={[{ value: 'name', label: tSort('byName') }]}
    active={adminSort}
    onChange={(next) =>
      setAdminSort(next as { field: 'name'; direction: 'asc' | 'desc' })
    }
  />
</div>
```

For the **External Boards** section, replace:

```tsx
<Heading level={2} className="mb-4">
  {t('externalBoards')}
</Heading>
```

with:

```tsx
<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
  <Heading level={2}>{t('externalBoards')}</Heading>
  <SortPills
    fields={[
      { value: 'name', label: tSort('byName') },
      { value: 'organizationName', label: tSort('byOrganization') },
    ]}
    active={externalSort}
    onChange={(next) =>
      setExternalSort(
        next as {
          field: 'name' | 'organizationName';
          direction: 'asc' | 'desc';
        }
      )
    }
  />
</div>
```

- [ ] **Step 7.6: Type-check and lint**

Run: `yarn typecheck`
Expected: passes.

Run: `yarn lint`
Expected: passes (or only pre-existing warnings).

- [ ] **Step 7.7: Run the full test suite**

Run: `yarn test`
Expected: all tests pass (including the 13 new ones from Tasks 1–3).

- [ ] **Step 7.8: Stage changes**

```bash
git add src/app/[locale]/home/UserOrganizationsList.tsx
```

---

## Task 8: Manual smoke test in browser

This task is a manual verification by the engineer / user.

- [ ] **Step 8.1: Start dev server**

Run: `yarn dev`
Open: `http://localhost:8080`

- [ ] **Step 8.2: Log in and navigate to `/home`**

- [ ] **Step 8.3: Verify Member Organizations**
  - Two pills visible: `Name`, `Joined`. `Name` is active with `↑`. List is sorted A→Z.
  - Click `Name` again → arrow flips to `↓`. List reverses.
  - Click `Joined` → switches to Joined, arrow shows `↑`. List sorted oldest first.
  - Click `Joined` again → `↓`, list newest first.
  - Reload the page → last selection persists.

- [ ] **Step 8.4: Verify Admin-only Organizations**
  - Single pill `Name` is active with `↑`. List A→Z.
  - Click `Name` → toggles direction.
  - Reload → persists.

- [ ] **Step 8.5: Verify External Boards**
  - Two pills: `Name`, `Organization`. Behaves like Member section.
  - Reload → persists.

- [ ] **Step 8.6: Verify Russian locale**
  - Switch language to Russian.
  - Pill labels show as `Имя` / `Дата вступления` / `Организация`.
  - Sorting Cyrillic names produces correct alphabetical order.

- [ ] **Step 8.7: Verify mobile responsive layout**
  - Resize to mobile width (~375px). Pills wrap below the heading instead of overflowing horizontally.

---

## Self-Review Findings

Spec coverage:

- ✅ Per-section pills — Tasks 5, 7
- ✅ Sort fields per section — Task 7 (configured per section)
- ✅ Click-active toggles direction; click-inactive switches and resets to asc — Task 5 (`SortPills.handleClick`)
- ✅ Default `name asc` — Tasks 4, 7 (`defaultValue` arg)
- ✅ Persistence under `home.sort.*` keys — Tasks 3, 4, 7
- ✅ Locale-aware string sort — Tasks 1, 2, 7 (`useLocale()` plumbed)
- ✅ Date sort by `joinedAt` — Task 1
- ✅ Stable sort, immutable input — Task 1 tests
- ✅ Validation of stored value — Task 3 tests
- ✅ Localization strings (en + ru) — Task 6
- ✅ Mobile responsive layout — Task 7 (uses `flex-wrap`), verified in Task 8

No placeholders. Type names consistent across tasks (`SortDirection`, `SortState<F>`, `MemberSortField`, etc.).

---

## Unresolved Questions

None.
