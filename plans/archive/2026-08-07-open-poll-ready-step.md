# Open Poll READY Step Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For open polls (`pollType = 'OPEN'`), the DRAFT step reads "Mark as ready" instead of the inaccurate "Freeze participants", and pre-ACTIVE open polls stop offering a participants page that is always empty.

**Architecture:** Presentation-only. The `DRAFT → READY → ACTIVE → FINISHED` machine, all use cases, and all server actions are untouched. A new pure module `pollControlLabels.ts` decides which translation keys and which affordances apply for a given `(isOpenPoll, state)` pair; `PollControls` and `PollCard` both consume it, which also removes the label logic they duplicate today.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, next-intl, Tailwind + Catalyst components, vitest (`environment: 'node'`), yarn.

**Spec:** `readmes/2026-08-07-open-poll-ready-step-design.md`

## Global Constraints

- **Never run `git commit`.** `git add` is allowed. Each task ends by staging; the user commits.
- **TDD.** Write the failing test, run it, watch it fail, then implement. Never write implementation first.
- Run tests with `yarn test` (vitest, single run). A single file: `yarn test <path>`.
- **No new dependencies.** There is no jsdom and no `@testing-library/react`; vitest runs `environment: 'node'` (`vitest.config.ts:31`). Do not add them and do not write render tests.
- All user-facing strings come from `messages/en.json` and `messages/ru.json`. Never hardcode a string in a component. Every key added to one locale must be added to the other.
- Both components call `useTranslations('poll')`, so every key produced by `pollControlLabels.ts` is relative to the `poll` namespace (e.g. `'type.markReady'`, not `'poll.type.markReady'`).
- Existing `poll.takeSnapshot` / `poll.discardSnapshot` key families stay — organization polls still use them.
- Formatting: `yarn lf` (eslint --fix + prettier) before staging.
- Russian is the default app language; RU copy is not optional.

---

### Task 1: Translation keys

Adds the open-poll copy to both locales and deletes one dead key. No component reads these yet — Task 2 introduces the module that names them, Task 3/4 wire them in.

**Files:**

- Modify: `messages/en.json` (`poll.type` object; `poll.confirmTakeSnapshotDescription`)
- Modify: `messages/ru.json` (same two places)
- Create: `src/i18n/__tests__/openPollMessages.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: keys `poll.type.markReady`, `poll.type.markingReady`, `poll.type.markedReady`, `poll.type.confirmMarkReady`, `poll.type.backToDraft`, `poll.type.returningToDraft`, `poll.type.returnedToDraft`, `poll.type.confirmBackToDraft`, `poll.type.readyHint` in both locales. Removes `poll.confirmTakeSnapshotDescription` from both.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/__tests__/openPollMessages.test.ts`. This follows the existing pattern in `src/i18n/__tests__/protocolMessages.test.ts` — read the JSON files from disk and assert on their shape.

```ts
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

const OPEN_POLL_CONTROL_KEYS = [
  'markReady',
  'markingReady',
  'markedReady',
  'confirmMarkReady',
  'backToDraft',
  'returningToDraft',
  'returnedToDraft',
  'confirmBackToDraft',
  'readyHint',
];

describe('open poll control messages', () => {
  it('poll.type block has identical keys in en and ru', () => {
    expect(Object.keys(en.poll.type).sort()).toEqual(
      Object.keys(ru.poll.type).sort()
    );
  });

  it.each(OPEN_POLL_CONTROL_KEYS)(
    'defines poll.type.%s in both locales',
    (key) => {
      expect(en.poll.type[key]).toBeTruthy();
      expect(ru.poll.type[key]).toBeTruthy();
    }
  );

  it('keeps the organization-poll snapshot copy untouched', () => {
    expect(en.poll.takeSnapshot).toBe('Freeze participants');
    expect(ru.poll.takeSnapshot).toBe('Зафиксировать участников');
  });

  it('drops the unused confirmTakeSnapshotDescription key', () => {
    expect(en.poll.confirmTakeSnapshotDescription).toBeUndefined();
    expect(ru.poll.confirmTakeSnapshotDescription).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/i18n/__tests__/openPollMessages.test.ts`

