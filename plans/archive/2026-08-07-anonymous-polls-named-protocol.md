# Anonymous Polls and the Named Protocol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `readmes/2026-08-07-anonymous-polls-named-protocol-design.md` — read it first.

**Goal:** Make named voting the default: add an opt-in `anonymous` flag at poll creation, and for named polls publish a new "named protocol" PDF listing who voted for each answer, visible to every org member while the poll is still running.

**Architecture:** A new immutable `Poll.anonymous` field plus a pure domain policy (`PollResultsPolicy`) that becomes the single source of truth for every results-visibility decision. The named protocol gets its own read-model use case (`GetNamedProtocolUseCase`), its own PDF generator and its own route, so the results-page hot path never pays for property lookups.

**Tech Stack:** TypeScript, Next.js 15 (App Router), Prisma 7 + PostgreSQL, vitest, pdfmake, next-intl, Tailwind + Catalyst.

## Global Constraints

- **DDD layering.** `domain/` depends on nothing — no Prisma, no next-intl, no HTTP types. Repository interfaces live in `domain/`, implementations in `infrastructure/`.
- **NEVER `git commit`.** `git add` is allowed. The user commits.
- **Ask before filesystem-modifying commands** — this is a learning project.
- **No raw SQL in `web/actions/`.** New raw SQL, if any, belongs in `infrastructure/` only. This plan uses the Prisma query builder throughout.
- **Error codes, not messages.** Domain and use cases return dotted codes; the presentation layer translates via `translateErrorCode` from `@/web/actions/utils/translateErrorCode`. Never write inline `.startsWith()` / `.split('.')` translation logic.
- **Every new code gets messages** in BOTH `messages/en.json` and `messages/ru.json`. Counts use parameters (`"Не голосовали ({count})"`), never hardcoded numbers.
- **Server→Client boundary.** Filter sensitive fields on the server BEFORE serializing. Domain objects never cross the boundary. Convert Prisma `Decimal` with `Number()`.
- **`viewerFacts` is server-side only.** It must never appear in a props object passed to a Client Component.
- **Every server action starts with** `const rateLimited = await checkRateLimit(); if (rateLimited) return rateLimited;`
- **Cursor styling.** Native `<button>` / `<a>` that don't get it from Catalyst need `cursor-pointer`, plus `disabled:cursor-not-allowed` where applicable.
- **Test command:** `yarn test <path>` (vitest run). Watch mode: `yarn test:watch`. Type check: `yarn typecheck`. Lint+format: `yarn lf`.
- **After any `prisma migrate dev`, run `yarn prisma:generate`** — migration does not regenerate the client in this repo.

---

## Phase 1 — Domain and data foundation ✅ COMPLETE

> Done 2026-08-07. Tasks 1–3 landed: `Poll.anonymous` + `isAnonymous()`, `PollResultsPolicy` (26 tests),
> migration `20260807171549_add_poll_anonymous`, repository mapping. `yarn typecheck` clean;
> 1323 tests pass across `src/domain/poll`, `src/application/poll`, `src/infrastructure`.

### Task 1: `Poll.anonymous`

**Files:**

- Modify: `src/domain/poll/Poll.ts`
- Test: `src/domain/poll/__tests__/Poll.test.ts`

**Interfaces:**

- Produces: `PollProps.anonymous: boolean`; `Poll.create(title, description, organizationId, boardId, createdBy, startDate, endDate, profanityChecker?, pollType?, anonymous?)`; `poll.isAnonymous(): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/poll/__tests__/Poll.test.ts`:

```typescript
describe('anonymous flag', () => {
  const args = [
    'Title',
    'Description',
    'org-1',
    null,
    'user-1',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
  ] as const;

  it('defaults to named (anonymous = false)', () => {
    const result = Poll.create(...args);

    expect(result.success).toBe(true);
    expect(result.value.isAnonymous()).toBe(false);
  });

  it('creates an anonymous poll when asked', () => {
    const result = Poll.create(...args, undefined, 'ORGANIZATION', true);

    expect(result.success).toBe(true);
    expect(result.value.isAnonymous()).toBe(true);
  });

  it('allows an anonymous open poll', () => {
    const result = Poll.create(...args, undefined, 'OPEN', true);

    expect(result.success).toBe(true);
    expect(result.value.isAnonymous()).toBe(true);
  });

  it('allows a named open poll', () => {
    const result = Poll.create(...args, undefined, 'OPEN', false);

    expect(result.success).toBe(true);
    expect(result.value.isAnonymous()).toBe(false);
  });

  it('round-trips through reconstitute', () => {
    const created = Poll.create(...args, undefined, 'ORGANIZATION', true).value;
    const restored = Poll.reconstitute(created.toJSON() as any);

    expect(restored.isAnonymous()).toBe(true);
  });

  it('exposes no mutator for the flag', () => {
    const poll = Poll.create(...args).value;

    expect((poll as any).setAnonymous).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/domain/poll/__tests__/Poll.test.ts -t "anonymous flag"`
Expected: FAIL — `poll.isAnonymous is not a function`

- [ ] **Step 3: Implement**

In `src/domain/poll/Poll.ts`:

Add to `PollProps`, after `propertyIds`:

```typescript
anonymous: boolean;
```

Change the `create` signature — new trailing parameter only, so existing positional callers are unaffected:

```typescript
    pollType: string = PollType.ORGANIZATION,
    anonymous: boolean = false
  ): Result<Poll, string> {
```

Add `anonymous,` to the `new Poll({ ... })` literal inside `create`, next to `propertyIds: []`.

Add the getter beside `isOpen()`:

```typescript
  /**
   * An anonymous poll keeps today's behaviour: only admins ever see who voted
   * how, and nothing is readable until the poll is finished. Set once at
   * creation and never mutated — a voter decides whether to vote based on this
   * label, so it must not change under them.
   */
  public isAnonymous(): boolean {
    return this.props.anonymous;
  }
```

Do NOT add a setter, and do NOT touch `UpdatePollUseCase`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/poll/__tests__/Poll.test.ts`
Expected: PASS (whole file — the new field must not break existing cases)

- [ ] **Step 5: Stage**

```bash
git add src/domain/poll/Poll.ts src/domain/poll/__tests__/Poll.test.ts
```

---

### Task 2: `PollResultsPolicy`

**Files:**

- Create: `src/domain/poll/PollResultsPolicy.ts`
- Create: `src/domain/poll/__tests__/PollResultsPolicy.test.ts`
- Modify: `src/domain/poll/PollDomainCodes.ts`

**Interfaces:**

- Consumes: `poll.isAnonymous()` (Task 1).
- Produces: `ResultsViewerFacts { isAdmin, isOrgMember, isPollVoter }`; `PollResultsPolicy.{ canViewResults, canViewVoterNames, canViewSignWillingness, canExportProtocol, canExportNamedProtocol }`. `canViewResults` / `canExportProtocol` / `canExportNamedProtocol` return `Result<void, string>`; `canViewVoterNames` / `canViewSignWillingness` return `boolean`.

- [ ] **Step 1: Add the domain codes**

In `src/domain/poll/PollDomainCodes.ts`, add a new block before the closing `} as const;`:

```typescript
  // Results visibility
  POLL_RESULTS_ADMIN_ONLY: 'domain.poll.pollResultsAdminOnly',
  POLL_RESULTS_NOT_ORG_MEMBER: 'domain.poll.pollResultsNotOrgMember',
  POLL_PROTOCOL_NOT_AVAILABLE: 'domain.poll.pollProtocolNotAvailable',
  POLL_IS_ANONYMOUS: 'domain.poll.pollIsAnonymous',
```

- [ ] **Step 2: Write the failing test**

Create `src/domain/poll/__tests__/PollResultsPolicy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollState } from '../PollState';
import { PollResultsPolicy, ResultsViewerFacts } from '../PollResultsPolicy';
import { PollDomainCodes } from '../PollDomainCodes';

type Kind = 'ORGANIZATION' | 'OPEN';

function makePoll(
  state: PollState,
  opts: { anonymous?: boolean; pollType?: Kind } = {}
): Poll {
  const poll = Poll.create(
    'Title',
    'Description',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    opts.pollType ?? 'ORGANIZATION',
    opts.anonymous ?? false
  ).value;

  const question = Question.create('Q1', 'poll-1', 1, 0, 'single-choice').value;
  question.addAnswer(Answer.create('A1', 1, 'question-1').value);
  poll.addQuestion(question);

  if (state !== PollState.DRAFT) {
    poll.takeSnapshot();
  }

  if (state === PollState.ACTIVE || state === PollState.FINISHED) {
    poll.activate();
  }

  if (state === PollState.FINISHED) {
    poll.finish();
  }

  return poll;
}

const admin: ResultsViewerFacts = {
  isAdmin: true,
  isOrgMember: true,
  isPollVoter: true,
};
const member: ResultsViewerFacts = {
  isAdmin: false,
  isOrgMember: true,
  isPollVoter: false,
};
const openVoter: ResultsViewerFacts = {
  isAdmin: false,
  isOrgMember: false,
  isPollVoter: true,
};
const outsider: ResultsViewerFacts = {
  isAdmin: false,
  isOrgMember: false,
  isPollVoter: false,
};

describe('PollResultsPolicy.canViewResults', () => {
  it('lets an admin read an active anonymous poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { anonymous: true }),
      admin
    );

    expect(r.success).toBe(true);
  });

  it('refuses a member on an active anonymous poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { anonymous: true }),
      member
    );

    expect(r.success).toBe(false);
    expect(r.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('lets a member read an active named poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE),
      member
    );

    expect(r.success).toBe(true);
  });

  it('lets a member read a finished anonymous poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED, { anonymous: true }),
      member
    );

    expect(r.success).toBe(true);
  });

  it('refuses an outsider on any poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED),
      outsider
    );

    expect(r.success).toBe(false);
    expect(r.error).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  });

  it('lets an open-poll voter read a finished open poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED, { pollType: 'OPEN' }),
      openVoter
    );

    expect(r.success).toBe(true);
  });

  it('lets an open-poll voter read an ACTIVE named open poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { pollType: 'OPEN' }),
      openVoter
    );

    expect(r.success).toBe(true);
  });

  it('refuses an open-poll voter on an ACTIVE anonymous open poll', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.ACTIVE, { pollType: 'OPEN', anonymous: true }),
      openVoter
    );

    expect(r.success).toBe(false);
    expect(r.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('refuses a poll voter on a non-open poll they are not a member of', () => {
    const r = PollResultsPolicy.canViewResults(
      makePoll(PollState.FINISHED),
      openVoter
    );

    expect(r.success).toBe(false);
    expect(r.error).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  });

  it('lets a member read DRAFT and READY polls of either kind', () => {
    for (const state of [PollState.DRAFT, PollState.READY]) {
      for (const anonymous of [true, false]) {
        expect(
          PollResultsPolicy.canViewResults(
            makePoll(state, { anonymous }),
            member
          ).success
        ).toBe(true);
      }
    }
  });
});

describe('PollResultsPolicy.canViewVoterNames', () => {
  it('is true for an admin even on an anonymous poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(
        makePoll(PollState.FINISHED, { anonymous: true }),
        admin
      )
    ).toBe(true);
  });

  it('is false for a member on an anonymous poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(
        makePoll(PollState.FINISHED, { anonymous: true }),
        member
      )
    ).toBe(false);
  });

  it('is true for a member on an active named poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(makePoll(PollState.ACTIVE), member)
    ).toBe(true);
  });

  it('is false for an outsider on a named poll', () => {
    expect(
      PollResultsPolicy.canViewVoterNames(
        makePoll(PollState.FINISHED),
        outsider
      )
    ).toBe(false);
  });
});

