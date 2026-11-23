# Protocol Signers Phone Sharing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each willing signer's phone number to poll admins in the protocol report (on-screen + PDF), and reword the voting consent so it covers phone sharing.

**Architecture:** No schema change. `PollParticipant.willingToSignProtocol` (`Boolean?`) already carries the consent. The application layer attaches `phoneNumber` to `ProtocolSignWillingnessEntry` — but **only for participants who answered `true`** — and the three existing admin gates carry it the rest of the way. Four layers change in dependency order: messages → use case → PDF → web UI.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma/PostgreSQL, next-intl, pdfmake, Vitest, Tailwind + Catalyst.

**Spec:** `readmes/2026-08-06-protocol-signers-phone-design.md`

## Global Constraints

- **NEVER `git commit`.** Project rule (`CLAUDE.md`). Every task ends with `git add` only — the user commits.
- **Ask for confirmation before any file edit, write, or filesystem-modifying command.** Project rule.
- TDD: write the failing test, watch it fail, implement minimally, watch it pass.
- Test runner is Vitest. Full suite: `yarn test`. Single file: `yarn test <path>`. Single case: `yarn test <path> -t "<name>"`.
- Every localized string lives in **both** `messages/en.json` and `messages/ru.json`. Russian is the default locale.
- Phone renders exactly as stored — E.164, e.g. `+79161234567`. No reformatting.
- Clickable `<a>`/`<button>` elements that don't get pointer styling from a Catalyst component MUST carry `cursor-pointer` (Tailwind v4 default is `default`).
- Do not touch `allowFindByPhone` — unrelated consent.
- Do not remove existing comments during these edits.

## File Structure

| File                                                             | Responsibility                                      | Task |
| ---------------------------------------------------------------- | --------------------------------------------------- | ---- |
| `messages/en.json`, `messages/ru.json`                           | Consent + report copy, new `columnPhone` label      | 1    |
| `src/i18n/__tests__/protocolMessages.test.ts` _(create)_         | Guards en/ru key parity for the protocol block      | 1    |
| `src/application/poll/GetPollResultsUseCase.ts`                  | Attaches phone to willing entries only; admin-gated | 2    |
| `src/application/poll/__tests__/GetPollResultsUseCase.test.ts`   | Phone present/absent/leak-proof                     | 2    |
| `src/web/lib/pdf/protocolSignersPdfGenerator.ts`                 | Phone column in the ready-to-sign table only        | 3    |
| `src/web/lib/pdf/protocolSignersPdfGenerator.test.ts` _(create)_ | Column shape per section                            | 3    |
| `src/app/api/polls/[pollId]/results/protocol-pdf/route.ts`       | Passes phone into the PDF data                      | 3    |
| `src/app/[locale]/polls/[pollId]/results/page.tsx`               | Serializes phone inside the `canViewVoters` gate    | 4    |
| `src/web/components/polls/results/PollResults.tsx`               | Renders phone as a `tel:` link in the ready list    | 4    |

**Note on test placement:** the spec said `src/web/lib/pdf/__tests__/`. The actual local convention is **co-located** — `src/web/lib/pdf/pollResultsPdfGenerator.test.ts` sits beside its source. Follow the local convention; no `__tests__/` dir under `src/web/lib/pdf/`.

**Task order matters:** Task 3 consumes `columnPhone` from Task 1, and Tasks 3–4 consume `phoneNumber` from Task 2.

---

### Task 1: Consent and report copy (en/ru) — ✅ COMPLETE

**Files:**

- Modify: `messages/en.json` (`poll.voting` ~762-763, `poll.results` ~838-839, `poll.results.protocolPdf` ~880-892)
- Modify: `messages/ru.json` (same paths)
- Test: `src/i18n/__tests__/protocolMessages.test.ts` _(create)_

**Interfaces:**

- Consumes: nothing.
- Produces: `poll.results.protocolPdf.columnPhone` (string) — Task 3 reads it as `t.columnPhone`. Reworded `poll.voting.willingToSignProtocolTitle` / `...Description`, `poll.results.willingToSignProtocol`, `poll.results.protocolNotWilling`.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/__tests__/protocolMessages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadMessages(locale: string): Record<string, any> {
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'messages', `${locale}.json`),
      'utf-8'
    )
  );
}