Expected: FAIL — the nine `poll.type.*` assertions fail because those keys do not exist, and the `confirmTakeSnapshotDescription` assertion fails because the key is still present in both files.

- [ ] **Step 3: Add the keys to `messages/en.json`**

Inside the existing `poll.type` object (it currently ends with `"copyLinkError": "Could not copy the link"`), append:

```json
    "markReady": "Mark as ready",
    "markingReady": "Marking as ready...",
    "markedReady": "Poll marked as ready",
    "confirmMarkReady": "Mark this poll ready to activate?",
    "backToDraft": "Back to draft",
    "returningToDraft": "Returning to draft...",
    "returnedToDraft": "Poll returned to draft",
    "confirmBackToDraft": "Return this poll to draft?",
    "readyHint": "Anyone verified can vote — no participant list."
```

Then delete this line from the `poll` object (around `messages/en.json:717`):

```json
    "confirmTakeSnapshotDescription": "This will freeze the participant list. You can still modify participants before activating.",
```

- [ ] **Step 4: Add the keys to `messages/ru.json`**

Inside the existing `poll.type` object, append:

```json
    "markReady": "Отметить готовым",
    "markingReady": "Отмечаем...",
    "markedReady": "Голосование отмечено готовым",
    "confirmMarkReady": "Отметить голосование готовым к активации?",
    "backToDraft": "Вернуть в черновик",
    "returningToDraft": "Возврат в черновик...",
    "returnedToDraft": "Голосование возвращено в черновик",
    "confirmBackToDraft": "Вернуть голосование в черновик?",
    "readyHint": "Голосовать может любой подтверждённый пользователь — списка участников нет."
```

Then delete this line from the `poll` object (around `messages/ru.json:717`):

```json
    "confirmTakeSnapshotDescription": "Это зафиксирует список участников. Вы всё ещё сможете изменить участников до активации.",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/i18n/__tests__/openPollMessages.test.ts`

Expected: PASS, all assertions.

- [ ] **Step 6: Verify nothing else referenced the deleted key**

Run: `grep -rn "confirmTakeSnapshotDescription" src messages`

Expected: no output. (It was already dead — only `confirmTakeSnapshot` is used, in `PollCard.tsx:60`.) If this prints anything from `src/`, stop: the key was in use and the deletion must be reverted.

- [ ] **Step 7: Format and stage**

```bash
yarn lf
git add messages/en.json messages/ru.json src/i18n/__tests__/openPollMessages.test.ts
```

---

### Task 2: `pollControlLabels` module

The single source of truth for the open-vs-organization branch. Pure functions, no React, no i18n runtime — just key names and booleans, which is what makes it testable under `environment: 'node'`.

**Files:**

- Create: `src/web/components/polls/pollControlLabels.ts`
- Create: `src/web/components/polls/__tests__/pollControlLabels.test.ts`

**Interfaces:**

- Consumes: `PollState` from `@/domain/poll/PollState` (enum with `DRAFT`, `READY`, `ACTIVE`, `FINISHED` string values); translation keys added in Task 1.
- Produces:
  - `interface PollControlLabelKeys { prepare, preparing, prepared, confirmPrepare, revert, reverting, reverted, confirmRevert }` — all `string`
  - `getPollControlLabelKeys(isOpenPoll: boolean): PollControlLabelKeys`
  - `shouldShowReadyHint(isOpenPoll: boolean, state: string): boolean`
  - `shouldShowManageParticipants(isOpenPoll: boolean, state: string): boolean`

  Tasks 3 and 4 import all four.

- [ ] **Step 1: Write the failing test**