describe('PollResultsPolicy.canViewSignWillingness', () => {
  it('is admin-only regardless of the anonymous flag', () => {
    expect(PollResultsPolicy.canViewSignWillingness(admin)).toBe(true);
    expect(PollResultsPolicy.canViewSignWillingness(member)).toBe(false);
    expect(PollResultsPolicy.canViewSignWillingness(openVoter)).toBe(false);
  });
});

describe('PollResultsPolicy.canExportProtocol', () => {
  it('refuses everyone before FINISHED on an anonymous poll', () => {
    const poll = makePoll(PollState.ACTIVE, { anonymous: true });

    expect(PollResultsPolicy.canExportProtocol(poll, admin).error).toBe(
      PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE
    );
  });

  it('allows an admin on a finished anonymous poll', () => {
    expect(
      PollResultsPolicy.canExportProtocol(
        makePoll(PollState.FINISHED, { anonymous: true }),
        admin
      ).success
    ).toBe(true);
  });

  it('allows a member on an ACTIVE named poll', () => {
    expect(
      PollResultsPolicy.canExportProtocol(makePoll(PollState.ACTIVE), member)
        .success
    ).toBe(true);
  });

  it('refuses on a READY named poll — nothing has been voted yet', () => {
    expect(
      PollResultsPolicy.canExportProtocol(makePoll(PollState.READY), admin)
        .error
    ).toBe(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
  });

  it('propagates the read refusal for an outsider', () => {
    expect(
      PollResultsPolicy.canExportProtocol(
        makePoll(PollState.FINISHED),
        outsider
      ).error
    ).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  });
});

describe('PollResultsPolicy.canExportNamedProtocol', () => {
  it('refuses on an anonymous poll even for an admin', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.FINISHED, { anonymous: true }),
        admin
      ).error
    ).toBe(PollDomainCodes.POLL_IS_ANONYMOUS);
  });

  it('allows a member on an ACTIVE named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.ACTIVE),
        member
      ).success
    ).toBe(true);
  });

  it('allows a member on a FINISHED named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.FINISHED),
        member
      ).success
    ).toBe(true);
  });

  it('refuses on a READY named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(makePoll(PollState.READY), admin)
        .error
    ).toBe(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
  });

  it('refuses an outsider on a named poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.FINISHED),
        outsider
      ).error
    ).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('allows an open-poll voter on a named open poll', () => {
    expect(
      PollResultsPolicy.canExportNamedProtocol(
        makePoll(PollState.ACTIVE, { pollType: 'OPEN' }),
        openVoter
      ).success
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/domain/poll/__tests__/PollResultsPolicy.test.ts`
Expected: FAIL — cannot resolve `../PollResultsPolicy`

- [ ] **Step 4: Implement**

Create `src/domain/poll/PollResultsPolicy.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { Poll } from './Poll';
import { PollDomainCodes } from './PollDomainCodes';

export interface ResultsViewerFacts {
  // Org admin or platform superadmin.
  isAdmin: boolean;
  isOrgMember: boolean;
  // Has a PollParticipant row. For an open poll that means they actually cast
  // a vote, since the row is created at vote time.
  isPollVoter: boolean;
}

/**
 * Single source of truth for "what may this viewer see of this poll's results".
 *
 * An anonymous poll behaves the way every poll behaved before the flag existed:
 * admins only, and nothing until the poll is finished. A named poll opens the
 * tally and the voter names to the organization while the vote is still
 * running — that transparency is the point of it.
 *
 * Sign-willingness stays admin-only in both cases: it carries phone numbers
 * collected under a separate consent, not part of the voting record.
 */
function canViewResults(
  poll: Poll,
  facts: ResultsViewerFacts
): Result<void, string> {
  if (facts.isAdmin) {
    return success(undefined);
  }

  // An open poll is voted on by outsiders too, so anyone who actually cast a
  // vote in it may see the outcome they took part in.
  const isAudience = facts.isOrgMember || (poll.isOpen() && facts.isPollVoter);

  if (!isAudience) {
    return failure(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
  }

  if (poll.isAnonymous() && poll.isActive()) {
    return failure(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  }

  return success(undefined);
}

function canViewVoterNames(poll: Poll, facts: ResultsViewerFacts): boolean {
  if (facts.isAdmin) {
    return true;
  }

  if (poll.isAnonymous()) {
    return false;
  }

  return canViewResults(poll, facts).success;
}

function canViewSignWillingness(facts: ResultsViewerFacts): boolean {
  return facts.isAdmin;
}

/**
 * The existing results protocol. A named poll may be exported mid-vote — the
 * generator marks such a document preliminary.
 */
function canExportProtocol(
  poll: Poll,
  facts: ResultsViewerFacts
): Result<void, string> {
  const readable = canViewResults(poll, facts);

  if (!readable.success) {
    return readable;
  }

  if (poll.isFinished()) {
    return success(undefined);
  }

  if (!poll.isAnonymous() && poll.isActive()) {
    return success(undefined);
  }

  return failure(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
}

function canExportNamedProtocol(
  poll: Poll,
  facts: ResultsViewerFacts
): Result<void, string> {
  if (poll.isAnonymous()) {
    return failure(PollDomainCodes.POLL_IS_ANONYMOUS);
  }

  // Before activation there are no votes, so there is no record to name.
  if (!poll.isActive() && !poll.isFinished()) {
    return failure(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
  }

  if (!canViewVoterNames(poll, facts)) {
    return failure(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  }

  return success(undefined);
}

export const PollResultsPolicy = {
  canViewResults,
  canViewVoterNames,
  canViewSignWillingness,
  canExportProtocol,
  canExportNamedProtocol,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/domain/poll/__tests__/PollResultsPolicy.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Add the four messages**

`messages/en.json` under `domain.poll`:

```json
"pollResultsAdminOnly": "Only organization administrators can view these results.",
"pollResultsNotOrgMember": "You are not a member of this organization.",
"pollProtocolNotAvailable": "The protocol is not available for this poll yet.",
"pollIsAnonymous": "This poll is anonymous — there is no named protocol."
```

`messages/ru.json` under `domain.poll`:

```json
"pollResultsAdminOnly": "Результаты доступны только администраторам организации.",
"pollResultsNotOrgMember": "Вы не являетесь участником этой организации.",
"pollProtocolNotAvailable": "Протокол для этого голосования пока недоступен.",
"pollIsAnonymous": "Это анонимное голосование — поимённый протокол не формируется."
```

- [ ] **Step 7: Stage**

```bash
git add src/domain/poll/PollResultsPolicy.ts \
        src/domain/poll/__tests__/PollResultsPolicy.test.ts \
        src/domain/poll/PollDomainCodes.ts messages/en.json messages/ru.json
```

---

### Task 3: Schema, migration and repository mapping

**Files:**

- Modify: `prisma/schema.prisma` (model `Poll`)
- Modify: `src/infrastructure/repositories/PrismaPollRepository.ts`
- Create: `prisma/migrations/<timestamp>_add_poll_anonymous/migration.sql` (generated)

**Interfaces:**

- Consumes: `PollProps.anonymous` (Task 1).
- Produces: a persisted `polls.anonymous` column that round-trips through `createPoll`, `updatePoll` and `Poll.reconstitute`.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, model `Poll`, after the `propertyAggregation` line:

```prisma
  // Opt-in secrecy. Default false = named: voter identities are part of the
  // record and the org can read them while the poll runs. Set once at
  // creation; there is deliberately no update path.
  anonymous            Boolean   @default(false)
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_poll_anonymous`

Expected: a new folder under `prisma/migrations/` whose `migration.sql` reads
`ALTER TABLE "polls" ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT false;`

No backfill — every existing poll becomes named. This is the decision recorded in §3.2 of the spec.

- [ ] **Step 3: Regenerate the client**

Run: `yarn prisma:generate`

- [ ] **Step 4: Map the field in the repository**

In `src/infrastructure/repositories/PrismaPollRepository.ts`:

- `createPoll` — add `anonymous: poll.isAnonymous(),` to the `data` object, next to `pollType`.
- `updatePoll` (around line 361, the other `pollType` site) — add `anonymous: poll.isAnonymous(),` so a round-trip never drops the flag.
- The `Poll.reconstitute({ ... })` mapper (around line 398) — add `anonymous: prismaData.anonymous,`.

- [ ] **Step 5: Verify the build typechecks**

Run: `yarn typecheck`
Expected: no errors. If `PollProps.anonymous` is reported missing at some `Poll.reconstitute` call site in a test, add `anonymous: false` there.

- [ ] **Step 6: Run the poll test suites**

Run: `yarn test src/domain/poll src/application/poll src/infrastructure`
Expected: PASS

- [ ] **Step 7: Stage**

```bash
git add prisma/schema.prisma prisma/migrations \
        src/infrastructure/repositories/PrismaPollRepository.ts
```

- [ ] **Step 8: Mark Phase 1 complete in this file and STOP for review.**

---

## Phase 2 — Application wiring ✅ COMPLETE

> Done 2026-08-07. Tasks 4–5 landed. `GetPollResultsUseCase` now delegates every access decision to
> `PollResultsPolicy` and returns `canViewVoterNames` + `canViewSignWillingness` + `viewerFacts`.
> Orphaned keys `poll.errors.resultsAdminOnly` / `notOrganizationMember` removed from both message files.
> Full suite: 2822 tests pass. `yarn typecheck` and `yarn lint` clean.
>
> Deviation from plan: the results page fix (splitting `protocolSignWillingness` onto
> `canViewSignWillingness`) was pulled forward from Task 11 rather than left on the temporary shim —
> leaving the two gates conflated, even harmlessly, was the exact defect this design exists to remove.

### Task 4: Creating an anonymous poll end to end

**Files:**

- Modify: `src/application/poll/PollSchemas.ts`
- Modify: `src/application/poll/CreatePollUseCase.ts`
- Modify: `src/web/actions/poll/poll.ts` (`createPollAction`, ~line 206; poll-list serialization, ~line 1556)
- Test: `src/application/poll/__tests__/CreatePollUseCase.test.ts`

**Interfaces:**

- Consumes: `Poll.create(..., anonymous)` (Task 1).
- Produces: `CreatePollInput.anonymous?: boolean`; `createPollSchema` accepts `anonymous`; the poll-list payload carries `anonymous: boolean` for `PollCard` (Task 10).

- [ ] **Step 1: Write the failing test**

Append to `src/application/poll/__tests__/CreatePollUseCase.test.ts`, inside the top-level `describe`:

```typescript
it('creates a named poll by default', async () => {
  const result = await useCase.execute({
    title: 'Test Poll',
    description: 'Test Description',
    organizationId: 'org-1',
    boardId: null,
    createdBy: 'user-1',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-02-15'),
  });

  expect(result.success).toBe(true);
  expect(result.value.isAnonymous()).toBe(false);
});

it('creates an anonymous poll when the input says so', async () => {
  const result = await useCase.execute({
    title: 'Test Poll',
    description: 'Test Description',
    organizationId: 'org-1',
    boardId: null,
    createdBy: 'user-1',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-02-15'),
    anonymous: true,
  });

  expect(result.success).toBe(true);
  expect(result.value.isAnonymous()).toBe(true);
});
```

If the existing mock `pollRepository.createPoll` returns a canned poll rather than its argument, change it to echo the argument back: `createPoll: vi.fn().mockImplementation((p) => Promise.resolve(success(p)))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/application/poll/__tests__/CreatePollUseCase.test.ts -t anonymous`
Expected: FAIL — the second case returns `false`.

- [ ] **Step 3: Implement**

`src/application/poll/CreatePollUseCase.ts` — add to `CreatePollInput`:

```typescript
  anonymous?: boolean;
```

and pass it as the last argument of `Poll.create`:

```typescript
      input.pollType,
      input.anonymous ?? false
    );
```

`src/application/poll/PollSchemas.ts` — in `createPollSchema`'s object, after `pollType`:

```typescript
      anonymous: z.coerce.boolean().default(false),
```

Do NOT add it to `updatePollSchema`.

`src/web/actions/poll/poll.ts`, `createPollAction` — read the field alongside `pollTypeRaw`:

```typescript
const anonymousRaw = formData.get('anonymous') as string | null;
```

and add to the `input` object:

```typescript
      anonymous: anonymousRaw === 'true',
```

Then pass `anonymous: validation.data.anonymous` into the use-case call, matching how `pollType` is threaded through.

In the poll-list serialization (the block near line 1556 that sets `pollJson.canVote`), make sure `anonymous` survives onto the serialized poll. `pollJson` comes from `poll.toJSON()`, which spreads `props`, so `anonymous` is already present — verify with a quick read and only add an explicit assignment if it is being stripped by a field allowlist.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/application/poll`
Expected: PASS

- [ ] **Step 5: Stage**

```bash
git add src/application/poll/CreatePollUseCase.ts src/application/poll/PollSchemas.ts \
        src/web/actions/poll/poll.ts \
        src/application/poll/__tests__/CreatePollUseCase.test.ts
```

---

### Task 5: `GetPollResultsUseCase` delegates to the policy

**Files:**

- Modify: `src/application/poll/GetPollResultsUseCase.ts`
- Modify: `src/application/poll/__tests__/GetPollResultsUseCase.test.ts`

**Interfaces:**

- Consumes: `PollResultsPolicy` (Task 2).
- Produces: `GetPollResultsResult` with `canViewVoterNames: boolean`, `canViewSignWillingness: boolean`, `viewerFacts: ResultsViewerFacts` — **replacing** `canViewVoters`.

- [ ] **Step 1: Write the failing tests**

In `src/application/poll/__tests__/GetPollResultsUseCase.test.ts`:

Replace the four `expect(result.error).toBe('poll.errors.resultsAdminOnly')` /
`'poll.errors.notOrganizationMember'` assertions with
`PollDomainCodes.POLL_RESULTS_ADMIN_ONLY` / `PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER`
(import `PollDomainCodes` from `'../../../domain/poll/PollDomainCodes'`).

Replace every `canViewVoters` assertion with `canViewVoterNames`, then add:

```typescript
it('gives a member of a named active poll the voter names but not the phones', async () => {
  (poll as any).props.state = PollState.ACTIVE;
  (poll as any).props.anonymous = false;
  organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
  organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);
  userRepository.isSuperAdmin = vi.fn().mockResolvedValue(false);

  const result = await useCase.execute({ pollId: 'poll-1', userId: 'user-2' });

  expect(result.success).toBe(true);
  expect(result.value.canViewVoterNames).toBe(true);
  expect(result.value.canViewSignWillingness).toBe(false);
  expect(result.value.protocolSignWillingness).toEqual([]);
});

it('refuses a member on an anonymous active poll', async () => {
  (poll as any).props.state = PollState.ACTIVE;
  (poll as any).props.anonymous = true;
  organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
  organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);
  userRepository.isSuperAdmin = vi.fn().mockResolvedValue(false);

  const result = await useCase.execute({ pollId: 'poll-1', userId: 'user-2' });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/application/poll/__tests__/GetPollResultsUseCase.test.ts`
Expected: FAIL — `canViewVoterNames` is undefined.

- [ ] **Step 3: Implement**

In `src/application/poll/GetPollResultsUseCase.ts`:

Add imports:

```typescript
import {
  PollResultsPolicy,
  ResultsViewerFacts,
} from '../../domain/poll/PollResultsPolicy';
```

Replace the whole authorization block (steps 2–3, currently lines ~95–137) with:

```typescript
// 2. Assemble the viewer's facts, then let the domain policy decide.
// The participant lookup used to run only for open polls; a named poll
// now grants access on the strength of it too, so it is resolved up front.
const [isSuperAdmin, isOrganizationAdmin, isMember, participantResult] =
  await Promise.all([
    this.userRepository.isSuperAdmin(userId),
    this.organizationRepository.isUserAdmin(userId, poll.organizationId),
    this.organizationRepository.isUserMember(userId, poll.organizationId),
    this.participantRepository.getParticipantByUserAndPoll(pollId, userId),
  ]);

const viewerFacts: ResultsViewerFacts = {
  isAdmin: isSuperAdmin || isOrganizationAdmin,
  isOrgMember: isMember,
  isPollVoter: participantResult.success && !!participantResult.value,
};

const readable = PollResultsPolicy.canViewResults(poll, viewerFacts);

if (!readable.success) {
  return failure(readable.error);
}

const canViewVoterNames = PollResultsPolicy.canViewVoterNames(
  poll,
  viewerFacts
);
const canViewSignWillingness =
  PollResultsPolicy.canViewSignWillingness(viewerFacts);
```

Replace the `if (isAdmin)` guard on the sign-willingness block with `if (canViewSignWillingness)`.

Update the interface and the return:

```typescript
export interface GetPollResultsResult {
  poll: Poll;
  results: QuestionResult[];
  totalParticipants: number;
  totalParticipantWeight: number;
  canViewVoterNames: boolean;
  canViewSignWillingness: boolean;
  // SERVER-SIDE ONLY. PDF routes re-ask the policy about export rights with
  // these. Never serialize this to a Client Component.
  viewerFacts: ResultsViewerFacts;
  protocolSignWillingness: ProtocolSignWillingnessEntry[];
}
```

```typescript
return success({
  poll,
  results,
  totalParticipants: participants.length,
  totalParticipantWeight,
  canViewVoterNames,
  canViewSignWillingness,
  viewerFacts,
  protocolSignWillingness,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/application/poll/__tests__/GetPollResultsUseCase.test.ts`
Expected: PASS

- [ ] **Step 5: Fix the compile fallout**

Run: `yarn typecheck`

`canViewVoters` has three remaining consumers — fix each:

- `src/app/api/polls/[pollId]/results/protocol-pdf/route.ts` → `canViewSignWillingness`, and change its 403 body from `'poll.errors.resultsAdminOnly'` to `PollDomainCodes.POLL_RESULTS_ADMIN_ONLY`.
- `src/app/[locale]/polls/[pollId]/results/page.tsx` → handled in Task 11; for now change `const canViewVoters = results.canViewVoters;` to `const canViewVoters = results.canViewVoterNames;` so the build stays green.
- `src/app/api/polls/[pollId]/results/pdf/route.ts` → does not read the flag; leave it for Task 9.

- [ ] **Step 6: Remove the two orphaned message keys**

Delete `resultsAdminOnly` and `notOrganizationMember` from `poll.errors` in BOTH `messages/en.json` and `messages/ru.json`. Confirm nothing else references them:

Run: `rg -n "resultsAdminOnly|notOrganizationMember" src messages`
Expected: no output.

- [ ] **Step 7: Run the full suite**

Run: `yarn test`
Expected: PASS

- [ ] **Step 8: Stage and mark Phase 2 complete in this file, then STOP for review.**

```bash
git add src/application/poll/GetPollResultsUseCase.ts \
        src/application/poll/__tests__/GetPollResultsUseCase.test.ts \
        src/app/api/polls/\[pollId\]/results/protocol-pdf/route.ts \
        src/app/\[locale\]/polls/\[pollId\]/results/page.tsx \
        messages/en.json messages/ru.json
```

---

## Phase 3 — Holdings and the named-protocol read model ✅ COMPLETE

> Done 2026-08-07. Tasks 6–7 landed: `findHoldingsAsOf` (6 tests, in
> `PrismaPropertyAssetRepository.holdings.test.ts` per the repo's suffixed-file convention) and
> `GetNamedProtocolUseCase` (14 tests). Full suite 2842 pass; typecheck and lint clean.

### Task 6: `findHoldingsAsOf`

**Files:**

- Modify: `src/domain/organization/PropertyAssetRepository.ts`
- Modify: `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`
- Test: `src/infrastructure/repositories/__tests__/PrismaPropertyAssetRepository.test.ts` (create if absent)

**Interfaces:**

- Produces: `HoldingRow { userId, propertyName, assetName, size, sizeUnit, share }` and
  `findHoldingsAsOf({ organizationIds, propertyIds, userIds, asOf }): Promise<Result<HoldingRow[], string>>`, sorted by property name then asset name.

- [ ] **Step 1: Declare the interface**

In `src/domain/organization/PropertyAssetRepository.ts`, add above `export interface PropertyAssetRepository`:

```typescript
// One owned asset, as it stood at a point in time. Feeds the named protocol's
// participant register, which must describe the holdings that produced the
// weight printed beside them — not whatever the person owns today.
export interface HoldingRow {
  userId: string;
  propertyName: string;
  assetName: string;
  size: number;
  sizeUnit: string;
  share: number;
}
```

and inside the interface, after `findAssetsInScope`:

```typescript
  // Point-in-time ownership for a fixed set of users. `asOf` is normally a
  // poll participant's snapshotAt. External-owner rows (userId null) are
  // excluded — they have no participant to attribute holdings to.
  findHoldingsAsOf(input: {
    organizationIds: string[];
    propertyIds: string[];
    userIds: string[];
    asOf: Date;
  }): Promise<Result<HoldingRow[], string>>;
```

- [ ] **Step 2: Write the failing test**

Create `src/infrastructure/repositories/__tests__/PrismaPropertyAssetRepository.test.ts` (or append if it exists):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PrismaPropertyAssetRepository } from '../PrismaPropertyAssetRepository';

function makeRepo(rows: any[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma = { propertyAssetOwnership: { findMany } } as any;

  return { repo: new PrismaPropertyAssetRepository(prisma), findMany };
}

const asOf = new Date('2026-03-01T00:00:00Z');

describe('PrismaPropertyAssetRepository.findHoldingsAsOf', () => {
  it('short-circuits with no users', async () => {
    const { repo, findMany } = makeRepo([]);

    const result = await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: [],
      asOf,
    });

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters on the as-of window and excludes archived rows', async () => {
    const { repo, findMany } = makeRepo([]);

    await repo.findHoldingsAsOf({
      organizationIds: ['org-1', 'org-2'],
      propertyIds: ['prop-1'],
      userIds: ['user-1'],
      asOf,
    });

    const where = findMany.mock.calls[0][0].where;

    expect(where.userId).toEqual({ in: ['user-1'] });
    expect(where.effectiveFrom).toEqual({ lte: asOf });
    expect(where.OR).toEqual([
      { effectiveUntil: null },
      { effectiveUntil: { gt: asOf } },
    ]);
    expect(where.asset.archivedAt).toBeNull();
    expect(where.asset.property.archivedAt).toBeNull();
    expect(where.asset.property.organizationId).toEqual({
      in: ['org-1', 'org-2'],
    });
    expect(where.asset.property.id).toEqual({ in: ['prop-1'] });
  });

  it('omits the property filter when the poll has no scope', async () => {
    const { repo, findMany } = makeRepo([]);

    await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: ['user-1'],
      asOf,
    });

    expect(findMany.mock.calls[0][0].where.asset.property.id).toBeUndefined();
  });

  it('maps decimals to numbers and sorts by property then asset', async () => {
    const { repo } = makeRepo([
      {
        userId: 'user-1',
        share: '0.5',
        asset: {
          name: 'кв. 738',
          size: '64',
          property: { name: 'Дом Гвардейский 13', sizeUnit: 'SQUARE_METERS' },
        },
      },
      {
        userId: 'user-1',
        share: '1',
        asset: {
          name: 'кв. 12',
          size: '18',
          property: { name: 'Дом Гвардейский 13', sizeUnit: 'SQUARE_METERS' },
        },
      },
    ]);

    const result = await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: ['user-1'],
      asOf,
    });

    expect(result.success).toBe(true);
    expect(result.value).toEqual([
      {
        userId: 'user-1',
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 12',
        size: 18,
        sizeUnit: 'SQUARE_METERS',
        share: 1,
      },
      {
        userId: 'user-1',
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 738',
        size: 64,
        sizeUnit: 'SQUARE_METERS',
        share: 0.5,
      },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaPropertyAssetRepository.test.ts`
Expected: FAIL — `repo.findHoldingsAsOf is not a function`

- [ ] **Step 4: Implement**

In `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`, import `HoldingRow` alongside the other types from the domain interface, and add the method after `findAssetsInScope`:

```typescript
  async findHoldingsAsOf(input: {
    organizationIds: string[];
    propertyIds: string[];
    userIds: string[];
    asOf: Date;
  }): Promise<Result<HoldingRow[], string>> {
    try {
      if (input.userIds.length === 0 || input.organizationIds.length === 0) {
        return success([]);
      }

      // SCD-2 window: the row was already in force at `asOf` and had not yet
      // been end-dated. `effectiveUntil` is exclusive, matching replaceOwners,
      // which stamps the old row and the new row with the same instant.
      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        userId: { in: input.userIds },
        effectiveFrom: { lte: input.asOf },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gt: input.asOf } },
        ],
        asset: {
          archivedAt: null,
          property: {
            archivedAt: null,
            organizationId: { in: input.organizationIds },
            ...(input.propertyIds.length > 0
              ? { id: { in: input.propertyIds } }
              : {}),
          },
        },
      };

      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: {
          asset: {
            include: { property: { select: { name: true, sizeUnit: true } } },
          },
        },
      });

      const holdings: HoldingRow[] = rows.map((r) => ({
        userId: r.userId as string,
        propertyName: r.asset.property.name,
        assetName: r.asset.name,
        size: Number(r.asset.size),
        sizeUnit: r.asset.property.sizeUnit,
        share: Number(r.share),
      }));

      // Sorted here rather than in SQL: ordering across two nested to-one
      // relations is fragile in Prisma, and the row count per poll is small.
      holdings.sort(
        (a, b) =>
          a.propertyName.localeCompare(b.propertyName) ||
          a.assetName.localeCompare(b.assetName)
      );

      return success(holdings);
    } catch (e) {
      return failure((e as Error).message);
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaPropertyAssetRepository.test.ts`
Expected: PASS

- [ ] **Step 6: Stage**

```bash
git add src/domain/organization/PropertyAssetRepository.ts \
        src/infrastructure/repositories/PrismaPropertyAssetRepository.ts \
        src/infrastructure/repositories/__tests__/PrismaPropertyAssetRepository.test.ts
```

---

### Task 7: `GetNamedProtocolUseCase`

**Files:**

- Create: `src/application/poll/GetNamedProtocolUseCase.ts`
- Create: `src/application/poll/__tests__/GetNamedProtocolUseCase.test.ts`

**Interfaces:**

- Consumes: `PollResultsPolicy` (Task 2), `findHoldingsAsOf` (Task 6), `isOwnershipMode` from `domain/poll/DistributionType`.
- Produces: the exported types `NamedProtocolHolding`, `NamedProtocolPerson`, `NamedProtocolAnswer`, `NamedProtocolQuestion`, `GetNamedProtocolResult`, and the class `GetNamedProtocolUseCase` with
  `execute({ pollId, userId }): Promise<Result<GetNamedProtocolResult, string>>`.

- [ ] **Step 1: Write the failing test**

Create `src/application/poll/__tests__/GetNamedProtocolUseCase.test.ts`. Build the fixtures the same way `GetPollResultsUseCase.test.ts` does — `Poll.create(...)` then poke ids and state through `(x as any).props`.

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetNamedProtocolUseCase } from '../GetNamedProtocolUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollState } from '../../../domain/poll/PollState';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { success } from '../../../domain/shared/Result';

const SNAPSHOT_AT = new Date('2026-02-01T00:00:00Z');

describe('GetNamedProtocolUseCase', () => {
  let deps: any;
  let poll: Poll;
  let useCase: GetNamedProtocolUseCase;

  function build() {
    return new GetNamedProtocolUseCase(
      deps.pollRepository,
      deps.participantRepository,
      deps.voteRepository,
      deps.organizationRepository,
      deps.userRepository,
      deps.propertyAssetRepository
    );
  }

  beforeEach(() => {
    poll = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      null,
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    ).value;
    (poll as any).props.id = 'poll-1';
    (poll as any).props.state = PollState.FINISHED;

    const question = Question.create(
      'Q1',
      'poll-1',
      1,
      0,
      'single-choice'
    ).value;
    (question as any).props.id = 'question-1';

    const answer1 = Answer.create('Yes', 1, 'question-1').value;
    (answer1 as any).props.id = 'answer-1';
    const answer2 = Answer.create('No', 2, 'question-1').value;
    (answer2 as any).props.id = 'answer-2';
    (question as any).props.answers = [answer1, answer2];
    (poll as any).props.questions = [question];

    const p1 = PollParticipant.create('poll-1', 'user-1', 2).value;
    (p1 as any).props.id = 'participant-1';
    (p1 as any).props.snapshotAt = SNAPSHOT_AT;
    const p2 = PollParticipant.create('poll-1', 'user-2', 3).value;
    (p2 as any).props.id = 'participant-2';
    (p2 as any).props.snapshotAt = SNAPSHOT_AT;
    const p3 = PollParticipant.create('poll-1', 'user-3', 1).value;
    (p3 as any).props.id = 'participant-3';
    (p3 as any).props.snapshotAt = SNAPSHOT_AT;

    const vote1 = Vote.create('question-1', 'answer-1', 'user-1', 2).value;
    const vote2 = Vote.create('question-1', 'answer-2', 'user-2', 3).value;

    deps = {
      pollRepository: { getPollById: vi.fn().mockResolvedValue(success(poll)) },
      participantRepository: {
        getParticipants: vi.fn().mockResolvedValue(success([p1, p2, p3])),
        getParticipantByUserAndPoll: vi.fn().mockResolvedValue(success(null)),
      },
      voteRepository: {
        getVotesByPoll: vi.fn().mockResolvedValue(success([vote1, vote2])),
      },
      organizationRepository: {
        isUserAdmin: vi.fn().mockResolvedValue(true),
        isUserMember: vi.fn().mockResolvedValue(true),
        getDescendantIds: vi.fn().mockResolvedValue([]),
      },
      userRepository: {
        isSuperAdmin: vi.fn().mockResolvedValue(false),
        findByIds: vi.fn().mockResolvedValue([
          {
            id: 'user-1',
            firstName: 'Иван',
            lastName: 'Иванов',
            middleName: 'Иванович',
          },
          {
            id: 'user-2',
            firstName: 'Пётр',
            lastName: 'Петров',
            middleName: null,
          },
          {
            id: 'user-3',
            firstName: 'Сергей',
            lastName: 'Волков',
            middleName: null,
          },
        ]),
      },
      propertyAssetRepository: {
        findHoldingsAsOf: vi.fn().mockResolvedValue(success([])),
      },
    };

    useCase = build();
  });

  it('refuses on an anonymous poll', async () => {
    (poll as any).props.anonymous = true;

    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_IS_ANONYMOUS);
  });

  it('refuses an outsider on a named poll', async () => {
    deps.organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    deps.organizationRepository.isUserMember = vi.fn().mockResolvedValue(false);
    useCase = build();

    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
  });

  it('builds a register of every participant sorted by name', async () => {
    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

    expect(result.success).toBe(true);
    expect(result.value.register.map((p) => p.userId)).toEqual([
      'user-3', // Волков
      'user-1', // Иванов
      'user-2', // Петров
    ]);
    expect(result.value.register[1].weight).toBe(2);
    expect(result.value.totalParticipants).toBe(3);
    expect(result.value.totalParticipantWeight).toBe(6);
  });

  it('lists per-answer voters and the non-voters for the question', async () => {
    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });
    const q = result.value.questions[0];

    expect(q.answers[0].voters).toEqual([{ userId: 'user-1', weight: 2 }]);
    expect(q.answers[1].voters).toEqual([{ userId: 'user-2', weight: 3 }]);
    expect(q.nonVoterIds).toEqual(['user-3']);
    expect(q.participantWeight).toBe(5);
  });

  it('counts a multi-choice voter once in participantWeight', async () => {
    const extra = Vote.create('question-1', 'answer-2', 'user-1', 2).value;
    deps.voteRepository.getVotesByPoll = vi
      .fn()
      .mockResolvedValue(
        success([
          Vote.create('question-1', 'answer-1', 'user-1', 2).value,
          extra,
          Vote.create('question-1', 'answer-2', 'user-2', 3).value,
        ])
      );
    useCase = build();

    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });
    const q = result.value.questions[0];

    expect(q.participantWeight).toBe(5);
    expect(q.totalVotes).toBe(3);
    expect(q.nonVoterIds).toEqual(['user-3']);
  });

  it('leaves nonVoterIds empty for an open poll', async () => {
    (poll as any).props.pollType = 'OPEN';

    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

    expect(result.value.questions[0].nonVoterIds).toEqual([]);
  });

  it('skips the holdings query entirely for an EQUAL poll', async () => {
    await useCase.execute({ pollId: 'poll-1', userId: 'u' });

    expect(
      deps.propertyAssetRepository.findHoldingsAsOf
    ).not.toHaveBeenCalled();
  });

  it('reads holdings at the snapshot, in the poll property scope', async () => {
    (poll as any).props.distributionType = 'OWNERSHIP_SIZE_WEIGHTED';
    (poll as any).props.propertyIds = ['prop-1'];
    deps.organizationRepository.getDescendantIds = vi
      .fn()
      .mockResolvedValue(['org-child']);
    deps.propertyAssetRepository.findHoldingsAsOf = vi.fn().mockResolvedValue(
      success([
        {
          userId: 'user-1',
          propertyName: 'Дом Гвардейский 13',
          assetName: 'кв. 738',
          size: 64,
          sizeUnit: 'SQUARE_METERS',
          share: 1,
        },
      ])
    );
    useCase = build();

    const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

    expect(deps.propertyAssetRepository.findHoldingsAsOf).toHaveBeenCalledWith({
      organizationIds: ['org-1', 'org-child'],
      propertyIds: ['prop-1'],
      userIds: ['user-1', 'user-2', 'user-3'],
      asOf: SNAPSHOT_AT,
    });
    expect(
      result.value.register.find((p) => p.userId === 'user-1')!.holdings
    ).toHaveLength(1);
    expect(
      result.value.register.find((p) => p.userId === 'user-2')!.holdings
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/application/poll/__tests__/GetNamedProtocolUseCase.test.ts`
Expected: FAIL — cannot resolve `../GetNamedProtocolUseCase`

- [ ] **Step 3: Implement**

Create `src/application/poll/GetNamedProtocolUseCase.ts`:

```typescript
import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { Vote } from '../../domain/poll/Vote';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import {
  PropertyAssetRepository,
  HoldingRow,
} from '../../domain/organization/PropertyAssetRepository';
import {
  PollResultsPolicy,
  ResultsViewerFacts,
} from '../../domain/poll/PollResultsPolicy';
import {
  DistributionType,
  isOwnershipMode,
} from '../../domain/poll/DistributionType';
import { PollErrors } from './PollErrors';

export interface GetNamedProtocolInput {
  pollId: string;
  userId: string;
}

export interface NamedProtocolHolding {
  propertyName: string;
  assetName: string;
  size: number;
  // Translation key, e.g. 'propertyAdmin.sizeUnit.squareMeters'. Resolved by
  // the presentation layer so the protocol renders in the reader's language.
  sizeUnitKey: string;
  // 1 = sole owner. Anything below is a shared asset.
  share: number;
}

export interface NamedProtocolPerson {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  weight: number;
  holdings: NamedProtocolHolding[];
}

export interface NamedProtocolAnswer {
  answerId: string;
  answerText: string;
  voteCount: number;
  totalWeight: number;
  percentage: number;
  // References into `register` — the holdings are printed there once, not
  // repeated under every answer a multi-choice voter ticked.
  voters: Array<{ userId: string; weight: number }>;
}

export interface NamedProtocolQuestion {
  questionId: string;
  questionText: string;
  questionDetails: string | null;
  questionType: string;
  answers: NamedProtocolAnswer[];
  totalVotes: number;
  totalWeight: number;
  participantWeight: number;
  // Empty for open polls: they have no fixed electorate to be absent from.
  nonVoterIds: string[];
}

export interface GetNamedProtocolResult {
  poll: Poll;
  register: NamedProtocolPerson[];
  questions: NamedProtocolQuestion[];
  totalParticipants: number;
  totalParticipantWeight: number;
}

function sizeUnitKey(sizeUnit: string): string {
  const camel = sizeUnit
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

  return `propertyAdmin.sizeUnit.${camel}`;
}

export class GetNamedProtocolUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private propertyAssetRepository: PropertyAssetRepository
  ) {}

  async execute(
    input: GetNamedProtocolInput
  ): Promise<Result<GetNamedProtocolResult, string>> {
    const { pollId, userId } = input;

    const pollResult = await this.pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    const [isSuperAdmin, isOrganizationAdmin, isMember, participantResult] =
      await Promise.all([
        this.userRepository.isSuperAdmin(userId),
        this.organizationRepository.isUserAdmin(userId, poll.organizationId),
        this.organizationRepository.isUserMember(userId, poll.organizationId),
        this.participantRepository.getParticipantByUserAndPoll(pollId, userId),
      ]);

    const viewerFacts: ResultsViewerFacts = {
      isAdmin: isSuperAdmin || isOrganizationAdmin,
      isOrgMember: isMember,
      isPollVoter: participantResult.success && !!participantResult.value,
    };

    const allowed = PollResultsPolicy.canExportNamedProtocol(poll, viewerFacts);

    if (!allowed.success) {
      return failure(allowed.error);
    }

    const [votesResult, participantsResult] = await Promise.all([
      this.voteRepository.getVotesByPoll(pollId),
      this.participantRepository.getParticipants(pollId),
    ]);

    if (!votesResult.success) {
      return failure(votesResult.error);
    }

    if (!participantsResult.success) {
      return failure(participantsResult.error);
    }

    const votes = votesResult.value;
    const participants = participantsResult.value;

    const totalParticipantWeight = participants.reduce(
      (sum, p) => sum + p.userWeight,
      0
    );

    const users =
      (await this.userRepository.findByIds(
        participants.map((p) => p.userId)
      )) ?? [];
    const usersById = new Map(users.map((u) => [u.id, u]));

    // Holdings only make sense when the weight came from property. An EQUAL
    // poll — including every open poll — skips the query entirely.
    let holdingsByUser = new Map<string, NamedProtocolHolding[]>();

    if (isOwnershipMode(poll.distributionType as DistributionType)) {
      const holdingsResult = await this.loadHoldings(poll, participants);

      if (!holdingsResult.success) {
        return failure(holdingsResult.error);
      }

      holdingsByUser = holdingsResult.value;
    }

    const register: NamedProtocolPerson[] = participants
      .map((p) => {
        const user = usersById.get(p.userId);

        return {
          userId: p.userId,
          firstName: user?.firstName ?? 'Unknown',
          lastName: user?.lastName ?? 'Unknown',
          middleName: user?.middleName ?? null,
          weight: p.userWeight,
          holdings: holdingsByUser.get(p.userId) ?? [],
        };
      })
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          (a.middleName ?? '').localeCompare(b.middleName ?? '')
      );

    const votesByQuestion = new Map<string, Vote[]>();

    for (const vote of votes) {
      const bucket = votesByQuestion.get(vote.questionId);

      if (bucket) {
        bucket.push(vote);
      } else {
        votesByQuestion.set(vote.questionId, [vote]);
      }
    }

    const participantIds = participants.map((p) => p.userId);
    const questions: NamedProtocolQuestion[] = [];

    for (const question of poll.questions) {
      if (question.isArchived()) {
        continue;
      }

      const questionVotes = votesByQuestion.get(question.id) ?? [];
      const votesByAnswer = new Map<string, Vote[]>();

      for (const vote of questionVotes) {
        const bucket = votesByAnswer.get(vote.answerId);

        if (bucket) {
          bucket.push(vote);
        } else {
          votesByAnswer.set(vote.answerId, [vote]);
        }
      }

      const answers: NamedProtocolAnswer[] = [];

      for (const answer of question.answers) {
        if (answer.isArchived()) {
          continue;
        }

        const answerVotes = votesByAnswer.get(answer.id) ?? [];
        const totalWeight = answerVotes.reduce(
          (sum, v) => sum + v.userWeight,
          0
        );

        answers.push({
          answerId: answer.id,
          answerText: answer.text,
          voteCount: answerVotes.length,
          totalWeight,
          percentage:
            totalParticipantWeight > 0
              ? (totalWeight / totalParticipantWeight) * 100
              : 0,
          voters: answerVotes.map((v) => ({
            userId: v.userId,
            weight: v.userWeight,
          })),
        });
      }

      // Dedupe by userId — a multi-choice voter casting N votes contributes
      // their weight to participation only once.
      const uniqueVoterWeights = new Map<string, number>();

      for (const v of questionVotes) {
        if (!uniqueVoterWeights.has(v.userId)) {
          uniqueVoterWeights.set(v.userId, v.userWeight);
        }
      }

      questions.push({
        questionId: question.id,
        questionText: question.text,
        questionDetails: question.details,
        questionType: question.questionType,
        answers,
        totalVotes: questionVotes.length,
        totalWeight: answers.reduce((sum, a) => sum + a.totalWeight, 0),
        participantWeight: Array.from(uniqueVoterWeights.values()).reduce(
          (sum, w) => sum + w,
          0
        ),
        nonVoterIds: poll.isOpen()
          ? []
          : participantIds.filter((id) => !uniqueVoterWeights.has(id)),
      });
    }

    return success({
      poll,
      register,
      questions,
      totalParticipants: participants.length,
      totalParticipantWeight,
    });
  }

  /**
   * Holdings are read as of each participant's own snapshotAt — the instant
   * that fixed their weight — so the flats printed in the register always
   * explain the weight printed beside them, even after a sale. Participants
   * normally share one snapshot, so this is usually a single query.
   */
  private async loadHoldings(
    poll: Poll,
    participants: Array<{ userId: string; snapshotAt: Date }>
  ): Promise<Result<Map<string, NamedProtocolHolding[]>, string>> {
    const descendantIds = await this.organizationRepository.getDescendantIds(
      poll.organizationId
    );
    const organizationIds = [poll.organizationId, ...descendantIds];

    const bySnapshot = new Map<number, string[]>();

    for (const p of participants) {
      const key = p.snapshotAt.getTime();
      const bucket = bySnapshot.get(key);

      if (bucket) {
        bucket.push(p.userId);
      } else {
        bySnapshot.set(key, [p.userId]);
      }
    }

    const holdingsByUser = new Map<string, NamedProtocolHolding[]>();

    for (const [time, userIds] of bySnapshot) {
      const rowsResult = await this.propertyAssetRepository.findHoldingsAsOf({
        organizationIds,
        propertyIds: poll.propertyIds,
        userIds,
        asOf: new Date(time),
      });

      if (!rowsResult.success) {
        return failure(rowsResult.error);
      }

      for (const row of rowsResult.value as HoldingRow[]) {
        const holding: NamedProtocolHolding = {
          propertyName: row.propertyName,
          assetName: row.assetName,
          size: row.size,
          sizeUnitKey: sizeUnitKey(row.sizeUnit),
          share: row.share,
        };
        const bucket = holdingsByUser.get(row.userId);

        if (bucket) {
          bucket.push(holding);
        } else {
          holdingsByUser.set(row.userId, [holding]);
        }
      }
    }

    return success(holdingsByUser);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/application/poll/__tests__/GetNamedProtocolUseCase.test.ts`
Expected: PASS

- [ ] **Step 5: Stage and mark Phase 3 complete in this file, then STOP for review.**

```bash
git add src/application/poll/GetNamedProtocolUseCase.ts \
        src/application/poll/__tests__/GetNamedProtocolUseCase.test.ts
```

---

## Phase 4 — The named protocol document ✅ COMPLETE

> Done 2026-08-07. Tasks 8–9 landed: `namedProtocolPdfGenerator` (20 tests), `/results/named-pdf` route
> (8 wiring tests), `ExportNamedProtocolPdfButton`, and the existing `/results/pdf` route switched from
> its hardcoded `isFinished()` gate to `PollResultsPolicy.canExportProtocol`. All Phase 4 and Phase 5
> messages added to both locales (29 `namedPdf` keys, verified at parity). Full suite 2870 pass;
> typecheck and lint clean. Additionally smoke-tested real pdfmake rendering — 23,660-byte PDF, text
> extracted and checked for Cyrillic, the preliminary marker, holdings with share suffix, winner mark
> and the did-not-vote block.

### Task 8: `namedProtocolPdfGenerator`

**Files:**

- Create: `src/web/lib/pdf/namedProtocolPdfGenerator.ts`
- Create: `src/web/lib/pdf/namedProtocolPdfGenerator.test.ts`
- Modify: `messages/en.json`, `messages/ru.json`

Read `src/web/lib/pdf/pollResultsPdfGenerator.ts` and `src/web/lib/pdf/protocolSignersPdfGenerator.ts` first, and follow their structure exactly — same page setup, same `styles` block, same footer function, same `determineWinner` rule (single-choice only, unique maximum weight). Reuse `generatePdfBuffer` from `pollResultsPdfGenerator`; do not write a second one.

**Interfaces:**

- Consumes: `GetNamedProtocolResult` (Task 7) — the route flattens it into `NamedProtocolPdfInput`.
- Produces: `NamedProtocolPdfInput`, `NamedProtocolPdfTranslations`, `buildNamedProtocolPdfDefinition(data, t)`.

- [ ] **Step 1: Add the messages**

`messages/en.json`, under `poll.results`, add `"exportNamedPdf": "Export named protocol"` and a new `namedPdf` object:

```json
"namedPdf": {
  "exporting": "Exporting…",
  "title": "NAMED VOTING PROTOCOL",
  "preliminary": "PRELIMINARY",
  "organization": "Organization",
  "board": "Board",
  "pollName": "Poll",
  "description": "Description",
  "period": "Period",
  "register": "PARTICIPANT REGISTER",
  "columnNumber": "No.",
  "columnFullName": "Full name",
  "columnHoldings": "Property",
  "columnWeight": "Weight",
  "share": "share {percent}%",
  "question": "Question {number}. {text}",
  "questionType": "Question type",
  "singleChoice": "single choice",
  "multipleChoice": "multiple choice",
  "answerLine": "{number}. {text} — {votes} votes, weight {weight} ({percentage}%)",
  "winnerMark": "adopted",
  "didNotVote": "Did not vote ({count})",
  "chairman": "Chairman",
  "secretary": "Secretary",
  "date": "Date",
  "stamp": "Seal",
  "pageOf": "Page {current} of {total}",
  "generatedOn": "Generated on {date}"
}
```

`messages/ru.json`, same shape:

```json
"exportNamedPdf": "Выгрузить поимённый протокол",
"namedPdf": {
  "exporting": "Выгрузка…",
  "title": "ПОИМЁННЫЙ ПРОТОКОЛ",
  "preliminary": "ПРЕДВАРИТЕЛЬНЫЙ",
  "organization": "Организация",
  "board": "Правление",
  "pollName": "Голосование",
  "description": "Описание",
  "period": "Период",
  "register": "РЕЕСТР УЧАСТНИКОВ",
  "columnNumber": "№",
  "columnFullName": "ФИО",
  "columnHoldings": "Собственность",
  "columnWeight": "Вес",
  "share": "доля {percent}%",
  "question": "Вопрос {number}. {text}",
  "questionType": "Тип вопроса",
  "singleChoice": "одиночный выбор",
  "multipleChoice": "множественный выбор",
  "answerLine": "{number}. {text} — голосов: {votes}, вес {weight} ({percentage}%)",
  "winnerMark": "принято",
  "didNotVote": "Не голосовали ({count})",
  "chairman": "Председатель",
  "secretary": "Секретарь",
  "date": "Дата",
  "stamp": "М.П.",
  "pageOf": "Страница {current} из {total}",
  "generatedOn": "Сформировано {date}"
}
```

Also add the vote-page and badge keys now, so Phase 5 has them:

`messages/en.json` under `poll`:

```json
"anonymous": {
  "label": "Anonymous poll",
  "description": "Only administrators will see how each person voted, and nobody can open the results until the poll is finished. Leave this off and every member can read the named protocol while the vote is running. This cannot be changed later.",
  "namedBadge": "Named",
  "anonymousBadge": "Anonymous"
}
```

under `poll.voting`:

```json
"namedNotice": "This poll is not anonymous. Your name will be listed next to the answers you choose, in a protocol every member of the organization can read.",
"namedNoticeProperty": "This poll is not anonymous. Your name and your property in the organization (building, unit, area) will be listed next to the answers you choose, in a protocol every member of the organization can read."
```

under `poll.results`:

```json
"preliminaryNote": "The poll is still running — these results are preliminary and any protocol exported now is marked as such."
```

Russian equivalents:

```json
"anonymous": {
  "label": "Анонимное голосование",
  "description": "Кто и как проголосовал, увидят только администраторы, а результаты будут закрыты до завершения голосования. Если выключено — любой участник организации сможет открыть поимённый протокол уже во время голосования. Изменить потом нельзя.",
  "namedBadge": "Поимённое",
  "anonymousBadge": "Анонимное"
}
```

```json
"namedNotice": "Это голосование не анонимное. Ваше имя будет указано рядом с выбранными ответами в протоколе, доступном каждому участнику организации.",
"namedNoticeProperty": "Это голосование не анонимное. Ваше имя и ваша собственность в организации (дом, помещение, площадь) будут указаны рядом с выбранными ответами в протоколе, доступном каждому участнику организации."
```

```json
"preliminaryNote": "Голосование ещё идёт — результаты предварительные, и выгруженный сейчас протокол помечается как предварительный."
```

- [ ] **Step 2: Write the failing test**

Create `src/web/lib/pdf/namedProtocolPdfGenerator.test.ts`. Follow the assertion style of `pollResultsPdfGenerator.test.ts` — walk the returned doc definition and assert on its content, using a `JSON.stringify(doc)` haystack for presence checks.

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildNamedProtocolPdfDefinition,
  NamedProtocolPdfInput,
  NamedProtocolPdfTranslations,
} from './namedProtocolPdfGenerator';

const t: NamedProtocolPdfTranslations = {
  title: 'ПОИМЁННЫЙ ПРОТОКОЛ',
  preliminary: 'ПРЕДВАРИТЕЛЬНЫЙ',
  organization: 'Организация',
  board: 'Правление',
  pollName: 'Голосование',
  description: 'Описание',
  period: 'Период',
  register: 'РЕЕСТР УЧАСТНИКОВ',
  columnNumber: '№',
  columnFullName: 'ФИО',
  columnHoldings: 'Собственность',
  columnWeight: 'Вес',
  share: 'доля {percent}%',
  question: 'Вопрос {number}. {text}',
  questionType: 'Тип вопроса',
  singleChoice: 'одиночный выбор',
  multipleChoice: 'множественный выбор',
  answerLine:
    '{number}. {text} — голосов: {votes}, вес {weight} ({percentage}%)',
  winnerMark: 'принято',
  didNotVote: 'Не голосовали ({count})',
  chairman: 'Председатель',
  secretary: 'Секретарь',
  date: 'Дата',
  stamp: 'М.П.',
  pageOf: 'Страница {current} из {total}',
  generatedOn: 'Сформировано {date}',
  sizeUnits: { 'propertyAdmin.sizeUnit.squareMeters': 'м²' },
};

function baseData(
  overrides: Partial<NamedProtocolPdfInput> = {}
): NamedProtocolPdfInput {
  return {
    organizationName: 'ТСЖ Гвардейское',
    boardName: null,
    pollTitle: 'Бюджет 2026',
    pollDescription: 'Описание',
    startDate: '2026-01-15',
    endDate: '2026-02-15',
    isPreliminary: false,
    isPropertyBased: false,
    isOpenPoll: false,
    totalParticipants: 2,
    totalParticipantWeight: 3,
    register: [
      {
        userId: 'user-1',
        fullName: 'Иванов И. И.',
        weight: 2,
        holdings: [],
      },
      {
        userId: 'user-2',
        fullName: 'Петров П. С.',
        weight: 1,
        holdings: [],
      },
    ],
    questions: [
      {
        questionText: 'Утвердить бюджет?',
        questionDetails: null,
        questionType: 'single-choice',
        totalVotes: 1,
        totalWeight: 2,
        answers: [
          {
            answerText: 'Да',
            voteCount: 1,
            totalWeight: 2,
            percentage: 66.67,
            voters: [{ userId: 'user-1', weight: 2 }],
          },
          {
            answerText: 'Нет',
            voteCount: 0,
            totalWeight: 0,
            percentage: 0,
            voters: [],
          },
        ],
        nonVoterIds: ['user-2'],
      },
    ],
    ...overrides,
  };
}

const dump = (d: unknown) => JSON.stringify(d);

describe('buildNamedProtocolPdfDefinition', () => {
  it('names the voters under the answer they chose', () => {
    const doc = dump(buildNamedProtocolPdfDefinition(baseData(), t));

    expect(doc).toContain('Иванов И. И.');
    expect(doc).toContain('Утвердить бюджет?');
  });

  it('lists the non-voters with a count', () => {
    const doc = dump(buildNamedProtocolPdfDefinition(baseData(), t));

    expect(doc).toContain('Не голосовали (1)');
    expect(doc).toContain('Петров П. С.');
  });

  it('omits the non-voter block for an open poll', () => {
    const doc = dump(
      buildNamedProtocolPdfDefinition(
        baseData({ isOpenPoll: true, questions: baseData().questions }),
        t
      )
    );

    expect(doc).not.toContain('Не голосовали');
  });

  it('marks a preliminary export', () => {
    expect(
      dump(
        buildNamedProtocolPdfDefinition(baseData({ isPreliminary: true }), t)
      )
    ).toContain('ПРЕДВАРИТЕЛЬНЫЙ');
  });

  it('leaves a finished export unmarked', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).not.toContain(
      'ПРЕДВАРИТЕЛЬНЫЙ'
    );
  });

  it('omits the holdings column for a non-property poll', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).not.toContain(
      'Собственность'
    );
  });

  it('renders holdings with the translated unit', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 738',
        size: 64,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 1,
      },
    ];

    const doc = dump(buildNamedProtocolPdfDefinition(data, t));

    expect(doc).toContain('Собственность');
    expect(doc).toContain('Дом Гвардейский 13, кв. 738, 64 м²');
    expect(doc).not.toContain('доля');
  });

  it('appends a share suffix only for partial ownership', () => {
    const data = baseData({ isPropertyBased: true });
    data.register[0].holdings = [
      {
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 12',
        size: 18,
        sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
        share: 0.5,
      },
    ];

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).toContain(
      'доля 50%'
    );
  });

  it('marks the unique single-choice winner', () => {
    expect(dump(buildNamedProtocolPdfDefinition(baseData(), t))).toContain(
      'принято'
    );
  });

  it('marks no winner on a tie', () => {
    const data = baseData();
    data.questions[0].answers[1].totalWeight = 2;
    data.questions[0].answers[1].voteCount = 1;

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).not.toContain(
      'принято'
    );
  });

  it('marks no winner on a multiple-choice question', () => {
    const data = baseData();
    data.questions[0].questionType = 'multiple-choice';

    expect(dump(buildNamedProtocolPdfDefinition(data, t))).not.toContain(
      'принято'
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test src/web/lib/pdf/namedProtocolPdfGenerator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement**

Create `src/web/lib/pdf/namedProtocolPdfGenerator.ts` exporting:

```typescript
export interface NamedProtocolPdfHolding {
  propertyName: string;
  assetName: string;
  size: number;
  sizeUnitKey: string;
  share: number;
}

export interface NamedProtocolPdfPerson {
  userId: string;
  fullName: string;
  weight: number;
  holdings: NamedProtocolPdfHolding[];
}

export interface NamedProtocolPdfAnswer {
  answerText: string;
  voteCount: number;
  totalWeight: number;
  percentage: number;
  voters: Array<{ userId: string; weight: number }>;
}

export interface NamedProtocolPdfQuestion {
  questionText: string;
  questionDetails: string | null;
  questionType: string;
  totalVotes: number;
  totalWeight: number;
  answers: NamedProtocolPdfAnswer[];
  nonVoterIds: string[];
}

export interface NamedProtocolPdfInput {
  organizationName: string;
  boardName: string | null;
  pollTitle: string;
  pollDescription: string;
  startDate: string;
  endDate: string;
  isPreliminary: boolean;
  isPropertyBased: boolean;
  isOpenPoll: boolean;
  totalParticipants: number;
  totalParticipantWeight: number;
  register: NamedProtocolPdfPerson[];
  questions: NamedProtocolPdfQuestion[];
}

export interface NamedProtocolPdfTranslations {
  title: string;
  preliminary: string;
  organization: string;
  board: string;
  pollName: string;
  description: string;
  period: string;
  register: string;
  columnNumber: string;
  columnFullName: string;
  columnHoldings: string;
  columnWeight: string;
  share: string;
  question: string;
  questionType: string;
  singleChoice: string;
  multipleChoice: string;
  answerLine: string;
  winnerMark: string;
  didNotVote: string;
  chairman: string;
  secretary: string;
  date: string;
  stamp: string;
  pageOf: string;
  generatedOn: string;
  // Pre-resolved 'propertyAdmin.sizeUnit.*' → label. The route flattens the
  // message file into this so the generator stays free of next-intl.
  sizeUnits: Record<string, string>;
}

export function buildNamedProtocolPdfDefinition(
  data: NamedProtocolPdfInput,
  t: NamedProtocolPdfTranslations
): TDocumentDefinitions;
```

Write these four helpers verbatim — they carry the behaviour the tests assert:

```typescript
// The message files use next-intl's {placeholder} syntax, but this generator
// runs outside React and is handed raw strings, so it interpolates itself.
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

// share is Decimal(9,8): 0.5 → "50", 0.3333 → "33.33". No trailing zeros —
// "доля 50%" reads as a legal statement, "доля 50.00%" reads as a spreadsheet.
function formatShare(share: number): string {
  return String(Number((share * 100).toFixed(2)));
}

function formatHoldings(
  holdings: NamedProtocolPdfHolding[],
  t: NamedProtocolPdfTranslations
): string {
  return holdings
    .map((h) => {
      const unit = t.sizeUnits[h.sizeUnitKey] ?? '';
      const base =
        `${h.propertyName}, ${h.assetName}, ${h.size} ${unit}`.trim();

      // A whole asset needs no qualifier; a shared one must say so, because
      // the weight beside it is only that fraction of the area.
      return h.share < 1
        ? `${base}, ${fill(t.share, { percent: formatShare(h.share) })}`
        : base;
    })
    .join('; ');
}

// Same rule as the existing protocol: single-choice only, and only when one
// answer strictly leads. A tie is not a decision.
function determineWinner(
  question: NamedProtocolPdfQuestion
): NamedProtocolPdfAnswer | null {
  if (question.questionType !== 'single-choice') {
    return null;
  }

  if (question.answers.length === 0) {
    return null;
  }

  const maxWeight = Math.max(...question.answers.map((a) => a.totalWeight));

  if (maxWeight <= 0) {
    return null;
  }

  const top = question.answers.filter((a) => a.totalWeight === maxWeight);

  return top.length === 1 ? top[0] : null;
}
```

Remaining structural requirements — every one is covered by a test above:

1. **Register lookup.** Build `const byId = new Map(data.register.map((p) => [p.userId, p]))` once, and resolve every per-answer and non-voter id through it.
2. **Header.** Title line = `t.title`, and when `data.isPreliminary`, a second right-aligned bold red-free `[${t.preliminary}]` marker on the same row. Then a label/value block for organization, board (only when non-null), poll name, description, period.
3. **Register table.** Heading `t.register`. Columns `[t.columnNumber, t.columnFullName, t.columnWeight]`, with `t.columnHoldings` inserted before the weight column **only when `data.isPropertyBased`**. Rows follow `data.register` order (the use case already sorted it). Weights render `toFixed(2)`.
4. **Holdings string.** For each holding: `` `${propertyName}, ${assetName}, ${size} ${t.sizeUnits[sizeUnitKey] ?? ''}` `` trimmed, then when `share < 1` append `, ` + `fill(t.share, { percent: formatShare(share) })`. `formatShare` = `share * 100` rendered with at most two decimals and no trailing zeros (`50`, not `50.00`). Join a person's holdings with `'; '`.
5. **Per-question section.** `fill(t.question, { number, text })`, the type label, then one block per answer: `fill(t.answerLine, { number, text, votes, weight: totalWeight.toFixed(2), percentage: percentage.toFixed(2) })` plus ` — ${t.winnerMark}` when the answer is the winner. Under each answer, a numbered list of `fullName` + weight looked up from the register by `userId`.
6. **Winner rule.** Copy `determineWinner` from `pollResultsPdfGenerator.ts`: single-choice only; the unique maximum `totalWeight`; `null` on a tie or on multiple-choice.
7. **Non-voters.** When `!data.isOpenPoll && question.nonVoterIds.length > 0`, a `fill(t.didNotVote, { count })` heading and a numbered list of those people from the register.
8. **Footer.** Signature row (`t.chairman`, `t.secretary`, `t.date`, `t.stamp`) at the end of `content`; page numbers and `generatedOn` in the `footer` callback, exactly as `pollResultsPdfGenerator` does it.
9. **Fonts.** Reuse the `pdfFonts` setup — Cyrillic must render.

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/web/lib/pdf/namedProtocolPdfGenerator.test.ts`
Expected: PASS

- [ ] **Step 6: Stage**

```bash
git add src/web/lib/pdf/namedProtocolPdfGenerator.ts \
        src/web/lib/pdf/namedProtocolPdfGenerator.test.ts \
        messages/en.json messages/ru.json
```

---

### Task 9: Routes — named PDF, and unblocking the existing protocol

**Files:**

- Create: `src/app/api/polls/[pollId]/results/named-pdf/route.ts`
- Modify: `src/app/api/polls/[pollId]/results/pdf/route.ts`
- Create: `src/web/components/polls/results/ExportNamedProtocolPdfButton.tsx`

**Interfaces:**

- Consumes: `GetNamedProtocolUseCase` (Task 7), `buildNamedProtocolPdfDefinition` (Task 8), `generatePdfBuffer` from `pollResultsPdfGenerator`, `PollResultsPolicy.canExportProtocol` (Task 2), `viewerFacts` from `GetPollResultsResult` (Task 5).
- Produces: `GET /api/polls/:pollId/results/named-pdf?locale=xx`.

- [ ] **Step 1: Write the named-pdf route**

Copy `src/app/api/polls/[pollId]/results/protocol-pdf/route.ts` to
`src/app/api/polls/[pollId]/results/named-pdf/route.ts` and change:

- Instantiate `GetNamedProtocolUseCase` with the six repositories, adding
  `new PrismaPropertyAssetRepository(prisma)` from `@/infrastructure/index`.
- Call it, and on failure return `{ error: await translateErrorCode(result.error) }` with status 403.
  Do **not** add a second permission check — the use case already ran the policy.
- Fetch `org` and `boardName` the same way the source route does.
- Load `messages/<locale>.json`, then build the translations object. The generator must not import
  next-intl, so the route pre-resolves the size-unit labels into a flat lookup keyed by the same
  `sizeUnitKey` strings the use case emits:

```typescript
// 'squareMeters' → 'propertyAdmin.sizeUnit.squareMeters' → 'м²'
function flattenSizeUnits(
  messages: Record<string, any>
): Record<string, string> {
  const units = (messages?.propertyAdmin?.sizeUnit ?? {}) as Record<
    string,
    string
  >;

  return Object.fromEntries(
    Object.entries(units).map(([key, label]) => [
      `propertyAdmin.sizeUnit.${key}`,
      label,
    ])
  );
}

const t: NamedProtocolPdfTranslations = {
  ...loadTranslations(messages, 'poll.results.namedPdf'),
  sizeUnits: flattenSizeUnits(messages),
};
```

`loadTranslations` is the same walk-the-prefix helper both existing PDF routes define; copy it, and
type its return as `Omit<NamedProtocolPdfTranslations, 'sizeUnits'>`.

- Flatten `GetNamedProtocolResult` into `NamedProtocolPdfInput`. `fullName` comes from
  `User.formatFullName(firstName, lastName, middleName)`; `isPreliminary` is `poll.isActive()`;
  `isPropertyBased` is `isOwnershipMode(poll.distributionType as DistributionType)`;
  `isOpenPoll` is `poll.isOpen()`; dates use `toISOString().split('T')[0]` as the source route does.
- Filename: `${sanitizedTitle}-named-protocol.pdf`, same sanitize regex and
  `filename*=UTF-8''` encoding.

- [ ] **Step 2: Unblock the existing protocol for named polls**

In `src/app/api/polls/[pollId]/results/pdf/route.ts`, replace:

```typescript
// 3. Only allow PDF export for finished polls
if (!poll.isFinished()) {
  return NextResponse.json(
    { error: 'poll.errors.notFinished' },
    { status: 400 }
  );
}
```

with:

```typescript
// 3. A named poll may be exported mid-vote; an anonymous one may not.
const exportable = PollResultsPolicy.canExportProtocol(
  poll,
  result.value.viewerFacts
);

if (!exportable.success) {
  return NextResponse.json(
    { error: await translateErrorCode(exportable.error) },
    { status: 403 }
  );
}
```

Destructure `viewerFacts` alongside the other fields and import `PollResultsPolicy` from
`@/domain/poll/PollResultsPolicy`.

- [ ] **Step 3: Write the export button**

Create `src/web/components/polls/results/ExportNamedProtocolPdfButton.tsx` as a copy of
`ExportPdfButton.tsx` with: `useTranslations('poll.results')` for the label
(`t('exportNamedPdf')`) and `useTranslations('poll.results.namedPdf')` for `exporting`;
fetch URL `/api/polls/${pollId}/results/named-pdf?locale=${locale}`; fallback download name
`named-protocol.pdf`.

- [ ] **Step 4: Write the route test**

The use-case test already proves the policy decisions. This test proves the _wiring_: that the route
surfaces a refusal as 403 instead of leaking a document. Follow the module-mock pattern of
`src/app/api/address/__tests__/route.test.ts`.

Create `src/app/api/polls/[pollId]/results/named-pdf/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';

const mockGetCurrentUser = vi.fn();
const mockExecute = vi.fn();
const mockBuildPdf = vi.fn();
const mockGeneratePdfBuffer = vi.fn();

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => code,
}));

vi.mock('@/application/poll/GetNamedProtocolUseCase', () => ({
  GetNamedProtocolUseCase: class {
    execute = mockExecute;
  },
}));

vi.mock('@/web/lib/pdf/namedProtocolPdfGenerator', () => ({
  buildNamedProtocolPdfDefinition: mockBuildPdf,
}));

vi.mock('@/web/lib/pdf/pollResultsPdfGenerator', () => ({
  generatePdfBuffer: mockGeneratePdfBuffer,
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {
    organization: { findUnique: vi.fn().mockResolvedValue({ name: 'ТСЖ' }) },
    board: { findUnique: vi.fn().mockResolvedValue(null) },
  },
  PrismaPollRepository: class {},
  PrismaParticipantRepository: class {},
  PrismaVoteRepository: class {},
  PrismaOrganizationRepository: class {},
  PrismaUserRepository: class {},
  PrismaPropertyAssetRepository: class {},
}));

const { GET } = await import('../route');

const request = {
  nextUrl: { searchParams: new URLSearchParams({ locale: 'ru' }) },
} as unknown as NextRequest;
const params = Promise.resolve({ pollId: 'poll-1' });

describe('GET /api/polls/[pollId]/results/named-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBuildPdf.mockReturnValue({ content: [] });
    mockGeneratePdfBuffer.mockResolvedValue(Buffer.from('pdf'));
  });

  it('401s an anonymous visitor', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('403s when the poll is anonymous, without building a document', async () => {
    mockExecute.mockResolvedValue({
      success: false,
      error: PollDomainCodes.POLL_IS_ANONYMOUS,
    });

    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: PollDomainCodes.POLL_IS_ANONYMOUS,
    });
    expect(mockBuildPdf).not.toHaveBeenCalled();
  });

  it('serves the PDF when the use case allows it', async () => {
    mockExecute.mockResolvedValue({
      success: true,
      value: {
        poll: {
          id: 'poll-1',
          title: 'Бюджет',
          description: 'Описание',
          organizationId: 'org-1',
          boardId: null,
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-02-15'),
          distributionType: 'EQUAL',
          isActive: () => false,
          isOpen: () => false,
        },
        register: [],
        questions: [],
        totalParticipants: 0,
        totalParticipantWeight: 0,
      },
    });

    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(mockBuildPdf).toHaveBeenCalledTimes(1);
  });
});
```

Run: `yarn test "src/app/api/polls/[pollId]/results/named-pdf"`
Expected: PASS. If the route reads a poll field the fake above does not provide, add it to the fake
rather than loosening the assertion.

- [ ] **Step 5: Typecheck and run the suite**

Run: `yarn typecheck && yarn test`
Expected: PASS

- [ ] **Step 6: Stage and mark Phase 4 complete in this file, then STOP for review.**

```bash
git add src/app/api/polls/\[pollId\]/results/named-pdf \
        src/app/api/polls/\[pollId\]/results/pdf/route.ts \
        src/web/components/polls/results/ExportNamedProtocolPdfButton.tsx
```

---

## Phase 5 — User interface ✅ COMPLETE (pending manual UI check)

> Done 2026-08-07. Tasks 10–12 landed: create-form `Switch`, `PollCard` badges + results link opened to
> members on named polls, results page/`PollResults` split onto the two gates plus the named-protocol
> export button and preliminary note, vote-page notice with its property variant.
> Full suite 2870 pass; typecheck, lint, format clean; `yarn build` succeeds and registers
> `/api/polls/[pollId]/results/named-pdf`.
>
> NOT done by me: the browser walkthroughs in Task 10 Step 3, Task 11 Step 4 and Task 12 Step 3 — they
> need a logged-in session. Dev server left running on :8080.

### Task 10: Create form and poll card

**Files:**

- Modify: `src/app/[locale]/polls/create/CreatePollForm.tsx`
- Modify: `src/web/components/polls/PollCard.tsx`

**Interfaces:**

- Consumes: `poll.anonymous` on the poll-list payload (Task 4), `poll.anonymous.*` messages (Task 8).

- [ ] **Step 1: Add the toggle to the create form**

In `CreatePollForm.tsx`:

Import `Switch, SwitchField` from `@/src/web/components/catalyst/switch` and add `Description` to the
existing `fieldset` import.

Add state beside `pollType`:

```typescript
// Opt-in secrecy. Named is the default: the org reads who voted for what
// while the poll runs. Immutable after creation, so it is only ever set here.
const [anonymous, setAnonymous] = useState(false);
```

Render it inside the "Poll Basic Info" card, directly under the poll-type `Field`:

```tsx
<SwitchField>
  <Label>{t('anonymous.label')}</Label>
  <Description>{t('anonymous.description')}</Description>
  <Switch name="anonymous" checked={anonymous} onChange={setAnonymous} />
</SwitchField>
```

In `handleSave`, next to the other `pollFormData.append` calls:

```typescript
pollFormData.append('anonymous', String(anonymous));
```

- [ ] **Step 2: Add the badge and open the results button**

In `PollCard.tsx`:

Add beside the other derived flags:

```typescript
const isAnonymousPoll = !!poll.anonymous;
```

Change:

```typescript
const canViewResultsBeforePollEnds = canManage;
```

to:

```typescript
// A named poll is readable by every member while it runs — the card must
// offer the link, and the results page enforces the rule server-side anyway.
const canViewResultsBeforePollEnds = canManage || !isAnonymousPoll;
```

Add to the badge row, after the `isOpenPoll` badge:

```tsx
<span
  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
    isAnonymousPoll
      ? 'text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800'
      : 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
  }`}
>
  {isAnonymousPoll ? t('anonymous.anonymousBadge') : t('anonymous.namedBadge')}
</span>
```

- [ ] **Step 3: Verify manually**

Run: `yarn dev`, open `/polls/create`, confirm the toggle renders and its description reads correctly in
both languages. Create one poll with it on and one with it off, then confirm the two badges on `/polls`.

- [ ] **Step 4: Stage**

```bash
git add src/app/\[locale\]/polls/create/CreatePollForm.tsx \
        src/web/components/polls/PollCard.tsx
```

---

### Task 11: Results page and `PollResults`

**Files:**

- Modify: `src/app/[locale]/polls/[pollId]/results/page.tsx`
- Modify: `src/web/components/polls/results/PollResults.tsx`

**Interfaces:**

- Consumes: `canViewVoterNames`, `canViewSignWillingness` (Task 5); `ExportNamedProtocolPdfButton` (Task 9).
- Produces: `PollResultsProps` with `canViewVoterNames`, `canViewSignWillingness`, `isAnonymous` replacing `canViewVoters`.

- [ ] **Step 1: Update the page**

In `src/app/[locale]/polls/[pollId]/results/page.tsx`:

Replace the temporary shim from Task 5 with two separate flags:

```typescript
// IMPORTANT: two independent gates. Voter names open up to members on a
// named poll; sign-willingness carries phone numbers under a separate
// consent and stays admin-only in every case.
const canViewVoterNames = results.canViewVoterNames;
const canViewSignWillingness = results.canViewSignWillingness;
```

Change the `voters` mapping to use `canViewVoterNames` and the `protocolSignWillingness` mapping to use
`canViewSignWillingness`. Do **not** put `results.viewerFacts` anywhere in `serializedResults`.

Pass the new props:

```tsx
<PollResults
  results={serializedResults}
  pollState={poll.state}
  isPollCreator={isPollCreator}
  canViewVoterNames={canViewVoterNames}
  canViewSignWillingness={canViewSignWillingness}
  isAnonymous={poll.anonymous}
  buildingTotal={buildingTotal}
  isOpenPoll={poll.pollType === 'OPEN'}
/>
```

- [ ] **Step 2: Update the component**

In `src/web/components/polls/results/PollResults.tsx`:

Replace `canViewVoters: boolean;` in `PollResultsProps` with:

```typescript
canViewVoterNames: boolean;
canViewSignWillingness: boolean;
isAnonymous: boolean;
```

and update the destructuring accordingly. Then:

- The per-answer "view voters" button: `canViewVoterNames && answer.voteCount > 0`.
- The protocol-sign-willingness section: `canViewSignWillingness && ...`.
- Import `ExportNamedProtocolPdfButton` and replace the export row:

```tsx
{
  /* Protocol exports. A named poll may be exported mid-vote; the
            documents are marked preliminary until the poll is finished. */
}
{
  (isFinished || (!isAnonymous && isActive)) && (
    <div className="flex flex-wrap justify-end gap-2">
      <ExportPdfButton pollId={results.pollId} />
      {!isAnonymous && canViewVoterNames && (
        <ExportNamedProtocolPdfButton pollId={results.pollId} />
      )}
    </div>
  );
}
```

- Replace the amber banner block at the bottom:

```tsx
{
  !isFinished && isAnonymous && canViewVoterNames && (
    <div className="rounded-lg border border-amber-200 dark:border-amber-700 p-4 bg-amber-50 dark:bg-amber-950/20">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {t('adminOnly')}
      </p>
    </div>
  );
}

{
  !isFinished && !isAnonymous && (
    <div className="rounded-lg border border-amber-200 dark:border-amber-700 p-4 bg-amber-50 dark:bg-amber-950/20">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {t('preliminaryNote')}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: no errors.

- [ ] **Step 4: Verify manually**

Run: `yarn dev`. As a non-admin member of the org, open an ACTIVE named poll's results: the page must
load, show voter names, show both export buttons and the preliminary note, and show **no**
sign-willingness section. Open an ACTIVE anonymous poll's results as the same user: access must be
refused.

- [ ] **Step 5: Stage**

```bash
git add src/app/\[locale\]/polls/\[pollId\]/results/page.tsx \
        src/web/components/polls/results/PollResults.tsx
```

---

### Task 12: The vote-page notice

**Files:**

- Modify: `src/app/[locale]/polls/[pollId]/vote/page.tsx`
- Modify: `src/web/components/polls/voting/VotingInterface.tsx`

**Interfaces:**

- Consumes: `poll.voting.namedNotice` / `namedNoticeProperty` (Task 8).
- Produces: `VotingInterface` props `isAnonymous: boolean`, `isPropertyBased: boolean`.

- [ ] **Step 1: Pass the facts down**

`src/app/[locale]/polls/[pollId]/vote/page.tsx` already destructures `const { poll, drafts } =
progressResult.data;` and builds `serializedPoll` beside `pollType`. Add both fields there — no new
query:

```tsx
  const serializedPoll = {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    pollType: poll.pollType,
    anonymous: poll.anonymous,
    // The notice has to warn about the property listing too, and only an
    // ownership-weighted poll puts holdings in the named protocol.
    isPropertyBased:
      poll.distributionType === 'OWNERSHIP_UNIT_COUNT' ||
      poll.distributionType === 'OWNERSHIP_SIZE_WEIGHTED',
    questions: poll.questions.map((q: any) => ({
```

(leave the rest of the object as it is), then pass them to the component:

```tsx
<VotingInterface
  poll={serializedPoll}
  userDrafts={serializedDrafts}
  pollId={pollId}
  isAnonymous={serializedPoll.anonymous}
  isPropertyBased={serializedPoll.isPropertyBased}
/>
```

If `poll.anonymous` or `poll.distributionType` arrive `undefined` at runtime, the action behind
`getUserVotingProgressAction` is stripping fields — fix it there, in
`src/web/actions/poll/vote.ts`, rather than re-querying in the page.

- [ ] **Step 2: Render the notice**

In `VotingInterface.tsx`, add the two props to its interface and render above the question area,
inside the existing top-level container:

```tsx
{
  !isAnonymous && (
    <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-700 p-4 bg-amber-50 dark:bg-amber-950/20">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {isPropertyBased ? t('namedNoticeProperty') : t('namedNotice')}
      </p>
    </div>
  );
}
```

using the component's existing `poll.voting` translations hook.

- [ ] **Step 3: Verify manually**

Run: `yarn dev`, open a named poll's vote page — the notice shows; the property variant appears on an
ownership-weighted poll. Open an anonymous poll's vote page — no notice.

- [ ] **Step 4: Full verification**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: all pass, no lint errors.

- [ ] **Step 5: Stage and mark Phase 5 complete in this file, then STOP for review.**

```bash
git add src/app/\[locale\]/polls/\[pollId\]/vote/page.tsx \
        src/web/components/polls/voting/VotingInterface.tsx
```

---

## Verification checklist

Before declaring the feature done, confirm each by running it — not by reading the code:

- [ ] `yarn test` — full suite green
- [ ] `yarn typecheck` — clean
- [ ] `yarn lf` — lint and format clean
- [ ] A member (non-admin) can open an ACTIVE **named** poll's results and download both PDFs
- [ ] The same member is refused an ACTIVE **anonymous** poll's results
- [ ] The named PDF exported mid-vote carries the preliminary marker; the one exported after finishing does not
- [ ] The named PDF of an ownership-weighted poll shows the holdings column; an EQUAL poll's does not
- [ ] The sign-willingness section and its phone numbers appear for admins only, on both kinds of poll
- [ ] `rg -n "canViewVoters" src` returns nothing
