# Home Page Sort Controls — Design

## Goal

Let users sort each list section on the home page by a chosen field and direction. Choices persist across reloads.

## Sections and Sort Fields

The home page renders three independent sections in `src/app/[locale]/home/UserOrganizationsList.tsx`. Each section gets its own sort control.

| Section                  | Sort fields                |
| ------------------------ | -------------------------- |
| Member Organizations     | `name`, `joinedAt`         |
| Admin-only Organizations | `name`                     |
| External Boards          | `name`, `organizationName` |

## UI: Pill Buttons

Each section header gets a row of pill buttons next to (or under) the heading. One pill per sortable field.

- Active pill: highlighted background + arrow icon (`↑` for asc, `↓` for desc).
- Inactive pill: muted styling, no arrow.
- Click on **inactive** pill → switch field, direction resets to `asc`.
- Click on **active** pill → toggle direction (`asc` ↔ `desc`).

When a section has only one sortable field (Admin-only), there is one pill; clicking it always toggles direction.

## Default

On first load (no stored value), all sections sort by `name` ascending.

## Persistence

Each section persists its sort state in `localStorage` under independent keys:

- `home.sort.member`
- `home.sort.adminOnly`
- `home.sort.external`

Stored value shape: `{ "field": "<field>", "direction": "asc" | "desc" }`.

On hydration:

- If stored value is missing → use default (`name asc`).
- If stored value has a `field` not allowed for that section → fall back to default.
- If stored value is malformed JSON → fall back to default.

## Sorting Logic

- **Strings** (`name`, `organizationName`): `String.prototype.localeCompare(other, locale)`. The active locale is read in the component via `useLocale()` from `next-intl` and passed into the comparator factory so Cyrillic and Latin strings sort correctly.
- **Date** (`joinedAt`): numeric comparison via `getTime()`.
- For `desc`, the comparator result is negated.
- Archived organizations are sorted inline with the rest. The existing pink styling visually distinguishes them.

## Components and Files

### New files

- `src/app/[locale]/home/SortPills.tsx` — small reusable pill-row component.
- `src/app/[locale]/home/sortOrganizations.ts` — pure comparator factory for each list type.
- `src/app/[locale]/home/usePersistedSort.ts` — custom hook for localStorage-backed sort state.
- `src/app/[locale]/home/sortOrganizations.test.ts` — comparator tests.
- `src/app/[locale]/home/usePersistedSort.test.ts` — hook tests.

### Modified files

- `src/app/[locale]/home/UserOrganizationsList.tsx`
  - Three `usePersistedSort` calls (one per section).
  - Apply comparator to each list before rendering.
  - Render `<SortPills />` next to each section heading.
- `messages/en.json` and `messages/ru.json` — add localization keys.

### Component shape

```tsx
type SortField = string;
type SortDirection = 'asc' | 'desc';

interface SortPillsProps {
  fields: { value: SortField; label: string }[];
  active: { field: SortField; direction: SortDirection };
  onChange: (next: { field: SortField; direction: SortDirection }) => void;
}
```

### Hook shape

```ts
function usePersistedSort<F extends string>(
  storageKey: string,
  allowedFields: readonly F[],
  defaultValue: { field: F; direction: SortDirection }
): [
  { field: F; direction: SortDirection },
  (next: { field: F; direction: SortDirection }) => void,
];
```

The hook hydrates from `localStorage` after mount (avoids SSR mismatch), validates the stored value against `allowedFields`, and writes back on any change.

## Localization

New keys in `messages/en.json` and `messages/ru.json` under `home.sort`:

| Key                        | EN           | RU              |
| -------------------------- | ------------ | --------------- |
| `home.sort.byName`         | Name         | Имя             |
| `home.sort.byJoined`       | Joined       | Дата вступления |
| `home.sort.byOrganization` | Organization | Организация     |

Direction is shown via unicode arrow icons (`↑` / `↓`) — no translation needed.

## Testing (TDD)

Per project rules, no integration tests. Unit tests only.

### `sortOrganizations.test.ts`

- Sort member orgs by `name` ascending — alphabetical order.
- Sort member orgs by `name` descending — reverse alphabetical.
- Sort member orgs by `joinedAt` ascending — oldest first.
- Sort member orgs by `joinedAt` descending — newest first.
- Locale-aware: Cyrillic strings sort correctly.
- Stable sort: equal-name items preserve insertion order.
- Sort external boards by `organizationName` ascending and descending.

### `usePersistedSort.test.ts`

- On mount with empty localStorage → returns default value.
- On mount with valid stored value → returns stored value.
- On mount with invalid JSON → returns default.
- On mount with stored field not in allowedFields → returns default.
- On change → writes new value to localStorage.
- On change → updates returned value.

## Out of Scope

- Server-side sorting (data is small; client-side is fine).
- Cross-section "sync" sorting (each section is independent by design).
- Per-field "remember last direction" (user explicitly chose: switching field always resets to asc).
- Pinning archived orgs to bottom (user explicitly chose inline).

## Unresolved Questions

None remaining at design time.