Create `src/web/components/polls/__tests__/pollControlLabels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PollState } from '@/domain/poll/PollState';
import {
  getPollControlLabelKeys,
  shouldShowReadyHint,
  shouldShowManageParticipants,
} from '../pollControlLabels';

describe('getPollControlLabelKeys', () => {
  it('gives organization polls the participant-snapshot vocabulary', () => {
    expect(getPollControlLabelKeys(false)).toEqual({
      prepare: 'takeSnapshot',
      preparing: 'takingSnapshot',
      prepared: 'snapshotTaken',
      confirmPrepare: 'confirmTakeSnapshot',
      revert: 'discardSnapshot',
      reverting: 'discardingSnapshot',
      reverted: 'snapshotDiscarded',
      confirmRevert: 'confirmDiscardSnapshot',
    });
  });

  it('gives open polls the ready/draft vocabulary', () => {
    expect(getPollControlLabelKeys(true)).toEqual({
      prepare: 'type.markReady',
      preparing: 'type.markingReady',
      prepared: 'type.markedReady',
      confirmPrepare: 'type.confirmMarkReady',
      revert: 'type.backToDraft',
      reverting: 'type.returningToDraft',
      reverted: 'type.returnedToDraft',
      confirmRevert: 'type.confirmBackToDraft',
    });
  });
});

describe('shouldShowReadyHint', () => {
  it('shows the hint for an open poll waiting in READY', () => {
    expect(shouldShowReadyHint(true, PollState.READY)).toBe(true);
  });

  it('hides the hint in every other open-poll state', () => {
    expect(shouldShowReadyHint(true, PollState.DRAFT)).toBe(false);
    expect(shouldShowReadyHint(true, PollState.ACTIVE)).toBe(false);
    expect(shouldShowReadyHint(true, PollState.FINISHED)).toBe(false);
  });

  it('never shows the hint for an organization poll', () => {
    expect(shouldShowReadyHint(false, PollState.READY)).toBe(false);
  });
});

describe('shouldShowManageParticipants', () => {
  it('always offers the page for organization polls', () => {
    for (const state of [
      PollState.DRAFT,
      PollState.READY,
      PollState.ACTIVE,
      PollState.FINISHED,
    ]) {
      expect(shouldShowManageParticipants(false, state)).toBe(true);
    }
  });

  it('hides the page for an open poll that cannot have voters yet', () => {
    expect(shouldShowManageParticipants(true, PollState.DRAFT)).toBe(false);
    expect(shouldShowManageParticipants(true, PollState.READY)).toBe(false);
  });

  it('offers the page once an open poll can accumulate voters', () => {
    expect(shouldShowManageParticipants(true, PollState.ACTIVE)).toBe(true);
    expect(shouldShowManageParticipants(true, PollState.FINISHED)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/web/components/polls/__tests__/pollControlLabels.test.ts`

Expected: FAIL — cannot resolve `../pollControlLabels`.

- [ ] **Step 3: Write the implementation**

Create `src/web/components/polls/pollControlLabels.ts`:

