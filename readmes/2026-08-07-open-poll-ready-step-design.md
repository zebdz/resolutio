# Open polls: the DRAFT → READY step is misnamed, not redundant

Date: 2026-08-07
Status: approved, ready for planning

## 1. Problem

An admin preparing an **open** poll (`pollType = OPEN`) sees a button labelled **"Freeze
participants"** (`poll.takeSnapshot`). Nothing is frozen: an open poll's electorate is every
verified platform user, and `TakeSnapshotUseCase` early-returns for open polls after validating
questions and answers — no members resolved, no `PollEligibleMember` rows, no weight computation,
no participants (`src/application/poll/TakeSnapshotUseCase.ts:92`).

The label is therefore a lie for open polls.

## 2. Why the step itself stays

The step is misnamed, not meaningless. Removing READY for open polls would break two things:

1. **Legality check gate.** `AnalyzePollLegalityUseCase` rejects any poll that is not READY
   (`src/application/ai/AnalyzePollLegalityUseCase.ts:81`). Skip READY and an open poll can never
   be AI-checked.
2. **Deactivate landing spot.** `deactivate()` is ACTIVE → READY (`src/domain/poll/Poll.ts:389`).
   With no READY, deactivate would have to land in DRAFT — where `addQuestion` / `removeQuestion`
   are allowed (`src/domain/poll/Poll.ts:408`, `:421`). Today DRAFT-with-votes is unreachable
   because `discardSnapshot` blocks on `hasVotes` (`src/domain/poll/Poll.ts:359`), so that change
   would open a hole: editing the questions of an open poll that already has votes.

For an open poll, READY means exactly: **validated (≥1 question, each with ≥1 answer),
legality-checkable, not yet accepting votes.**

Note it does _not_ mean "questions locked" — `canEdit` allows edits in READY as long as no votes
exist (`src/domain/poll/Poll.ts:239`). Any "lock" wording would be inaccurate.

## 3. Decision

Rename the step for open polls. Keep two steps, keep the state machine.

**Rejected alternatives:**

- _One button that does snapshot + activate atomically._ Would leave the legality check unreachable
  for open polls unless its gate were relaxed to DRAFT.
- _Drop READY for open polls in the domain._ Needs a new guard against question edits once votes
  exist, plus a relaxed legality gate; widest blast radius (badge, filters, tests) for a
  presentation problem.

## 4. Scope

Presentation only. **No domain change, no use-case change, no new server action, no migration.**
`takeSnapshotAction` / `discardSnapshotAction` keep their names — correct for the organization path.

Files touched:

- `messages/en.json`, `messages/ru.json`
- `src/web/components/polls/draft/PollControls.tsx`
- `src/web/components/polls/PollCard.tsx`
- `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx` (one prop)

## 5. Copy

New keys under `poll.type.*`, alongside the existing open-poll copy (`type.open`, `type.openBadge`,
`type.copyLink`). Existing `poll.takeSnapshot` / `poll.discardSnapshot` families are untouched and
still serve organization polls.

| key                       | en                                              | ru                                                                          |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `type.markReady`          | Mark as ready                                   | Отметить готовым                                                            |
| `type.markingReady`       | Marking as ready…                               | Отмечаем…                                                                   |
| `type.markedReady`        | Poll marked as ready                            | Голосование отмечено готовым                                                |
| `type.confirmMarkReady`   | Mark this poll ready to activate?               | Отметить голосование готовым к активации?                                   |
| `type.backToDraft`        | Back to draft                                   | Вернуть в черновик                                                          |
| `type.returningToDraft`   | Returning to draft…                             | Возврат в черновик…                                                         |
| `type.returnedToDraft`    | Poll returned to draft                          | Голосование возвращено в черновик                                           |
| `type.confirmBackToDraft` | Return this poll to draft?                      | Вернуть голосование в черновик?                                             |
| `type.readyHint`          | Anyone verified can vote — no participant list. | Голосовать может любой подтверждённый пользователь — списка участников нет. |

**Deletion:** `poll.confirmTakeSnapshotDescription` is dead in both locales — defined, referenced
nowhere. Remove it.

## 6. Components

### `PollControls.tsx`

New prop `isOpenPoll: boolean`. `EditPollForm` already holds `pollData.pollType`
(`src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx:849`), so it passes
`isOpenPoll={pollData.pollType === 'OPEN'}`.

- DRAFT button → `type.markReady` / `type.markingReady`; success toast → `type.markedReady`
- READY discard button → `type.backToDraft` / `type.returningToDraft`; success toast →
  `type.returnedToDraft`
- READY + open → render `type.readyHint` as a line under the status label
- Manage-participants link rendered when `!isOpenPoll || state === 'ACTIVE'` (the FINISHED branch
  returns early and never reaches it)

Confirmation behaviour is unchanged: `PollControls` still confirms nothing on the DRAFT and READY
buttons. Only the strings branch.

### `PollCard.tsx`

Already computes `isOpenPoll` (`src/web/components/polls/PollCard.tsx:46`). Same label and toast
swaps. Its existing native `confirm()` calls take `type.confirmMarkReady` and
`type.confirmBackToDraft` when the poll is open.

Manage-participants link: `canManageParticipants && (!isOpenPoll || isActive || isFinished)`.

### Out of scope

The participants page stays reachable by direct URL for an open poll in DRAFT/READY — it already
renders its own open-poll header (`src/web/components/polls/participants/ParticipantManagement.tsx:200`).
Hiding the link is the whole change; no redirect is added.

## 7. Tests

There is no React Testing Library in this repo and vitest runs `environment: 'node'` with no jsdom
(`vitest.config.ts:31`). The existing `.test.tsx` files are not renders: `PollSidebar.test.tsx` and
`AppNavbar.test.tsx` re-implement their logic inside the test file, which verifies nothing real.
The one sound precedent is `src/web/components/auth/passwordStrengthConfig.ts` — logic extracted to
a pure module, tested directly.

Follow that precedent. Extract the branch into
**`src/web/components/polls/pollControlLabels.ts`**, consumed by both `PollControls` and `PollCard`
(which today duplicate their label logic):

```ts
export interface PollControlLabelKeys {
  prepare: string; // DRAFT primary button
  preparing: string; // its pending label
  prepared: string; // its success toast
  confirmPrepare: string; // its confirm prompt (PollCard only)
  revert: string; // READY secondary button
  reverting: string;
  reverted: string;
  confirmRevert: string;
}

export function getPollControlLabelKeys(
  isOpenPoll: boolean
): PollControlLabelKeys;
export function shouldShowReadyHint(
  isOpenPoll: boolean,
  state: string
): boolean;
export function shouldShowManageParticipants(
  isOpenPoll: boolean,
  state: string
): boolean;
```

Keys are relative to the `poll` namespace, since both components call `useTranslations('poll')`.

`pollControlLabels.test.ts` — organization keys are the existing `takeSnapshot` family; open keys
are the new `type.*` family; hint only for open + READY; participants link hidden for open +
DRAFT/READY and shown for open + ACTIVE/FINISHED and for every organization state.

`src/i18n/__tests__/openPollMessages.test.ts` — following
`src/i18n/__tests__/protocolMessages.test.ts`: every key `getPollControlLabelKeys` can return
resolves in both `en.json` and `ru.json`, and `confirmTakeSnapshotDescription` is gone from both.

Render-level coverage would need jsdom + `@testing-library/react` added to the project — out of
scope here.

## 8. Unresolved

None.