const en = loadMessages('en');
const ru = loadMessages('ru');

describe('protocol signing messages', () => {
  it('protocolPdf block has identical keys in en and ru', () => {
    expect(Object.keys(en.poll.results.protocolPdf).sort()).toEqual(
      Object.keys(ru.poll.results.protocolPdf).sort()
    );
  });

  it('protocolPdf defines a phone column label in both locales', () => {
    expect(en.poll.results.protocolPdf.columnPhone).toBeTruthy();
    expect(ru.poll.results.protocolPdf.columnPhone).toBeTruthy();
  });

  it('voting consent copy names the phone number in both locales', () => {
    expect(en.poll.voting.willingToSignProtocolTitle).toMatch(/phone number/i);
    expect(ru.poll.voting.willingToSignProtocolTitle).toMatch(/телефон/i);
    expect(en.poll.voting.willingToSignProtocolDescription).toMatch(
      /phone number/i
    );
    expect(ru.poll.voting.willingToSignProtocolDescription).toMatch(/телефон/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/i18n/__tests__/protocolMessages.test.ts`
Expected: FAIL — `columnPhone` is `undefined`, and the title regexes don't match the current copy.

- [ ] **Step 3: Reword `messages/en.json`**

Under `poll.voting`, replace:

```json
      "willingToSignProtocolTitle": "Willing to sign the final protocol",
      "willingToSignProtocolDescription": "By enabling this, you confirm willingness to sign the final protocol of this vote",
```

with:

```json
      "willingToSignProtocolTitle": "Willing to sign the protocol and share my phone number for contact",
      "willingToSignProtocolDescription": "I confirm my willingness to sign the final protocol of this vote and allow organization admins to see my phone number so they can contact me",
```

Under `poll.results`, replace:

```json
      "willingToSignProtocol": "Willing to sign",
      "protocolNotWilling": "Not willing to sign",
```

with:

```json
      "willingToSignProtocol": "Willing to sign and share phone",
      "protocolNotWilling": "Not willing to sign",
```

Under `poll.results.protocolPdf`, replace:

```json
        "columnFullName": "Full Name",
```

with:

```json
        "columnFullName": "Full Name",
        "columnPhone": "Phone",
```

Leave `willingSection`, `notWillingSection`, `protocolSignWillingness`, `willingToSignProtocolCount`, `protocolNotWillingCount`, `title`, `pageOf`, `generatedOn` untouched. English keeps "willing" throughout — it is the direct counterpart of Russian "готов", so the two locales already agree.

- [ ] **Step 4: Reword `messages/ru.json`**

Under `poll.voting`, replace:

```json
      "willingToSignProtocolTitle": "Готов подписать финальный протокол",
      "willingToSignProtocolDescription": "Включая это, вы подтверждаете готовность подписать финальный протокол данного голосования",
```

with:

```json
      "willingToSignProtocolTitle": "Готов подписать протокол и поделиться номером телефона для связи",
      "willingToSignProtocolDescription": "Подтверждаю готовность подписать финальный протокол данного голосования и разрешаю администраторам видеть мой номер телефона для связи",
```

Under `poll.results`, replace:

```json
      "willingToSignProtocol": "Готовы подписать",
```

with:

```json
      "willingToSignProtocol": "Готовы подписать и поделиться телефоном",
```

`protocolNotWilling` already reads `"Не готовы подписать"` — leave it.

Under `poll.results.protocolPdf`, replace:

```json
        "columnFullName": "ФИО",
```

with:

```json
        "columnFullName": "ФИО",
        "columnPhone": "Телефон",
```

`willingSection` already reads `"ГОТОВЫ ПОДПИСАТЬ"` — leave it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test src/i18n/__tests__/protocolMessages.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Stage (do NOT commit)**

```bash
git add messages/en.json messages/ru.json src/i18n/__tests__/protocolMessages.test.ts
```

---

### Task 2: Attach phone to willing entries in the use case — ✅ COMPLETE

**Files:**

- Modify: `src/application/poll/GetPollResultsUseCase.ts:48-54` (interface), `:281-291` (mapping)
- Test: `src/application/poll/__tests__/GetPollResultsUseCase.test.ts:487` (extend existing cases)

**Interfaces:**

- Consumes: `User.phoneNumber` — a `PhoneNumber` value object with `.getValue(): string`. `userRepository.findByIds` already returns full `User` entities in this use case, so no extra query.
- Produces: `ProtocolSignWillingnessEntry.phoneNumber: string | null` — non-null only when `willingToSignProtocol === true`. Tasks 3 and 4 both read it.

- [ ] **Step 1: Write the failing tests**

In `src/application/poll/__tests__/GetPollResultsUseCase.test.ts`, extend the existing case `'should include protocolSignWillingness for admin with voted participants'`. It already stubs `findByIds` with Alice (`+79001234567`, willing) and Bob (`+79007654321`, not willing). Add these assertions inside its `if (result.success) {` block, after the existing `expect(notWilling?.middleName).toBeNull();`:

```typescript
// Consent is combined — willing means "sign AND share my phone".
expect(willing?.phoneNumber).toBe('+79001234567');
// Declining covers both halves, so no phone for the not-willing.
expect(notWilling?.phoneNumber).toBeNull();
```

Then add a new case immediately after that test, guarding the leak path:

```typescript
it('should not expose any phone number to a non-admin', async () => {
  participant1.setWillingToSignProtocol(true);
  organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
  organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

  const result = await useCase.execute({
    pollId: 'poll-1',
    userId: 'user-member',
  });

  expect(result.success).toBe(true);

  if (result.success) {
    expect(result.value.protocolSignWillingness).toHaveLength(0);
    expect(JSON.stringify(result.value)).not.toContain('+7900');
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/application/poll/__tests__/GetPollResultsUseCase.test.ts`
Expected: FAIL — `willing?.phoneNumber` is `undefined`, not `'+79001234567'`. (The non-admin case should already pass; it locks in behavior against regression from this task's change.)

- [ ] **Step 3: Add `phoneNumber` to the interface**

In `src/application/poll/GetPollResultsUseCase.ts`, replace:

```typescript
export interface ProtocolSignWillingnessEntry {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
}
```

with:

```typescript
export interface ProtocolSignWillingnessEntry {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
  // Non-null only when willingToSignProtocol is true — the voter consented to
  // signing and to sharing their phone as a single combined statement.
  phoneNumber: string | null;
}
```

- [ ] **Step 4: Populate it in the mapping**

In the same file, inside the `if (isAdmin)` block, replace:

```typescript
protocolSignWillingness = votedParticipants.map((p) => {
  const user = users?.find((u) => u.id === p.userId);

  return {
    userId: p.userId,
    firstName: user?.firstName ?? 'Unknown',
    lastName: user?.lastName ?? 'Unknown',
    middleName: user?.middleName ?? null,
    willingToSignProtocol: p.willingToSignProtocol!,
  };
});
```

with:

```typescript
protocolSignWillingness = votedParticipants.map((p) => {
  const user = users?.find((u) => u.id === p.userId);
  const isWilling = p.willingToSignProtocol!;

  return {
    userId: p.userId,
    firstName: user?.firstName ?? 'Unknown',
    lastName: user?.lastName ?? 'Unknown',
    middleName: user?.middleName ?? null,
    willingToSignProtocol: isWilling,
    // Someone who declined refused the whole combined consent, so their
    // number stays hidden even though we hold it.
    phoneNumber: isWilling ? (user?.phoneNumber.getValue() ?? null) : null,
  };
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test src/application/poll/__tests__/GetPollResultsUseCase.test.ts`
Expected: PASS — all cases in the file, including the two new assertions and the new non-admin leak test.

- [ ] **Step 6: Typecheck**

Run: `yarn typecheck`
Expected: clean. The two downstream files (`protocol-pdf/route.ts`, `results/page.tsx`) only _read_ from `ProtocolSignWillingnessEntry` and build differently-typed objects, so widening the interface does not break them yet. If anything errors here, stop and investigate.

- [ ] **Step 7: Stage (do NOT commit)**

```bash
git add src/application/poll/GetPollResultsUseCase.ts src/application/poll/__tests__/GetPollResultsUseCase.test.ts
```

---

### Task 3: Phone column in the PDF — ✅ COMPLETE

**Files:**

- Modify: `src/web/lib/pdf/protocolSignersPdfGenerator.ts`
- Modify: `src/app/api/polls/[pollId]/results/protocol-pdf/route.ts:117-122`
- Test: `src/web/lib/pdf/protocolSignersPdfGenerator.test.ts` _(create, co-located)_

**Interfaces:**

- Consumes: `ProtocolSignWillingnessEntry.phoneNumber` (Task 2), `t.columnPhone` (Task 1).
- Produces: `ProtocolSignerEntry.phoneNumber: string | null`, `ProtocolSignersPdfTranslations.columnPhone: string`. Nothing downstream depends on these.

- [ ] **Step 1: Write the failing test**

Create `src/web/lib/pdf/protocolSignersPdfGenerator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildProtocolSignersPdfDefinition,
  ProtocolSignersPdfData,
  ProtocolSignersPdfTranslations,
} from './protocolSignersPdfGenerator';

const t: ProtocolSignersPdfTranslations = {
  title: 'PROTOCOL SIGNING WILLINGNESS',
  organization: 'Organization',
  board: 'Board',
  pollName: 'Poll',
  willingSection: 'READY TO SIGN',
  notWillingSection: 'NOT WILLING TO SIGN',
  columnNumber: '#',
  columnFullName: 'Full Name',
  columnPhone: 'Phone',
  pageOf: 'Page {current} of {total}',
  generatedOn: 'Generated: {date}',
};

function makeData(
  overrides: Partial<ProtocolSignersPdfData> = {}
): ProtocolSignersPdfData {
  return {
    organizationName: 'Test Org',
    boardName: null,
    pollTitle: 'Annual Vote',
    entries: [
      {
        firstName: 'Alice',
        lastName: 'Smith',
        middleName: null,
        willingToSignProtocol: true,
        phoneNumber: '+79001234567',
      },
      {
        firstName: 'Bob',
        lastName: 'Johnson',
        middleName: null,
        willingToSignProtocol: false,
        phoneNumber: null,
      },
    ],
    ...overrides,
  };
}

// The two section tables are the only `table` nodes in the document, in order:
// ready-to-sign first, then not-ready.
function findTables(content: any): any[] {
  const tables: any[] = [];

  const walk = (node: any) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (node && typeof node === 'object') {
      if (node.table) {
        tables.push(node.table);
      }

      if (node.stack) {
        walk(node.stack);
      }
    }
  };

  walk(content);

  return tables;
}

describe('buildProtocolSignersPdfDefinition', () => {
  it('ready-to-sign table has a phone column with the localized header', () => {
    const doc = buildProtocolSignersPdfDefinition(makeData(), t);
    const [readyTable] = findTables(doc.content);

    expect(readyTable.body[0]).toHaveLength(3);
    expect(JSON.stringify(readyTable.body[0])).toContain('Phone');
    expect(JSON.stringify(readyTable.body[1])).toContain('+79001234567');
  });

  it('not-ready table has no phone column and no phone data', () => {
    const doc = buildProtocolSignersPdfDefinition(makeData(), t);
    const [, notReadyTable] = findTables(doc.content);

    expect(notReadyTable.body[0]).toHaveLength(2);
    expect(JSON.stringify(notReadyTable)).not.toContain('Phone');
    expect(JSON.stringify(notReadyTable)).not.toContain('+7');
    expect(JSON.stringify(notReadyTable)).toContain('Johnson');
  });

  it('never prints a phone for someone who declined, even if one is set', () => {
    const doc = buildProtocolSignersPdfDefinition(
      makeData({
        entries: [
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            middleName: null,
            willingToSignProtocol: false,
            phoneNumber: '+79007654321',
          },
        ],
      }),
      t
    );

    expect(JSON.stringify(doc.content)).not.toContain('+79007654321');
  });

  it('renders an empty ready section without a table when nobody is willing', () => {
    const doc = buildProtocolSignersPdfDefinition(
      makeData({
        entries: [
          {
            firstName: 'Bob',
            lastName: 'Johnson',
            middleName: null,
            willingToSignProtocol: false,
            phoneNumber: null,
          },
        ],
      }),
      t
    );

    expect(findTables(doc.content)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/web/lib/pdf/protocolSignersPdfGenerator.test.ts`
Expected: FAIL on the first test — `expect(readyTable.body[0]).toHaveLength(3)` gets 2, because there is no phone column yet.

Note: Vitest strips types via esbuild without checking them, so the unknown `columnPhone` / `phoneNumber` properties will _not_ fail the run on their own — the assertion is what fails. `yarn typecheck` in Step 8 is what catches type drift.

- [ ] **Step 3: Extend the two interfaces**

In `src/web/lib/pdf/protocolSignersPdfGenerator.ts`, replace:

```typescript
export interface ProtocolSignerEntry {
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
}
```

with:

```typescript
export interface ProtocolSignerEntry {
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
  phoneNumber: string | null;
}
```

and add `columnPhone` to the translations interface, replacing:

```typescript
columnNumber: string;
columnFullName: string;
```

with:

```typescript
columnNumber: string;
columnFullName: string;
columnPhone: string;
```

- [ ] **Step 4: Make the table shape conditional**

Replace the whole `buildSignersTable` function with:

```typescript
function buildSignersTable(
  entries: ProtocolSignerEntry[],
  sectionTitle: string,
  t: ProtocolSignersPdfTranslations,
  showPhone: boolean
): Content {
  if (entries.length === 0) {
    return { text: '' };
  }

  const tableHeader = [
    {
      text: t.columnNumber,
      style: 'tableHeader',
      alignment: 'center' as const,
    },
    { text: t.columnFullName, style: 'tableHeader' },
  ];

  if (showPhone) {
    tableHeader.push({ text: t.columnPhone, style: 'tableHeader' });
  }

  const tableRows = entries.map((entry, i) => {
    const row = [
      { text: String(i + 1), alignment: 'center' as const },
      { text: formatFullName(entry) },
    ];

    if (showPhone) {
      row.push({ text: entry.phoneNumber ?? '' });
    }

    return row;
  });

  const widths: (string | number)[] = showPhone ? [30, '*', 110] : [30, '*'];

  return {
    stack: [
      {
        text: sectionTitle,
        style: 'subheader',
        margin: [0, 0, 0, 8] as [number, number, number, number],
      },
      {
        table: {
          headerRows: 1,
          widths,
          body: [tableHeader, ...tableRows],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
    ],
  };
}
```

- [ ] **Step 5: Pass the flag at both call sites**

Replace:

```typescript
// Willing table
const willing = data.entries.filter((e) => e.willingToSignProtocol);
content.push(buildSignersTable(willing, t.willingSection, t));

// Not willing table
const notWilling = data.entries.filter((e) => !e.willingToSignProtocol);
content.push(buildSignersTable(notWilling, t.notWillingSection, t));
```

with:

```typescript
// Willing table — phones shown, since these voters consented to sharing them
const willing = data.entries.filter((e) => e.willingToSignProtocol);
content.push(buildSignersTable(willing, t.willingSection, t, true));

// Not willing table — names only, no phone column
const notWilling = data.entries.filter((e) => !e.willingToSignProtocol);
content.push(buildSignersTable(notWilling, t.notWillingSection, t, false));
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn test src/web/lib/pdf/protocolSignersPdfGenerator.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Feed the phone through the PDF route**

In `src/app/api/polls/[pollId]/results/protocol-pdf/route.ts`, replace:

```typescript
        entries: protocolSignWillingness.map((entry) => ({
          firstName: entry.firstName,
          lastName: entry.lastName,
          middleName: entry.middleName,
          willingToSignProtocol: entry.willingToSignProtocol,
        })),
```

with:

```typescript
        entries: protocolSignWillingness.map((entry) => ({
          firstName: entry.firstName,
          lastName: entry.lastName,
          middleName: entry.middleName,
          willingToSignProtocol: entry.willingToSignProtocol,
          phoneNumber: entry.phoneNumber,
        })),
```

No other change here — the route already returns 403 unless `canViewVoters`.

- [ ] **Step 8: Typecheck**

Run: `yarn typecheck`
Expected: clean. `route.ts` now supplies the newly-required `phoneNumber`, and `results/page.tsx` does not yet require it.

- [ ] **Step 9: Stage (do NOT commit)**

```bash
git add src/web/lib/pdf/protocolSignersPdfGenerator.ts src/web/lib/pdf/protocolSignersPdfGenerator.test.ts "src/app/api/polls/[pollId]/results/protocol-pdf/route.ts"
```

---

### Task 4: Phone in the on-screen report — ✅ COMPLETE

**Files:**

- Modify: `src/app/[locale]/polls/[pollId]/results/page.tsx:198-208`
- Modify: `src/web/components/polls/results/PollResults.tsx:36-42` (local interface), `:336-350` (willing list)

**Interfaces:**

- Consumes: `ProtocolSignWillingnessEntry.phoneNumber` (Task 2).
- Produces: nothing downstream.

**Security note:** `PollResults.tsx` is a Client Component. The phone must stay inside the existing `canViewVoters ? … : []` ternary in `page.tsx` — that is the only thing keeping it off a non-admin's wire. Do not hoist it out.

- [ ] **Step 1: Serialize the phone inside the permission gate**

In `src/app/[locale]/polls/[pollId]/results/page.tsx`, replace:

```typescript
(entry: ProtocolSignWillingnessEntry) => ({
  userId: entry.userId,
  firstName: entry.firstName,
  lastName: entry.lastName,
  middleName: entry.middleName,
  willingToSignProtocol: entry.willingToSignProtocol,
});
```

with:

```typescript
(entry: ProtocolSignWillingnessEntry) => ({
  userId: entry.userId,
  firstName: entry.firstName,
  lastName: entry.lastName,
  middleName: entry.middleName,
  willingToSignProtocol: entry.willingToSignProtocol,
  phoneNumber: entry.phoneNumber,
});
```

The surrounding `canViewVoters ? … : []` and its `// SECURITY:` comment stay exactly as they are.

- [ ] **Step 2: Widen the client-side interface**

In `src/web/components/polls/results/PollResults.tsx`, replace:

```typescript
interface ProtocolSignWillingnessEntry {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
}
```

with:

```typescript
interface ProtocolSignWillingnessEntry {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
  // Server sends this only for admins, and only for willing participants.
  phoneNumber: string | null;
}
```

- [ ] **Step 3: Render the phone in the willing list**

In the same file, in the willing-section `.map((p) => (…))`, replace:

```tsx
<li key={p.userId} className="text-sm text-zinc-700 dark:text-zinc-300">
  {User.formatFullName(p.firstName, p.lastName, p.middleName)}
</li>
```

with:

```tsx
<li
  key={p.userId}
  className="flex flex-wrap items-baseline gap-x-2 text-sm text-zinc-700 dark:text-zinc-300"
>
  <span>{User.formatFullName(p.firstName, p.lastName, p.middleName)}</span>
  {p.phoneNumber && (
    <a
      href={`tel:${p.phoneNumber}`}
      className="cursor-pointer text-zinc-500 hover:underline dark:text-zinc-400"
    >
      {p.phoneNumber}
    </a>
  )}
</li>
```

`flex flex-wrap` keeps the number beside the name on wide screens and wraps it underneath on a phone. Leave the **not-willing** `.map` untouched — it stays name-only.

- [ ] **Step 4: Typecheck and run the full suite**

Run: `yarn tsc --noEmit`
Expected: clean, no errors.

Run: `yarn test`
Expected: PASS — whole suite green.

- [ ] **Step 5: Lint and format**

Run: `yarn lint`
Expected: no new errors.

- [ ] **Step 6: Stage (do NOT commit)**

```bash
git add "src/app/[locale]/polls/[pollId]/results/page.tsx" src/web/components/polls/results/PollResults.tsx
```

---

## Manual verification (after Task 4)

Run `yarn dev`, then as an org admin:

1. Vote in a poll — confirm the toggle label reads the new combined wording and is still pre-enabled (intended).
2. Finish voting with the toggle **on**, open the poll's results → "Protocol Sign Willingness" → confirm your name shows with a tappable phone number.
3. Vote in another poll with the toggle **off** → confirm you appear under "Not ready to sign" with **no** phone.
4. Click "Export protocol PDF" → confirm the ready section has a Phone column and the not-ready section has only # and Full Name.
5. Switch locale to Russian → repeat 1 and 4, confirm no untranslated keys appear.
6. As a **non-admin member** of the same org, open the results page, and check DevTools → the RSC payload must contain no `+7…` string.

## Out of scope

- Splitting the combined consent into two independent toggles.
- Any change to `allowFindByPhone` or the privacy-setup flow.
- Exporting phones anywhere outside this report.
- Backfill or migration — deliberately none; see the spec's decision table.