```ts
import { PollState } from '@/domain/poll/PollState';

/**
 * Translation keys for the two admin buttons that move a poll between DRAFT
 * and READY. Keys are relative to the `poll` namespace, which is what both
 * PollControls and PollCard pass to useTranslations.
 *
 * The two poll types name the same transition differently because it means
 * different things. An organization poll really does freeze an electorate
 * here. An open poll has none — every verified user may vote — so for it the
 * step only means "validated and awaiting activation".
 */
export interface PollControlLabelKeys {
  prepare: string;
  preparing: string;
  prepared: string;
  confirmPrepare: string;
  revert: string;
  reverting: string;
  reverted: string;
  confirmRevert: string;
}

const ORGANIZATION_KEYS: PollControlLabelKeys = {
  prepare: 'takeSnapshot',
  preparing: 'takingSnapshot',
  prepared: 'snapshotTaken',
  confirmPrepare: 'confirmTakeSnapshot',
  revert: 'discardSnapshot',
  reverting: 'discardingSnapshot',
  reverted: 'snapshotDiscarded',
  confirmRevert: 'confirmDiscardSnapshot',
};

const OPEN_KEYS: PollControlLabelKeys = {
  prepare: 'type.markReady',
  preparing: 'type.markingReady',
  prepared: 'type.markedReady',
  confirmPrepare: 'type.confirmMarkReady',
  revert: 'type.backToDraft',
  reverting: 'type.returningToDraft',
  reverted: 'type.returnedToDraft',
  confirmRevert: 'type.confirmBackToDraft',
};

export function getPollControlLabelKeys(
  isOpenPoll: boolean
): PollControlLabelKeys {
  return isOpenPoll ? OPEN_KEYS : ORGANIZATION_KEYS;
}

/**
 * READY is the one state where an admin might expect a frozen participant
 * list and find none, so that is the only place the explanation earns space.
 */
export function shouldShowReadyHint(
  isOpenPoll: boolean,
  state: string
): boolean {
  return isOpenPoll && state === PollState.READY;
}

/**
 * An open poll's participants are created as voters finish voting, so before
 * ACTIVE the page is guaranteed empty. The page itself stays reachable by URL.
 */
export function shouldShowManageParticipants(
  isOpenPoll: boolean,
  state: string
): boolean {
  if (!isOpenPoll) {
    return true;
  }

  return state === PollState.ACTIVE || state === PollState.FINISHED;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/web/components/polls/__tests__/pollControlLabels.test.ts`

Expected: PASS, all assertions.

- [ ] **Step 5: Typecheck, format and stage**

```bash
yarn typecheck
yarn lf
git add src/web/components/polls/pollControlLabels.ts src/web/components/polls/__tests__/pollControlLabels.test.ts
```

---

### Task 3: Wire `PollControls`

The poll detail/edit page panel. It gains an `isOpenPoll` prop, swaps its two button label pairs and two toasts for the module's keys, gains the READY hint line, and conditions its participants link.

**Files:**

- Modify: `src/web/components/polls/draft/PollControls.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx:794-800`

**Interfaces:**

- Consumes: `getPollControlLabelKeys`, `shouldShowReadyHint`, `shouldShowManageParticipants` from Task 2; the `poll.type.*` keys from Task 1.
- Produces: `PollControlsProps` gains `isOpenPoll: boolean` (required — `EditPollForm` is the only caller and always knows the type).

- [ ] **Step 1: Add the prop and derive the keys**

In `src/web/components/polls/draft/PollControls.tsx`, add the import below the existing `PollState` import (line 21):

```tsx
import {
  getPollControlLabelKeys,
  shouldShowReadyHint,
  shouldShowManageParticipants,
} from '@/src/web/components/polls/pollControlLabels';
```

Extend the props interface:

```tsx
interface PollControlsProps {
  pollId: string;
  state: PollState;
  hasQuestions: boolean;
  isOpenPoll: boolean;
  onStateChange: () => void;
}
```

Destructure `isOpenPoll` in the component signature alongside the other props, and immediately after `const t = useTranslations('poll');` add:

```tsx
const labelKeys = getPollControlLabelKeys(isOpenPoll);
```

- [ ] **Step 2: Swap the toast keys in the two handlers**

In `handleTakeSnapshot`, replace `toast.success(t('snapshotTaken'));` with:

```tsx
toast.success(t(labelKeys.prepared));
```

In `handleDiscardSnapshot`, replace `toast.success(t('snapshotDiscarded'));` with:

```tsx
toast.success(t(labelKeys.reverted));
```

Leave `handleActivate`, `handleDeactivate` and `handleFinish` alone — activation copy is already type-neutral.

- [ ] **Step 3: Swap the two button labels**

In the DRAFT branch, replace the button's label expression:

```tsx
{
  isTakingSnapshot ? t(labelKeys.preparing) : t(labelKeys.prepare);
}
```

In the READY branch, replace the discard button's label expression:

```tsx
{
  isDiscardingSnapshot ? t(labelKeys.reverting) : t(labelKeys.revert);
}
```

Do not add a confirmation dialog to either — this component intentionally confirms nothing on these two buttons today, and that stays.

- [ ] **Step 4: Add the READY hint line**

The status paragraph currently renders `{getStatusLabel()}`. Add the hint directly beneath it, inside the same wrapping `<div>`:

```tsx
<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
  {getStatusLabel()}
</p>;
{
  shouldShowReadyHint(isOpenPoll, state) && (
    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
      {t('type.readyHint')}
    </p>
  );
}
```

- [ ] **Step 5: Condition the participants link**

Wrap the existing `Manage Participants` link:

```tsx
{
  shouldShowManageParticipants(isOpenPoll, state) && (
    <Link href={`/polls/${pollId}/participants`}>
      <Button color="zinc">{t('manageParticipants')}</Button>
    </Link>
  );
}
```

Note the early-return FINISHED branch higher in the file has its own layout and no participants link — leave it as is.

- [ ] **Step 6: Pass the prop from `EditPollForm`**

In `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx`, the render at line 794 becomes:

```tsx
<PollControls
  pollId={pollId}
  state={pollData.state}
  hasQuestions={questions.length > 0}
  isOpenPoll={pollData.pollType === 'OPEN'}
  onStateChange={loadPoll}
/>
```

`pollData.pollType` is already used in this file at line 849, so no new data plumbing is needed.

- [ ] **Step 7: Typecheck and run the full suite**

```bash
yarn typecheck
yarn test
```

Expected: typecheck clean (a missing `isOpenPoll` prop anywhere would surface here), full suite green.

- [ ] **Step 8: Format and stage**

```bash
yarn lf
git add src/web/components/polls/draft/PollControls.tsx "src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx"
```

---

### Task 4: Wire `PollCard`

The list-view card. Same swaps, plus its native `confirm()` prompts, which this component does use.

**Files:**

- Modify: `src/web/components/polls/PollCard.tsx`

**Interfaces:**

- Consumes: `getPollControlLabelKeys`, `shouldShowManageParticipants` from Task 2; the `poll.type.*` keys from Task 1. `isOpenPoll` already exists locally at line 46.
- Produces: nothing new. Props are unchanged.

- [ ] **Step 1: Import the module and derive the keys**

Add below the `toast` import (line 16):

```tsx
import {
  getPollControlLabelKeys,
  shouldShowManageParticipants,
} from '@/src/web/components/polls/pollControlLabels';
```

`isOpenPoll` is already computed at line 46. Immediately after `const isParentArchived = isOrgArchived || isBoardArchived;` add:

```tsx
const labelKeys = getPollControlLabelKeys(isOpenPoll);
```

- [ ] **Step 2: Swap the confirm prompt and toast in `handleTakeSnapshot`**

```tsx
  const handleTakeSnapshot = async () => {
    if (!confirm(t(labelKeys.confirmPrepare))) {
      return;
    }
```

and inside its success branch:

```tsx
toast.success(t(labelKeys.prepared));
```

- [ ] **Step 3: Swap the confirm prompt and toast in `handleDiscardSnapshot`**

```tsx
  const handleDiscardSnapshot = async () => {
    if (!confirm(t(labelKeys.confirmRevert))) {
      return;
    }
```

and inside its success branch:

```tsx
toast.success(t(labelKeys.reverted));
```

- [ ] **Step 4: Swap the two button labels**

DRAFT button:

```tsx
{
  isTakingSnapshot ? t(labelKeys.preparing) : t(labelKeys.prepare);
}
```

READY discard button:

```tsx
{
  isDiscardingSnapshot ? t(labelKeys.reverting) : t(labelKeys.revert);
}
```

- [ ] **Step 5: Condition the participants link**

The link currently renders on `{canManageParticipants && (`. It becomes:

```tsx
{
  canManageParticipants &&
    shouldShowManageParticipants(isOpenPoll, poll.state) && (
      <Link href={`/polls/${poll.id}/participants`} className="flex-1">
        <Button color="zinc" className="w-full text-sm">
          {t('manageParticipants')}
        </Button>
      </Link>
    );
}
```

- [ ] **Step 6: Confirm no stale key references remain**

Run: `grep -n "takeSnapshot'\|takingSnapshot'\|snapshotTaken'\|discardSnapshot'\|discardingSnapshot'\|snapshotDiscarded'\|confirmTakeSnapshot'\|confirmDiscardSnapshot'" src/web/components/polls/PollCard.tsx src/web/components/polls/draft/PollControls.tsx`

Expected: no output. Every one of those keys now reaches `t()` through `labelKeys`. Hits mean a literal was missed. (`takeSnapshotAction` / `discardSnapshotAction` imports do not match this pattern and must stay.)

- [ ] **Step 7: Typecheck and run the full suite**

```bash
yarn typecheck
yarn test
```

Expected: both clean.

- [ ] **Step 8: Format and stage**

```bash
yarn lf
git add src/web/components/polls/PollCard.tsx
```

---

### Task 5: Manual verification

The tests cover key selection and locale completeness, not rendering. This is the only step that proves the strings actually resolve — a typo like `type.markReay` passes every automated check above and shows a raw key in the UI.

**Files:** none modified.

**Interfaces:**

- Consumes: everything from Tasks 1–4.
- Produces: nothing.

- [ ] **Step 1: Start the dev server**

```bash
yarn dev
```

Serves on port 8080.

- [ ] **Step 2: Check an open poll in DRAFT**

As an org admin, open an open poll's edit page (`/polls/<id>/edit`). Seed one with `yarn db:seed` if none exists.

Expect: primary button reads **"Mark as ready"** / **«Отметить готовым»** — not a raw `type.markReady`, not "Freeze participants". No "Manage Participants" button. Click it; the toast reads "Poll marked as ready".

- [ ] **Step 3: Check the same poll in READY**

Expect: **"Activate poll"** plus **"Back to draft"**; the hint line "Anyone verified can vote — no participant list." under the status; still no "Manage Participants". Click "Back to draft" — toast reads "Poll returned to draft" and the poll returns to DRAFT.

- [ ] **Step 4: Check an organization poll in DRAFT and READY**

Expect: unchanged — "Freeze participants", then "Activate poll" + "Discard participants", "Manage Participants" visible throughout, no hint line.

- [ ] **Step 5: Check the polls list**

At `/polls`, expect the same labels on the cards for both poll types, and the open poll's card to show "Manage Participants" only once it is ACTIVE.

- [ ] **Step 6: Check Russian**

Switch the locale and repeat steps 2–3. Expect Russian strings, no raw keys.

- [ ] **Step 7: Report**

Tell the user the plan is complete and all five tasks are staged but uncommitted, and list anything that looked wrong during manual verification.

---

## Notes for the implementer

- **Why the step is not simply deleted for open polls.** READY is the gate for the AI legality check (`src/application/ai/AnalyzePollLegalityUseCase.ts:81` rejects anything not READY) and the landing state for `deactivate()` (`src/domain/poll/Poll.ts:389`). Removing it would make open polls un-checkable and would let `deactivate` drop a poll into DRAFT, where questions can still be added (`src/domain/poll/Poll.ts:408`) even though votes exist. Do not "simplify" this by touching the state machine.
- **`takeSnapshotAction` and `discardSnapshotAction` keep their names.** They are correct for the organization path, and `TakeSnapshotUseCase` already branches internally for open polls (`src/application/poll/TakeSnapshotUseCase.ts:92`). No server-side change belongs in this plan.
- **READY does not lock questions.** `addQuestion` and `updateTitle` only block on ACTIVE/FINISHED. Do not write copy claiming otherwise.
