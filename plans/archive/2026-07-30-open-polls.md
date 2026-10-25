# Open Polls (platform-wide voting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any phone-confirmed platform user vote once (weight 1) in an organization's poll of the new `OPEN` type, with no participant snapshot and results computed live from votes cast.

**Architecture:** A `PollType` value object (`ORGANIZATION` | `OPEN`) on the `Poll` aggregate, a `PollVotingPolicy` domain service that decides voting eligibility per type, a snapshot step that becomes validation-only for `OPEN`, and join-on-vote: the `PollParticipant` row (weight 1) is created transactionally together with the voter's votes when they finish voting. Everything downstream (results, protocol willingness, weight history) keeps working unchanged because participants still exist — they just appear later.

**Tech Stack:** TypeScript, Next.js 15 (App Router, server actions), Prisma 7 + PostgreSQL, vitest, next-intl, Tailwind + Catalyst components.

**Spec:** `readmes/2026-07-30-open-polls-design.md`

## Global Constraints

- **Never run `git commit`.** Each task ends by staging with `git add`; the user commits.
- At the end of each **phase**, mark the phase complete in this file and stop for user review.
- TDD: write the failing test first, watch it fail, then implement. Every bug gets a failing test first.
- DDD layering: `src/domain` (no framework/ORM/IO), `src/application` (use cases), `src/infrastructure` (Prisma), `src/web` + `src/app` (server actions, pages, components).
- Errors are **codes**, never messages. New codes must be added to BOTH `messages/en.json` and `messages/ru.json`. Russian is the default language.
- Server actions start with `const rateLimited = await checkRateLimit(); if (rateLimited) return rateLimited;` and translate codes via `translateErrorCode` from `@/web/actions/utils/translateErrorCode`.
- No raw SQL in `src/web/actions/`.
- Never delete rows except membership links, vote drafts, notifications. Archive instead.
- Tailwind v4: every clickable native `<button>`/`<a>` needs `cursor-pointer` (and `disabled:cursor-not-allowed` where applicable).
- Test command: `yarn test <path>` (vitest run). Type check: `yarn typecheck`. Lint+format: `yarn lf`.
- Poll type values are exactly `ORGANIZATION` and `OPEN`.
- An `OPEN` poll always has `boardId = null`, `distributionType = EQUAL`, `propertyAggregation = RAW_SUM`, `propertyIds = []`, and every vote weight is exactly `1`.

---

## Phase 1 — Domain foundation

### Task 1: `PollType` value object and new domain codes

**Files:**

- Create: `src/domain/poll/PollType.ts`
- Create: `src/domain/poll/__tests__/PollType.test.ts`
- Modify: `src/domain/poll/PollDomainCodes.ts`
- Modify: `src/application/poll/PollErrors.ts`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `Result`, `success`, `failure` from `src/domain/shared/Result`.
- Produces: `PollType` (const object + type), `parsePollType(value: string): Result<PollType, string>`; codes `PollDomainCodes.POLL_TYPE_INVALID`, `POLL_OPEN_CANNOT_BE_BOARD_SCOPED`, `POLL_OPEN_MUST_BE_EQUAL`, `USER_NOT_CONFIRMED`; `PollErrors.OPEN_PARTICIPANTS_IMMUTABLE`, `PollErrors.OPEN_CONFIG_FIXED`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/poll/__tests__/PollType.test.ts` (mirrors the existing `DistributionType.test.ts` style):

```ts
import { describe, it, expect } from 'vitest';
import { PollType, parsePollType } from '../PollType';
import { PollDomainCodes } from '../PollDomainCodes';

describe('PollType', () => {
  it('exposes the two supported types', () => {
    expect(PollType.ORGANIZATION).toBe('ORGANIZATION');
    expect(PollType.OPEN).toBe('OPEN');
  });

  it('parses ORGANIZATION', () => {
    const result = parsePollType('ORGANIZATION');
    expect(result.success).toBe(true);
    expect(result.value).toBe(PollType.ORGANIZATION);
  });

  it('parses OPEN', () => {
    const result = parsePollType('OPEN');
    expect(result.success).toBe(true);
    expect(result.value).toBe(PollType.OPEN);
  });

  it('rejects an unknown value with POLL_TYPE_INVALID', () => {
    const result = parsePollType('PUBLIC');
    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_TYPE_INVALID);
  });

  it('rejects an empty value', () => {
    const result = parsePollType('');
    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_TYPE_INVALID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/domain/poll/__tests__/PollType.test.ts`
Expected: FAIL — cannot resolve `../PollType`.

- [ ] **Step 3: Add the new domain codes**

In `src/domain/poll/PollDomainCodes.ts`, add to the `PollDomainCodes` object (after the `// Weight distribution` block):

```ts
  // Poll type
  POLL_TYPE_INVALID: 'domain.poll.pollTypeInvalid',
  POLL_OPEN_CANNOT_BE_BOARD_SCOPED: 'domain.poll.openCannotBeBoardScoped',
  POLL_OPEN_MUST_BE_EQUAL: 'domain.poll.openMustBeEqual',
  USER_NOT_CONFIRMED: 'domain.poll.userNotConfirmed',
```

In `src/application/poll/PollErrors.ts`, add before the closing `} as const;`:

```ts
  OPEN_PARTICIPANTS_IMMUTABLE: 'poll.errors.openParticipantsImmutable',
  OPEN_CONFIG_FIXED: 'poll.errors.openConfigFixed',
```

- [ ] **Step 4: Create the value object**

Create `src/domain/poll/PollType.ts`:

```ts
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export const PollType = {
  ORGANIZATION: 'ORGANIZATION',
  OPEN: 'OPEN',
} as const;

export type PollType = (typeof PollType)[keyof typeof PollType];

export function parsePollType(value: string): Result<PollType, string> {
  if (value === PollType.ORGANIZATION || value === PollType.OPEN) {
    return success(value);
  }

  return failure(PollDomainCodes.POLL_TYPE_INVALID);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/domain/poll/__tests__/PollType.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Add translations**

In `messages/en.json`, inside `domain.poll`:

```json
"pollTypeInvalid": "Invalid poll type",
"openCannotBeBoardScoped": "An open poll cannot be limited to a governing body",
"openMustBeEqual": "An open poll always uses equal weight — one vote per person",
"userNotConfirmed": "Confirm your phone number to vote"
```

In `messages/en.json`, inside `poll.errors`:

```json
"openParticipantsImmutable": "Voters of an open poll cannot be edited or removed",
"openConfigFixed": "Weight settings of an open poll cannot be changed"
```

In `messages/ru.json`, inside `domain.poll`:

```json
"pollTypeInvalid": "Недопустимый тип голосования",
"openCannotBeBoardScoped": "Открытое голосование нельзя ограничить органом управления",
"openMustBeEqual": "В открытом голосовании вес всегда равный — один голос на человека",
"userNotConfirmed": "Подтвердите номер телефона, чтобы голосовать"
```

In `messages/ru.json`, inside `poll.errors`:

```json
"openParticipantsImmutable": "Участников открытого голосования нельзя изменить или удалить",
"openConfigFixed": "Настройки веса открытого голосования нельзя изменить"
```

- [ ] **Step 7: Verify formatting and types**

Run: `yarn lf && yarn typecheck`
Expected: no errors.

- [ ] **Step 8: Stage for review**

```bash
git add src/domain/poll/PollType.ts src/domain/poll/__tests__/PollType.test.ts src/domain/poll/PollDomainCodes.ts src/application/poll/PollErrors.ts messages/en.json messages/ru.json
```

Do NOT commit. The user commits.

---

### Task 2: `Poll` aggregate — `pollType`, `isOpen()`, OPEN invariants

**Files:**

- Modify: `src/domain/poll/Poll.ts`
- Modify: `src/domain/poll/__tests__/Poll.test.ts` (append a new `describe` block)
- Modify: `src/application/poll/CreatePollUseCase.ts`

**Interfaces:**

- Consumes: `PollType`, `parsePollType` (Task 1); `DistributionType`, `PropertyAggregation` value objects.
- Produces:
  - `PollProps.pollType: string`
  - `Poll.create(title, description, organizationId, boardId, createdBy, startDate, endDate, profanityChecker?, pollType?)` — `pollType` defaults to `'ORGANIZATION'`
  - `poll.pollType: string` getter, `poll.isOpen(): boolean`
  - `poll.applyWeightConfig(distributionType, propertyAggregation, propertyIds): Result<void, string>` (was `void`)
  - `CreatePollInput.pollType?: string`

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/poll/__tests__/Poll.test.ts`:

```ts
describe('Poll type', () => {
  const validDates = {
    start: new Date('2026-01-01'),
    end: new Date('2026-02-01'),
  };

  it('defaults to ORGANIZATION', () => {
    const result = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end
    );

    expect(result.success).toBe(true);
    expect(result.value.pollType).toBe('ORGANIZATION');
    expect(result.value.isOpen()).toBe(false);
  });

  it('creates an OPEN poll with EQUAL weight defaults', () => {
    const result = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end,
      undefined,
      'OPEN'
    );

    expect(result.success).toBe(true);
    expect(result.value.isOpen()).toBe(true);
    expect(result.value.distributionType).toBe('EQUAL');
    expect(result.value.propertyAggregation).toBe('RAW_SUM');
    expect(result.value.propertyIds).toEqual([]);
  });

  it('rejects an OPEN poll scoped to a board', () => {
    const result = Poll.create(
      'Title',
      'Description',
      'org-1',
      'board-1',
      'user-1',
      validDates.start,
      validDates.end,
      undefined,
      'OPEN'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED);
  });

  it('rejects an unknown poll type', () => {
    const result = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end,
      undefined,
      'WHATEVER'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_TYPE_INVALID);
  });

  it('applyWeightConfig succeeds with the equal defaults on an OPEN poll', () => {
    const poll = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end,
      undefined,
      'OPEN'
    ).value;

    const result = poll.applyWeightConfig('EQUAL', 'RAW_SUM', []);

    expect(result.success).toBe(true);
  });

  it('applyWeightConfig rejects ownership weighting on an OPEN poll', () => {
    const poll = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end,
      undefined,
      'OPEN'
    ).value;

    const result = poll.applyWeightConfig(
      'OWNERSHIP_UNIT_COUNT',
      'RAW_SUM',
      []
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
    expect(poll.distributionType).toBe('EQUAL');
  });

  it('applyWeightConfig rejects a property scope on an OPEN poll', () => {
    const poll = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end,
      undefined,
      'OPEN'
    ).value;

    const result = poll.applyWeightConfig('EQUAL', 'RAW_SUM', ['prop-1']);

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
    expect(poll.propertyIds).toEqual([]);
  });

  it('applyWeightConfig still works normally on an ORGANIZATION poll', () => {
    const poll = Poll.create(
      'Title',
      'Description',
      'org-1',
      null,
      'user-1',
      validDates.start,
      validDates.end
    ).value;

    const result = poll.applyWeightConfig(
      'OWNERSHIP_UNIT_COUNT',
      'NORMALIZE_PER_PROPERTY',
      ['prop-1']
    );

    expect(result.success).toBe(true);
    expect(poll.distributionType).toBe('OWNERSHIP_UNIT_COUNT');
    expect(poll.propertyAggregation).toBe('NORMALIZE_PER_PROPERTY');
    expect(poll.propertyIds).toEqual(['prop-1']);
  });
});
```

Check the top of `Poll.test.ts` — if `PollDomainCodes` is not imported there yet, add
`import { PollDomainCodes } from '../PollDomainCodes';`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/domain/poll/__tests__/Poll.test.ts -t "Poll type"`
Expected: FAIL — `pollType` / `isOpen` undefined.

- [ ] **Step 3: Implement in `Poll.ts`**

Add imports at the top of `src/domain/poll/Poll.ts`:

```ts
import { PollType, parsePollType } from './PollType';
import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';
```

Add to `PollProps`, right after `boardId`:

```ts
pollType: string; // 'ORGANIZATION' | 'OPEN'
```

Change the `create` signature and body — add the parameter after `profanityChecker` and validate before constructing (place the two checks right after the date validation, before the profanity checks):

```ts
  public static create(
    title: string,
    description: string,
    organizationId: string,
    boardId: string | null,
    createdBy: string,
    startDate: Date,
    endDate: Date,
    profanityChecker?: ProfanityChecker,
    pollType: string = PollType.ORGANIZATION
  ): Result<Poll, string> {
```

```ts
const pollTypeResult = parsePollType(pollType);

if (!pollTypeResult.success) {
  return failure(pollTypeResult.error);
}

if (pollTypeResult.value === PollType.OPEN && boardId !== null) {
  return failure(PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED);
}
```

In the `new Poll({...})` literal, add `pollType: pollTypeResult.value,` right after `boardId,`.

Add the getter next to the `boardId` getter:

```ts
  public get pollType(): string {
    return this.props.pollType;
  }
```

Add the predicate next to `isArchived()`:

```ts
  /**
   * Open polls are voted on by every verified platform user — no snapshot,
   * one vote per person, results tallied live from votes cast.
   */
  public isOpen(): boolean {
    return this.props.pollType === PollType.OPEN;
  }
```

Replace `applyWeightConfig` with:

```ts
  public applyWeightConfig(
    distributionType: string,
    propertyAggregation: string,
    propertyIds: string[]
  ): Result<void, string> {
    if (this.isOpen()) {
      const isEqualDefaults =
        distributionType === DistributionType.EQUAL &&
        propertyAggregation === PropertyAggregation.RAW_SUM &&
        propertyIds.length === 0;

      if (!isEqualDefaults) {
        return failure(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
      }
    }

    this.props.distributionType = distributionType;
    this.props.propertyAggregation = propertyAggregation;
    this.props.propertyIds = [...propertyIds];

    return success(undefined);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/domain/poll/__tests__/Poll.test.ts`
Expected: PASS — the new block plus every pre-existing Poll test.

- [ ] **Step 5: Thread `pollType` through `CreatePollUseCase`**

In `src/application/poll/CreatePollUseCase.ts`:

Add `pollType?: string;` to `CreatePollInput`.

Pass it to the factory:

```ts
const pollResult = Poll.create(
  input.title,
  input.description,
  input.organizationId,
  input.boardId,
  input.createdBy,
  input.startDate,
  input.endDate,
  this.profanityChecker,
  input.pollType
);
```

Handle the new `Result` from `applyWeightConfig`:

```ts
if (
  input.distributionType !== undefined ||
  input.propertyAggregation !== undefined ||
  input.propertyIds !== undefined
) {
  const configResult = pollResult.value.applyWeightConfig(
    input.distributionType ?? pollResult.value.distributionType,
    input.propertyAggregation ?? pollResult.value.propertyAggregation,
    input.propertyIds ?? pollResult.value.propertyIds
  );

  if (!configResult.success) {
    return failure(configResult.error);
  }
}
```

`input.pollType` being `undefined` must keep the default: `Poll.create` already defaults the parameter, and passing `undefined` explicitly triggers that default.

- [ ] **Step 6: Write the failing test for CreatePollUseCase**

Append to `src/application/poll/__tests__/CreatePollUseCase.test.ts` inside the existing top-level `describe`:

```ts
it('creates an OPEN poll for an org member', async () => {
  const result = await useCase.execute({
    title: 'Open Poll',
    description: 'Everyone may vote',
    organizationId: 'org-1',
    boardId: null,
    createdBy: 'user-1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-02-01'),
    pollType: 'OPEN',
  });

  expect(result.success).toBe(true);
  expect(result.value.isOpen()).toBe(true);
});

it('rejects an OPEN poll with ownership weighting', async () => {
  const result = await useCase.execute({
    title: 'Open Poll',
    description: 'Everyone may vote',
    organizationId: 'org-1',
    boardId: null,
    createdBy: 'user-1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-02-01'),
    pollType: 'OPEN',
    distributionType: 'OWNERSHIP_UNIT_COUNT',
  });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
});
```

Read the top of that test file first: reuse its existing mock setup (`useCase`, mocked `organizationRepository.isUserMember` returning `true`, `pollRepository.createPoll` echoing the poll). If `PollDomainCodes` is not imported there, add
`import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';`.

- [ ] **Step 7: Run the use case tests**

Run: `yarn test src/application/poll/__tests__/CreatePollUseCase.test.ts`
Expected: PASS (new tests plus the existing ones).

- [ ] **Step 8: Full test suite + types**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: all green. `TakeSnapshotUseCase.test.ts` and `UpdatePollWeightConfigUseCase.test.ts` call `applyWeightConfig` and ignore its return value — still valid TypeScript, no changes needed.

- [ ] **Step 9: Stage for review**

```bash
git add src/domain/poll/Poll.ts src/domain/poll/__tests__/Poll.test.ts src/application/poll/CreatePollUseCase.ts src/application/poll/__tests__/CreatePollUseCase.test.ts
```

---

### Task 3: Prisma enum, migration, repository mapping

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_poll_type/migration.sql` (generated)
- Modify: `src/infrastructure/repositories/PrismaPollRepository.ts`

**Interfaces:**

- Consumes: `PollType` (Task 1), `PollProps.pollType` (Task 2).
- Produces: `polls.poll_type` column of PG enum type `PollType`; `PrismaPollRepository` persists and reconstitutes `pollType`.

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, next to `enum PollState` (around line 16), add:

```prisma
enum PollType {
  ORGANIZATION
  OPEN
}
```

In `model Poll`, add after the `boardId` line:

```prisma
  pollType       PollType  @default(ORGANIZATION) @map("poll_type")
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_poll_type`
Expected: a new folder under `prisma/migrations/` whose `migration.sql` creates the `"PollType"` type and adds the `poll_type` column with default `'ORGANIZATION'`; the Prisma client regenerates.

Note: if a dev server is running, restart it — the in-memory Prisma client is stale until you do.

- [ ] **Step 3: Write the failing mapping test**

Create `src/infrastructure/repositories/__tests__/PrismaPollRepository.pollType.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { Poll } from '@/domain/poll/Poll';

function makeOpenPoll(): Poll {
  const result = Poll.create(
    'Open Poll',
    'Everyone may vote',
    'org-1',
    null,
    'user-1',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    'OPEN'
  );

  return result.value;
}

describe('PrismaPollRepository poll type mapping', () => {
  it('writes poll_type on create', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'poll-1',
      title: 'Open Poll',
      description: 'Everyone may vote',
      organizationId: 'org-1',
      boardId: null,
      pollType: 'OPEN',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
      state: 'DRAFT',
      weightCriteria: null,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      createdBy: 'user-1',
      createdAt: new Date('2026-01-01'),
      archivedAt: null,
      questions: [],
      properties: [],
    });

    const prisma = { poll: { create } } as any;
    const repository = new PrismaPollRepository(prisma);

    const result = await repository.createPoll(makeOpenPoll());

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pollType: 'OPEN' }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.value.isOpen()).toBe(true);
  });

  it('reconstitutes pollType from the row on read', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'poll-1',
      title: 'Open Poll',
      description: 'Everyone may vote',
      organizationId: 'org-1',
      boardId: null,
      pollType: 'OPEN',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
      state: 'ACTIVE',
      weightCriteria: null,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      createdBy: 'user-1',
      createdAt: new Date('2026-01-01'),
      archivedAt: null,
      questions: [],
      properties: [],
    });

    const prisma = { poll: { findUnique } } as any;
    const repository = new PrismaPollRepository(prisma);

    const result = await repository.getPollById('poll-1');

    expect(result.success).toBe(true);
    expect(result.value!.isOpen()).toBe(true);
  });

  it('writes poll_type on update', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { poll: { update } } as any;
    const repository = new PrismaPollRepository(prisma);

    const poll = makeOpenPoll();
    (poll as any).props.id = 'poll-1';

    const result = await repository.updatePoll(poll);

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pollType: 'OPEN' }),
      })
    );
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaPollRepository.pollType.test.ts`
Expected: FAIL — `pollType` is not passed to Prisma and `isOpen()` is false after reconstitution.

- [ ] **Step 5: Implement the mapping**

In `src/infrastructure/repositories/PrismaPollRepository.ts`:

Extend the client import:

```ts
import {
  PrismaClient,
  PollState as PrismaPollState,
  PollType as PrismaPollType,
} from '@/generated/prisma/client';
```

Add the domain import:

```ts
import { PollType } from '../../domain/poll/PollType';
```

In `createPoll`, inside `data:`, after `boardId: poll.boardId,` add:

```ts
          pollType: this.toPrismaPollType(poll.pollType),
```

In `updatePoll`, inside `data:`, after `endDate: poll.endDate,` add:

```ts
          pollType: this.toPrismaPollType(poll.pollType),
```

In `toDomainPoll`, inside the `Poll.reconstitute({...})` literal, after `boardId: prismaData.boardId,` add:

```ts
      pollType: this.toDomainPollType(prismaData.pollType),
```

Add the two mappers next to `toPrismaState`:

```ts
  private toDomainPollType(prismaPollType: PrismaPollType): string {
    switch (prismaPollType) {
      case 'ORGANIZATION':
        return PollType.ORGANIZATION;
      case 'OPEN':
        return PollType.OPEN;
    }
  }

  private toPrismaPollType(domainPollType: string): PrismaPollType {
    return domainPollType === PollType.OPEN ? 'OPEN' : 'ORGANIZATION';
  }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaPollRepository.pollType.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Full check**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: all green.

- [ ] **Step 8: Stage for review**

```bash
git add prisma/schema.prisma prisma/migrations src/infrastructure/repositories/PrismaPollRepository.ts src/infrastructure/repositories/__tests__/PrismaPollRepository.pollType.test.ts
```

---

### Task 4: `PollVotingPolicy` domain service

**Files:**

- Create: `src/domain/poll/PollVotingPolicy.ts`
- Create: `src/domain/poll/__tests__/PollVotingPolicy.test.ts`

**Interfaces:**

- Consumes: `Poll` (with `isOpen()`, `isActive()`, `isFinished()`), `PollDomainCodes`.
- Produces:

  ```ts
  export interface VoterFacts {
    isParticipant: boolean;
    isConfirmedUser: boolean;
    hasFinishedVoting: boolean;
  }
  export const PollVotingPolicy: {
    canVote(poll: Poll, facts: VoterFacts): Result<void, string>;
  };
  ```

- [ ] **Step 1: Write the failing test**

Create `src/domain/poll/__tests__/PollVotingPolicy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollVotingPolicy } from '../PollVotingPolicy';
import { PollDomainCodes } from '../PollDomainCodes';

function makePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = Poll.create(
    'Title',
    'Description',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    pollType
  ).value;

  const question = Question.create('Q1', 'poll-1', 1, 0, 'single-choice').value;
  question.addAnswer(Answer.create('A1', 1, 'question-1').value);
  poll.addQuestion(question);

  return poll;
}

function activePoll(pollType: 'ORGANIZATION' | 'OPEN'): Poll {
  const poll = makePoll(pollType);
  poll.takeSnapshot();
  poll.activate();

  return poll;
}

const noFacts = {
  isParticipant: false,
  isConfirmedUser: false,
  hasFinishedVoting: false,
};

describe('PollVotingPolicy.canVote', () => {
  describe('ORGANIZATION poll', () => {
    it('allows a participant on an active poll', () => {
      const result = PollVotingPolicy.canVote(activePoll('ORGANIZATION'), {
        ...noFacts,
        isParticipant: true,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(true);
    });

    it('rejects a non-participant even when confirmed', () => {
      const result = PollVotingPolicy.canVote(activePoll('ORGANIZATION'), {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.NOT_PARTICIPANT);
    });
  });

  describe('OPEN poll', () => {
    it('allows any confirmed user who is not a participant yet', () => {
      const result = PollVotingPolicy.canVote(activePoll('OPEN'), {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(true);
    });

    it('rejects an unconfirmed user', () => {
      const result = PollVotingPolicy.canVote(activePoll('OPEN'), noFacts);

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.USER_NOT_CONFIRMED);
    });

    it('rejects a user who already finished voting', () => {
      const result = PollVotingPolicy.canVote(activePoll('OPEN'), {
        isParticipant: true,
        isConfirmedUser: true,
        hasFinishedVoting: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
    });
  });

  describe('poll state gates both types', () => {
    it('rejects a READY poll with POLL_NOT_ACTIVE', () => {
      const poll = makePoll('OPEN');
      poll.takeSnapshot();

      const result = PollVotingPolicy.canVote(poll, {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    });

    it('rejects a FINISHED poll with POLL_FINISHED', () => {
      const poll = activePoll('OPEN');
      poll.finish();

      const result = PollVotingPolicy.canVote(poll, {
        ...noFacts,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_FINISHED);
    });

    it('rejects a DRAFT poll with POLL_NOT_ACTIVE', () => {
      const result = PollVotingPolicy.canVote(makePoll('ORGANIZATION'), {
        ...noFacts,
        isParticipant: true,
        isConfirmedUser: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/domain/poll/__tests__/PollVotingPolicy.test.ts`
Expected: FAIL — cannot resolve `../PollVotingPolicy`.

- [ ] **Step 3: Implement the policy**

Create `src/domain/poll/PollVotingPolicy.ts`:

```ts
import { Result, success, failure } from '../shared/Result';
import { Poll } from './Poll';
import { PollDomainCodes } from './PollDomainCodes';

export interface VoterFacts {
  isParticipant: boolean;
  isConfirmedUser: boolean;
  hasFinishedVoting: boolean;
}

/**
 * Single source of truth for "may this user cast a vote in this poll".
 *
 * ORGANIZATION polls have a fixed electorate: the snapshot decided it, so the
 * voter must already be a participant. OPEN polls have no snapshot — the
 * electorate is every verified platform user, and the participant row is
 * created when the vote is finished.
 */
function canVote(poll: Poll, facts: VoterFacts): Result<void, string> {
  if (poll.isFinished()) {
    return failure(PollDomainCodes.POLL_FINISHED);
  }

  if (!poll.isActive()) {
    return failure(PollDomainCodes.POLL_NOT_ACTIVE);
  }

  if (poll.isOpen()) {
    if (!facts.isConfirmedUser) {
      return failure(PollDomainCodes.USER_NOT_CONFIRMED);
    }
  } else if (!facts.isParticipant) {
    return failure(PollDomainCodes.NOT_PARTICIPANT);
  }

  if (facts.hasFinishedVoting) {
    return failure(PollDomainCodes.ALREADY_VOTED);
  }

  return success(undefined);
}

export const PollVotingPolicy = { canVote };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/domain/poll/__tests__/PollVotingPolicy.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/domain/poll/PollVotingPolicy.ts src/domain/poll/__tests__/PollVotingPolicy.test.ts
```

---

**Phase 1 complete — stop for user review.** Mark this line `[x]` when done: - [x] Phase 1 implemented (2026-07-30), awaiting review

Notes from execution:

- `npx prisma migrate dev` did **not** regenerate the Prisma client in this repo (Prisma 7 +
  `prisma.config.ts`), contrary to `readmes/Prisma-Migration-Workflow.md`. Run `yarn prisma:generate`
  after the migration or `PollType` is missing from `@/generated/prisma/client`.
- Adding a required `pollType` to `PollProps` broke `Poll.reconstitute` fixtures in
  `PrismaPollRepository.test.ts` and `GetUserVotingProgressUseCase.test.ts`, and the exact-payload
  assertions in `PrismaPollRepository.test.ts`. All updated to `'ORGANIZATION'`.
- Tasks 2 and 3 are one compile unit: typecheck stays red between them.

---

## Phase 2 — Lifecycle and voting

### Task 5: `TakeSnapshotUseCase` — validation-only for OPEN polls

**Files:**

- Modify: `src/application/poll/TakeSnapshotUseCase.ts`
- Modify: `src/application/poll/__tests__/TakeSnapshotUseCase.test.ts`

**Interfaces:**

- Consumes: `poll.isOpen()` (Task 2), `pollRepository.updatePoll`.
- Produces: no signature change — `TakeSnapshotUseCase.execute({ pollId, userId })` still returns `Result<void, string>`.

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe` of `src/application/poll/__tests__/TakeSnapshotUseCase.test.ts` (reuse the file's existing mock setup and helpers; read it first):

```ts
it('OPEN poll: transitions to READY without creating participants or eligible members', async () => {
  const openPoll = Poll.create(
    'Open Poll',
    'Everyone may vote',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    'OPEN'
  ).value;
  (openPoll as any).props.id = 'poll-open';

  const question = Question.create(
    'Q1',
    'poll-open',
    1,
    0,
    'single-choice'
  ).value;
  (question as any).props.id = 'question-1';
  question.addAnswer(Answer.create('A1', 1, 'question-1').value);
  openPoll.addQuestion(question);

  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
  pollRepository.updatePoll = vi.fn().mockResolvedValue(success(undefined));

  const result = await useCase.execute({
    pollId: 'poll-open',
    userId: 'user-admin',
  });

  expect(result.success).toBe(true);
  expect(openPoll.state).toBe(PollState.READY);
  expect(pollRepository.updatePoll).toHaveBeenCalledWith(openPoll);
  expect(participantRepository.executeActivation).not.toHaveBeenCalled();
  expect(eligibleMemberRepository.createMany).not.toHaveBeenCalled();
  expect(pollWeightCalculator.compute).not.toHaveBeenCalled();
});

it('OPEN poll with no questions is still rejected', async () => {
  const openPoll = Poll.create(
    'Open Poll',
    'Everyone may vote',
    'org-1',
    null,
    'user-admin',
    new Date('2026-01-01'),
    new Date('2026-02-01'),
    undefined,
    'OPEN'
  ).value;
  (openPoll as any).props.id = 'poll-open';

  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));

  const result = await useCase.execute({
    pollId: 'poll-open',
    userId: 'user-admin',
  });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollDomainCodes.POLL_NO_QUESTIONS);
});
```

Make sure `PollState`, `Answer`, `Question`, `Poll`, `PollDomainCodes` and `success` are imported in that test file (add the missing ones), and that the mocked `pollRepository` object in `beforeEach` includes `updatePoll: vi.fn().mockResolvedValue(success(undefined))`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/application/poll/__tests__/TakeSnapshotUseCase.test.ts -t "OPEN poll"`
Expected: FAIL — the use case calls the weight calculator and `executeActivation` for open polls.

- [ ] **Step 3: Implement the OPEN branch**

In `src/application/poll/TakeSnapshotUseCase.ts`, immediately after the `takeSnapshot()` transition succeeds (after the `if (!snapshotResult.success)` block) and before `// Get member user IDs based on poll type`, insert:

```ts
// Open polls have no fixed electorate: no snapshot, no eligible-member
// rows, no weights to compute. Voters join at the moment they vote.
if (poll.isOpen()) {
  const updateResult = await this.pollRepository.updatePoll(poll);

  if (!updateResult.success) {
    return failure(updateResult.error);
  }

  return success(undefined);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/application/poll/__tests__/TakeSnapshotUseCase.test.ts`
Expected: PASS — new tests plus all pre-existing snapshot tests.

- [ ] **Step 5: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/poll/TakeSnapshotUseCase.ts src/application/poll/__tests__/TakeSnapshotUseCase.test.ts
```

---

### Task 6: Draft and progress use cases go through `PollVotingPolicy`

**Files:**

- Modify: `src/application/poll/SubmitDraftUseCase.ts`
- Modify: `src/application/poll/GetUserVotingProgressUseCase.ts`
- Modify: `src/application/poll/__tests__/SubmitDraftUseCase.test.ts`
- Modify: `src/application/poll/__tests__/GetUserVotingProgressUseCase.test.ts`
- Modify: `src/web/actions/poll/vote.ts` (wiring only)

**Interfaces:**

- Consumes: `PollVotingPolicy.canVote` (Task 4), `UserRepository.findById`, `User.isConfirmed()`.
- Produces:
  - `new SubmitDraftUseCase(pollRepository, participantRepository, voteRepository, draftRepository, organizationRepository, boardRepository, userRepository)`
  - `new GetUserVotingProgressUseCase(pollRepository, participantRepository, voteRepository, draftRepository, userRepository)`

- [ ] **Step 1: Write the failing tests for SubmitDraftUseCase**

Append inside the top-level `describe` of `src/application/poll/__tests__/SubmitDraftUseCase.test.ts`:

```ts
describe('OPEN poll', () => {
  let openPoll: Poll;

  beforeEach(() => {
    openPoll = Poll.create(
      'Open Poll',
      'Everyone may vote',
      'org-1',
      null,
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15'),
      undefined,
      'OPEN'
    ).value;
    (openPoll as any).props.id = 'poll-1';
    (openPoll as any).props.questions = [question];
    openPoll.takeSnapshot();
    openPoll.activate();

    pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));
  });

  it('lets a confirmed non-participant save a draft', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      questionId: 'question-1',
      answerId: 'answer-1',
      userId: 'outsider-1',
      isSingleChoice: true,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('does not query the participant repository for open polls', async () => {
    await useCase.execute({
      pollId: 'poll-1',
      questionId: 'question-1',
      answerId: 'answer-1',
      userId: 'outsider-1',
      isSingleChoice: true,
    });

    expect(
      participantRepository.getParticipantByUserAndPoll
    ).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed user', async () => {
    userRepository.findById = vi.fn().mockResolvedValue(unconfirmedUser);

    const result = await useCase.execute({
      pollId: 'poll-1',
      questionId: 'question-1',
      answerId: 'answer-1',
      userId: 'outsider-1',
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.USER_NOT_CONFIRMED);
  });
});
```

At the top of the file, add the user mocks the block needs. Building a real `User` requires `PhoneNumber`/`Nickname` value objects, which this test does not care about — use minimal stubs (only `isConfirmed()` is ever called):

```ts
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';

const confirmedUser = { isConfirmed: () => true } as unknown as User;
const unconfirmedUser = { isConfirmed: () => false } as unknown as User;
```

Declare `let userRepository: Partial<UserRepository>;` alongside the other repository variables and set it in `beforeEach`:

```ts
userRepository = {
  findById: vi.fn().mockResolvedValue(confirmedUser),
};
```

and the use case constructed with the extra argument:

```ts
useCase = new SubmitDraftUseCase(
  pollRepository as PollRepository,
  participantRepository as ParticipantRepository,
  voteRepository as VoteRepository,
  draftRepository as DraftRepository,
  organizationRepository as OrganizationRepository,
  boardRepository as BoardRepository,
  userRepository as UserRepository
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/application/poll/__tests__/SubmitDraftUseCase.test.ts`
Expected: FAIL — constructor takes 6 arguments, `USER_NOT_CONFIRMED` never returned.

- [ ] **Step 3: Implement SubmitDraftUseCase**

In `src/application/poll/SubmitDraftUseCase.ts`:

Add imports:

```ts
import { UserRepository } from '../../domain/user/UserRepository';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
```

Add the constructor parameter:

```ts
    private boardRepository: BoardRepository,
    private userRepository: UserRepository
```

Replace steps 4 (poll active/finished), 3 (participant) and 4 (already voted) — i.e. everything between the board-archived check and `// 5. If shouldRemove is true` — with:

```ts
// Eligibility: ORGANIZATION polls need a snapshot participant, OPEN polls
// need a confirmed user (they join the poll when they finish voting).
let isParticipant = false;

if (!poll.isOpen()) {
  const participantResult =
    await this.participantRepository.getParticipantByUserAndPoll(
      pollId,
      userId
    );

  if (!participantResult.success) {
    return failure(participantResult.error);
  }

  isParticipant = !!participantResult.value;
}

let isConfirmedUser = false;

if (poll.isOpen()) {
  const user = await this.userRepository.findById(userId);
  isConfirmedUser = user?.isConfirmed() ?? false;
}

const hasFinishedResult = await this.voteRepository.hasUserFinishedVoting(
  pollId,
  userId
);

if (!hasFinishedResult.success) {
  return failure(hasFinishedResult.error);
}

const eligibility = PollVotingPolicy.canVote(poll, {
  isParticipant,
  isConfirmedUser,
  hasFinishedVoting: hasFinishedResult.value,
});

if (!eligibility.success) {
  return failure(eligibility.error);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test src/application/poll/__tests__/SubmitDraftUseCase.test.ts`
Expected: PASS — including the pre-existing ORGANIZATION cases (`NOT_PARTICIPANT`, `ALREADY_VOTED`, `POLL_NOT_ACTIVE`, `POLL_FINISHED`), whose error precedence the policy preserves.

- [ ] **Step 5: Write the failing test for GetUserVotingProgressUseCase**

Append inside the top-level `describe` of `src/application/poll/__tests__/GetUserVotingProgressUseCase.test.ts` (build `openPoll` the same way as in Step 1, with the file's own fixtures):

```ts
it('OPEN poll: canVote is true for a confirmed non-participant', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
  participantRepository.getParticipantByUserAndPoll = vi
    .fn()
    .mockResolvedValue(success(null));

  const result = await useCase.execute({
    pollId: 'poll-1',
    userId: 'outsider-1',
  });

  expect(result.success).toBe(true);
  expect(result.value.canVote).toBe(true);
});

it('OPEN poll: canVote is false once the user has finished voting', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
  participantRepository.getParticipantByUserAndPoll = vi
    .fn()
    .mockResolvedValue(success(null));
  voteRepository.hasUserFinishedVoting = vi
    .fn()
    .mockResolvedValue(success(true));

  const result = await useCase.execute({
    pollId: 'poll-1',
    userId: 'outsider-1',
  });

  expect(result.success).toBe(true);
  expect(result.value.canVote).toBe(false);
});
```

Add the same `userRepository` mock and constructor argument as in Step 1.

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn test src/application/poll/__tests__/GetUserVotingProgressUseCase.test.ts`
Expected: FAIL — constructor arity and `canVote === false`.

- [ ] **Step 7: Implement GetUserVotingProgressUseCase**

In `src/application/poll/GetUserVotingProgressUseCase.ts`:

Add imports for `UserRepository` and `PollVotingPolicy`, add `private userRepository: UserRepository` as the last constructor parameter, and replace the participant lookup (step 2) and the `canVote` computation (step 6) with:

```ts
let isParticipant = false;

if (!poll.isOpen()) {
  const participantResult =
    await this.participantRepository.getParticipantByUserAndPoll(
      pollId,
      userId
    );

  if (!participantResult.success) {
    return failure(participantResult.error);
  }

  isParticipant = !!participantResult.value;
}

let isConfirmedUser = false;

if (poll.isOpen()) {
  const user = await this.userRepository.findById(userId);
  isConfirmedUser = user?.isConfirmed() ?? false;
}
```

```ts
const canVote = PollVotingPolicy.canVote(poll, {
  isParticipant,
  isConfirmedUser,
  hasFinishedVoting: hasFinished,
}).success;
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `yarn test src/application/poll/__tests__/GetUserVotingProgressUseCase.test.ts`
Expected: PASS.

- [ ] **Step 9: Update the server-action wiring**

In `src/web/actions/poll/vote.ts`, pass `userRepository` (already constructed in that file) into both use cases:

```ts
const submitDraftUseCase = new SubmitDraftUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  draftRepository,
  organizationRepository,
  boardRepository,
  userRepository
);
```

```ts
const getUserVotingProgressUseCase = new GetUserVotingProgressUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  draftRepository,
  userRepository
);
```

- [ ] **Step 10: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/poll/SubmitDraftUseCase.ts src/application/poll/GetUserVotingProgressUseCase.ts src/application/poll/__tests__/SubmitDraftUseCase.test.ts src/application/poll/__tests__/GetUserVotingProgressUseCase.test.ts src/web/actions/poll/vote.ts
```

---

### Task 7: Join-on-vote — `joinAndVote` port and `FinishVotingUseCase`

**Files:**

- Modify: `src/domain/poll/ParticipantRepository.ts`
- Modify: `src/infrastructure/repositories/PrismaParticipantRepository.ts`
- Modify: `src/application/poll/FinishVotingUseCase.ts`
- Modify: `src/application/poll/__tests__/FinishVotingUseCase.test.ts`
- Modify: `src/web/actions/poll/vote.ts` (wiring only)

**Interfaces:**

- Consumes: `PollParticipant.create(pollId, userId, weight)`, `ParticipantWeightHistory.create(participantId, pollId, userId, oldWeight, newWeight, changedBy, reason)`, `Vote.create(questionId, answerId, userId, userWeight)`, `PollVotingPolicy.canVote`.
- Produces:

  ```ts
  // ParticipantRepository
  joinAndVote(
    participant: PollParticipant,
    history: ParticipantWeightHistory,
    votes: Vote[],
    willingToSignProtocol: boolean
  ): Promise<Result<void, string>>;
  ```

  and `new FinishVotingUseCase(pollRepository, participantRepository, voteRepository, draftRepository, organizationRepository, boardRepository, userRepository)`.

- [ ] **Step 1: Declare the port**

In `src/domain/poll/ParticipantRepository.ts`, add the `Vote` import and the method inside the `// Transactional operations` section:

```ts
import { Vote } from './Vote';
```

```ts
  /**
   * Join-on-vote for open polls: creates the participant (weight 1), its
   * initial weight-history row and the user's votes in one transaction.
   * Idempotent on (pollId, userId) for the participant row.
   */
  joinAndVote(
    participant: PollParticipant,
    history: ParticipantWeightHistory,
    votes: Vote[],
    willingToSignProtocol: boolean
  ): Promise<Result<void, string>>;
```

- [ ] **Step 2: Write the failing use case test**

Append inside the top-level `describe` of `src/application/poll/__tests__/FinishVotingUseCase.test.ts` (read the file first and reuse its fixtures — `question`, `answer`, `draftRepository.getUserDrafts` returning one draft per question):

```ts
describe('OPEN poll', () => {
  let openPoll: Poll;

  beforeEach(() => {
    openPoll = Poll.create(
      'Open Poll',
      'Everyone may vote',
      'org-1',
      null,
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15'),
      undefined,
      'OPEN'
    ).value;
    (openPoll as any).props.id = 'poll-1';
    (openPoll as any).props.questions = [question];
    openPoll.takeSnapshot();
    openPoll.activate();

    pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));
    participantRepository.joinAndVote = vi
      .fn()
      .mockResolvedValue(success(undefined));
  });

  it('creates the participant, history and votes in one call', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
      willingToSignProtocol: true,
    });

    expect(result.success).toBe(true);
    expect(participantRepository.joinAndVote).toHaveBeenCalledTimes(1);

    const [participant, history, votes, willing] = (
      participantRepository.joinAndVote as any
    ).mock.calls[0];

    expect(participant.pollId).toBe('poll-1');
    expect(participant.userId).toBe('outsider-1');
    expect(participant.userWeight).toBe(1);
    expect(history.oldWeight).toBe(0);
    expect(history.newWeight).toBe(1);
    expect(history.changedBy).toBe('outsider-1');
    expect(history.reason).toBe('open-poll-join');
    expect(votes).toHaveLength(1);
    expect(votes[0].userWeight).toBe(1);
    expect(willing).toBe(true);
  });

  it('does not use the ORGANIZATION vote path', async () => {
    await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
      willingToSignProtocol: false,
    });

    expect(voteRepository.createVotes).not.toHaveBeenCalled();
    expect(
      participantRepository.updateWillingToSignProtocol
    ).not.toHaveBeenCalled();
  });

  it('deletes the drafts after joining', async () => {
    await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
      willingToSignProtocol: false,
    });

    expect(draftRepository.deleteUserDrafts).toHaveBeenCalledWith(
      'poll-1',
      'outsider-1'
    );
  });

  it('rejects a user who already finished voting', async () => {
    voteRepository.hasUserFinishedVoting = vi
      .fn()
      .mockResolvedValue(success(true));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
      willingToSignProtocol: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
    expect(participantRepository.joinAndVote).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed user', async () => {
    userRepository.findById = vi.fn().mockResolvedValue(unconfirmedUser);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
      willingToSignProtocol: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.USER_NOT_CONFIRMED);
  });

  it('still requires every question to be answered', async () => {
    draftRepository.getUserDrafts = vi.fn().mockResolvedValue(success([]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
      willingToSignProtocol: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.MUST_ANSWER_ALL_QUESTIONS);
  });
});
```

Add the `userRepository` mock (confirmed user by default, plus an `unconfirmedUser` fixture) exactly as in Task 6 Step 1, and construct the use case with the extra argument.

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/application/poll/__tests__/FinishVotingUseCase.test.ts`
Expected: FAIL — constructor arity, `joinAndVote` never called.

- [ ] **Step 4: Implement FinishVotingUseCase**

In `src/application/poll/FinishVotingUseCase.ts`:

Add imports:

```ts
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
```

Add `private userRepository: UserRepository` as the last constructor parameter.

Replace the poll-state / participant / already-voted checks (everything between the board-archived guard and `// 5. Get user's drafts`) with:

```ts
const isOpen = poll.isOpen();

let participant: PollParticipant | null = null;

if (!isOpen) {
  const participantResult =
    await this.participantRepository.getParticipantByUserAndPoll(
      pollId,
      userId
    );

  if (!participantResult.success) {
    return failure(participantResult.error);
  }

  participant = participantResult.value;
}

let isConfirmedUser = false;

if (isOpen) {
  const user = await this.userRepository.findById(userId);
  isConfirmedUser = user?.isConfirmed() ?? false;
}

const hasFinishedResult = await this.voteRepository.hasUserFinishedVoting(
  pollId,
  userId
);

if (!hasFinishedResult.success) {
  return failure(hasFinishedResult.error);
}

const eligibility = PollVotingPolicy.canVote(poll, {
  isParticipant: !!participant,
  isConfirmedUser,
  hasFinishedVoting: hasFinishedResult.value,
});

if (!eligibility.success) {
  return failure(eligibility.error);
}
```

In the vote-building loop (step 7), take the weight from the poll type:

```ts
// Open polls are one person = one vote; organization polls use the
// weight the snapshot assigned to this participant.
const voteWeight = isOpen ? 1 : participant!.userWeight;

const votes: Vote[] = [];

for (const draft of drafts) {
  const voteResult = Vote.create(
    draft.questionId,
    draft.answerId,
    userId,
    voteWeight
  );

  if (!voteResult.success) {
    return failure(voteResult.error);
  }

  votes.push(voteResult.value);
}
```

Replace steps 8 and 9 (save votes, save willingness) with a branch:

```ts
if (isOpen) {
  const participantResult = PollParticipant.create(poll.id, userId, 1);

  if (!participantResult.success) {
    return failure(participantResult.error);
  }

  const historyResult = ParticipantWeightHistory.create(
    '', // participantId assigned inside the transaction
    poll.id,
    userId,
    0,
    1,
    userId, // the voter joins on their own initiative
    'open-poll-join'
  );

  if (!historyResult.success) {
    return failure(historyResult.error);
  }

  const joinResult = await this.participantRepository.joinAndVote(
    participantResult.value,
    historyResult.value,
    votes,
    input.willingToSignProtocol
  );

  if (!joinResult.success) {
    return failure(joinResult.error);
  }
} else {
  const createVotesResult = await this.voteRepository.createVotes(votes);

  if (!createVotesResult.success) {
    return failure(createVotesResult.error);
  }

  const protocolResult =
    await this.participantRepository.updateWillingToSignProtocol(
      participant!.id,
      input.willingToSignProtocol
    );

  if (!protocolResult.success) {
    return failure(protocolResult.error);
  }
}
```

Leave step 10 (delete drafts) as it is — it runs for both types.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/application/poll/__tests__/FinishVotingUseCase.test.ts`
Expected: PASS — new block plus every existing ORGANIZATION test.

- [ ] **Step 6: Write the failing infrastructure test**

Create `src/infrastructure/repositories/__tests__/PrismaParticipantRepository.joinAndVote.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '@/domain/poll/ParticipantWeightHistory';
import { Vote } from '@/domain/poll/Vote';

function buildArgs() {
  const participant = PollParticipant.create('poll-1', 'user-1', 1).value;
  const history = ParticipantWeightHistory.create(
    '',
    'poll-1',
    'user-1',
    0,
    1,
    'user-1',
    'open-poll-join'
  ).value;
  const votes = [Vote.create('question-1', 'answer-1', 'user-1', 1).value];

  return { participant, history, votes };
}

describe('PrismaParticipantRepository.joinAndVote', () => {
  it('upserts the participant, writes history with its id and creates the votes', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'participant-1' });
    const historyCreate = vi.fn().mockResolvedValue({});
    const voteCreateMany = vi.fn().mockResolvedValue({ count: 1 });

    const tx = {
      pollParticipant: { upsert },
      participantWeightHistory: { create: historyCreate },
      vote: { createMany: voteCreateMany },
    };

    const prisma = {
      $transaction: vi.fn().mockImplementation((fn: any) => fn(tx)),
    } as any;

    const repository = new PrismaParticipantRepository(prisma);
    const { participant, history, votes } = buildArgs();

    const result = await repository.joinAndVote(
      participant,
      history,
      votes,
      true
    );

    expect(result.success).toBe(true);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId_userId: { pollId: 'poll-1', userId: 'user-1' } },
      })
    );
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ participantId: 'participant-1' }),
      })
    );
    expect(voteCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            questionId: 'question-1',
            answerId: 'answer-1',
            userId: 'user-1',
          }),
        ],
      })
    );
  });

  it('returns a failure when the transaction throws', async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(new Error('duplicate vote')),
    } as any;

    const repository = new PrismaParticipantRepository(prisma);
    const { participant, history, votes } = buildArgs();

    const result = await repository.joinAndVote(
      participant,
      history,
      votes,
      false
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('common.errors.unexpected');
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaParticipantRepository.joinAndVote.test.ts`
Expected: FAIL — `joinAndVote` is not a function.

- [ ] **Step 8: Implement the repository method**

In `src/infrastructure/repositories/PrismaParticipantRepository.ts`, add the `Vote` domain import and this method next to `executeActivation`:

```ts
  async joinAndVote(
    participant: PollParticipant,
    history: ParticipantWeightHistory,
    votes: Vote[],
    willingToSignProtocol: boolean
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Upsert keeps a double submit from creating a second participant row;
        // the unique vote constraint stops duplicate votes.
        const saved = await tx.pollParticipant.upsert({
          where: {
            pollId_userId: {
              pollId: participant.pollId,
              userId: participant.userId,
            },
          },
          create: {
            pollId: participant.pollId,
            userId: participant.userId,
            userWeight: new Prisma.Decimal(participant.userWeight),
            snapshotAt: participant.snapshotAt,
            willingToSignProtocol,
          },
          update: { willingToSignProtocol },
        });

        await tx.participantWeightHistory.create({
          data: {
            participantId: saved.id,
            pollId: history.pollId,
            userId: history.userId,
            oldWeight: new Prisma.Decimal(history.oldWeight),
            newWeight: new Prisma.Decimal(history.newWeight),
            changedBy: history.changedBy,
            reason: history.reason,
          },
        });

        await tx.vote.createMany({
          data: votes.map((vote) => ({
            questionId: vote.questionId,
            answerId: vote.answerId,
            userId: vote.userId,
            userWeight: new Prisma.Decimal(vote.userWeight),
          })),
        });
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to join and vote:', error);

      return failure('common.errors.unexpected');
    }
  }
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaParticipantRepository.joinAndVote.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Update the wiring**

In `src/web/actions/poll/vote.ts`:

```ts
const finishVotingUseCase = new FinishVotingUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  draftRepository,
  organizationRepository,
  boardRepository,
  userRepository
);
```

- [ ] **Step 11: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/domain/poll/ParticipantRepository.ts src/infrastructure/repositories/PrismaParticipantRepository.ts src/infrastructure/repositories/__tests__/PrismaParticipantRepository.joinAndVote.test.ts src/application/poll/FinishVotingUseCase.ts src/application/poll/__tests__/FinishVotingUseCase.test.ts src/web/actions/poll/vote.ts
```

---

**Phase 2 complete — stop for user review.** Mark this line `[x]` when done: - [x] Phase 2 implemented (2026-07-30), awaiting review

Notes from execution:

- `FinishVotingUseCase.test.ts` uses hand-written mock classes, not `vi.fn()`. `joinAndVote` was
  added to `MockParticipantRepository` with a `joinAndVoteCalls` recorder, and the open-poll block
  reuses the outer poll by flipping `props.pollType` to `'OPEN'` (the mock draft repository has no
  `deleteDraftsByQuestion`, so the "missing answer" case uses a second outsider instead).
- `SubmitDraftUseCase`, `GetUserVotingProgressUseCase` and `FinishVotingUseCase` each gained
  `UserRepository` as their last constructor argument; all three wirings in
  `src/web/actions/poll/vote.ts` were updated.

At this point an OPEN poll can be created only through a direct `CreatePollUseCase` call (the UI comes in Phase 4). Manual smoke test is optional; Phase 3 finishes the read paths.

---

## Phase 3 — Access, guards, notifications

### Task 8: Results access, poll read access, `canUserVoteAction`

**Files:**

- Modify: `src/application/poll/GetPollResultsUseCase.ts`
- Modify: `src/application/poll/__tests__/GetPollResultsUseCase.test.ts`
- Modify: `src/web/actions/poll/poll.ts` (`getPollByIdAction`)
- Modify: `src/web/actions/poll/vote.ts` (`canUserVoteAction`)
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `poll.isOpen()`, `PollVotingPolicy.canVote`, `participantRepository.getParticipantByUserAndPoll`.
- Produces: unchanged public signatures; `canUserVoteAction` gains the reason code `notConfirmed`.

- [ ] **Step 1: Write the failing results test**

Append inside the top-level `describe` of `src/application/poll/__tests__/GetPollResultsUseCase.test.ts` (reuse its fixtures; the mocks needed are `organizationRepository.isUserMember`, `userRepository.isSuperAdmin`, `organizationRepository.isUserAdmin`, `participantRepository.getParticipants`, `voteRepository.getVotesByPoll`, `userRepository.findByIds`):

```ts
describe('OPEN poll access', () => {
  let openPoll: Poll;

  beforeEach(() => {
    openPoll = Poll.create(
      'Open Poll',
      'Everyone may vote',
      'org-1',
      null,
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15'),
      undefined,
      'OPEN'
    ).value;
    (openPoll as any).props.id = 'poll-1';
    (openPoll as any).props.questions = [question];
    openPoll.takeSnapshot();
    openPoll.activate();
    openPoll.finish();

    pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
    userRepository.isSuperAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(false);
  });

  it('lets a non-member who voted read the results', async () => {
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(
        success(PollParticipant.create('poll-1', 'outsider-1', 1).value)
      );

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-member who did not vote', async () => {
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'outsider-2',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('poll.errors.notOrganizationMember');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/application/poll/__tests__/GetPollResultsUseCase.test.ts -t "OPEN poll access"`
Expected: FAIL — the voting outsider is rejected.

- [ ] **Step 3: Implement the results branch**

In `src/application/poll/GetPollResultsUseCase.ts`, replace the `else` branch of the authorization block with:

```ts
    } else {
      // Poll is finished: org members and admins may read. For open polls the
      // people who actually voted may read their own poll's outcome too.
      const isMember = await this.organizationRepository.isUserMember(
        userId,
        poll.organizationId
      );

      let isOpenPollVoter = false;

      if (!isMember && !isAdmin && poll.isOpen()) {
        const participantResult =
          await this.participantRepository.getParticipantByUserAndPoll(
            pollId,
            userId
          );

        isOpenPollVoter = participantResult.success && !!participantResult.value;
      }

      if (!isMember && !isAdmin && !isOpenPollVoter) {
        return failure('poll.errors.notOrganizationMember');
      }
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/application/poll/__tests__/GetPollResultsUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5: Relax `getPollByIdAction` for open polls**

The results page calls `getPollByIdAction` before rendering, and that action requires org membership — an outsider voter would be redirected. In `src/web/actions/poll/poll.ts`, change the membership gate inside `getPollByIdAction`:

```ts
// Open polls are shared by link: any authenticated user may read the poll
// itself. Results access is enforced separately in GetPollResultsUseCase.
if (!isSuperAdmin && !poll.isOpen()) {
  const isMember = await organizationRepository.isUserMember(
    user.id,
    poll.organizationId
  );
  const isAdmin = await organizationRepository.isUserAdmin(
    user.id,
    poll.organizationId
  );

  if (!isMember && !isAdmin) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notMember'),
    };
  }
}
```

- [ ] **Step 6: Rewrite `canUserVoteAction` on the policy**

In `src/web/actions/poll/vote.ts`, add the import:

```ts
import { PollVotingPolicy } from '@/domain/poll/PollVotingPolicy';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
```

Replace everything in `canUserVoteAction` after the poll-null check with:

```ts
let isParticipant = false;

if (!poll.isOpen()) {
  const participantResult =
    await participantRepository.getParticipantByUserAndPoll(pollId, user.id);

  if (!participantResult.success) {
    return {
      success: false,
      error: await translateErrorCode(participantResult.error),
    };
  }

  isParticipant = !!participantResult.value;
}

const hasFinishedResult = await voteRepository.hasUserFinishedVoting(
  pollId,
  user.id
);

if (!hasFinishedResult.success) {
  return {
    success: false,
    error: await translateErrorCode(hasFinishedResult.error),
  };
}

const eligibility = PollVotingPolicy.canVote(poll, {
  isParticipant,
  isConfirmedUser: user.isConfirmed(),
  hasFinishedVoting: hasFinishedResult.value,
});

if (eligibility.success) {
  return { success: true, data: { canVote: true } };
}

// Reason codes are keys under the `poll.voting` namespace (the vote page
// renders them with votingT()).
const reasonByCode: Record<string, string> = {
  [PollDomainCodes.POLL_FINISHED]: 'pollFinished',
  [PollDomainCodes.POLL_NOT_ACTIVE]: 'pollNotActive',
  [PollDomainCodes.NOT_PARTICIPANT]: 'cannotVote',
  [PollDomainCodes.USER_NOT_CONFIRMED]: 'notConfirmed',
  [PollDomainCodes.ALREADY_VOTED]: 'alreadyVoted',
};

return {
  success: true,
  data: {
    canVote: false,
    reasonCode: reasonByCode[eligibility.error] ?? 'cannotVote',
  },
};
```

- [ ] **Step 7: Add the new voting message**

In `messages/en.json`, inside `poll.voting`:

```json
"notConfirmed": "Confirm your phone number to vote in this poll"
```

In `messages/ru.json`, inside `poll.voting`:

```json
"notConfirmed": "Подтвердите номер телефона, чтобы участвовать в этом голосовании"
```

- [ ] **Step 8: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/poll/GetPollResultsUseCase.ts src/application/poll/__tests__/GetPollResultsUseCase.test.ts src/web/actions/poll/poll.ts src/web/actions/poll/vote.ts messages/en.json messages/ru.json
```

---

### Task 9: Guards on participant and weight-config mutations

**Files:**

- Modify: `src/application/poll/UpdateParticipantWeightUseCase.ts`
- Modify: `src/application/poll/RemoveParticipantUseCase.ts`
- Modify: `src/application/poll/UpdatePollWeightConfigUseCase.ts`
- Modify: `src/application/poll/PreviewPollWeightConfigUseCase.ts`
- Modify: the four matching test files in `src/application/poll/__tests__/`

**Interfaces:**

- Consumes: `poll.isOpen()`, `PollErrors.OPEN_PARTICIPANTS_IMMUTABLE`, `PollErrors.OPEN_CONFIG_FIXED`.
- Produces: no signature changes.

- [ ] **Step 1: Write the failing tests**

In `src/application/poll/__tests__/UpdateParticipantWeightUseCase.test.ts`, append inside the top-level `describe` (reuse the file's fixtures; make `pollRepository.getPollById` return an OPEN poll built exactly as in Task 8 Step 1, in ACTIVE state):

```ts
it('rejects a weight change on an OPEN poll', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));

  const result = await useCase.execute({
    participantId: 'participant-1',
    newWeight: 5,
    adminUserId: 'user-admin',
    reason: 'because',
  });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollErrors.OPEN_PARTICIPANTS_IMMUTABLE);
});
```

In `src/application/poll/__tests__/RemoveParticipantUseCase.test.ts`:

```ts
it('rejects removing a voter of an OPEN poll', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));

  const result = await useCase.execute({
    participantId: 'participant-1',
    adminUserId: 'user-admin',
  });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollErrors.OPEN_PARTICIPANTS_IMMUTABLE);
});
```

In `src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts`:

```ts
it('rejects a weight-config change on an OPEN poll', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));

  const result = await useCase.execute({
    pollId: 'poll-1',
    newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
    adminUserId: 'user-admin',
  });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollErrors.OPEN_CONFIG_FIXED);
});
```

In `src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts`:

```ts
it('rejects a preview on an OPEN poll', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));

  const result = await useCase.execute({
    pollId: 'poll-1',
    newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
    adminUserId: 'user-admin',
  });

  expect(result.success).toBe(false);
  expect(result.error).toBe(PollErrors.OPEN_CONFIG_FIXED);
});
```

In each file, build `openPoll` in the surrounding `beforeEach` (or inline in the test) with:

```ts
const openPoll = Poll.create(
  'Open Poll',
  'Everyone may vote',
  'org-1',
  null,
  'user-admin',
  new Date('2026-01-15'),
  new Date('2026-02-15'),
  undefined,
  'OPEN'
).value;
(openPoll as any).props.id = 'poll-1';
```

and import `PollErrors` where it is not imported yet.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/application/poll/__tests__/UpdateParticipantWeightUseCase.test.ts src/application/poll/__tests__/RemoveParticipantUseCase.test.ts src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts`
Expected: FAIL — the OPEN guards do not exist.

- [ ] **Step 3: Add the guards**

In `UpdateParticipantWeightUseCase.ts` and `RemoveParticipantUseCase.ts`, right after the poll-null check (before the admin permission check):

```ts
// Open polls are one person = one vote, and a participant row only exists
// because that person already voted — editing or deleting it would rewrite
// a cast vote.
if (poll.isOpen()) {
  return failure(PollErrors.OPEN_PARTICIPANTS_IMMUTABLE);
}
```

In `UpdatePollWeightConfigUseCase.ts` and `PreviewPollWeightConfigUseCase.ts`, right after the poll-null check:

```ts
// The weight configuration of an open poll is fixed: EQUAL / RAW_SUM / no
// property scope.
if (poll.isOpen()) {
  return failure(PollErrors.OPEN_CONFIG_FIXED);
}
```

Read each file first — `PreviewPollWeightConfigUseCase` names its poll variable differently; use the local name and make sure `PollErrors` is imported.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/application/poll/__tests__/UpdateParticipantWeightUseCase.test.ts src/application/poll/__tests__/RemoveParticipantUseCase.test.ts src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/poll/UpdateParticipantWeightUseCase.ts src/application/poll/RemoveParticipantUseCase.ts src/application/poll/UpdatePollWeightConfigUseCase.ts src/application/poll/PreviewPollWeightConfigUseCase.ts src/application/poll/__tests__/
```

---

### Task 10: Activation notifications for open polls

**Files:**

- Modify: `src/application/notification/NotifyPollActivatedUseCase.ts`
- Modify: `src/application/notification/__tests__/NotifyPollActivatedUseCase.test.ts`
- Modify: `src/application/poll/ActivatePollUseCase.ts`
- Modify: `src/application/poll/__tests__/ActivatePollUseCase.test.ts`

**Interfaces:**

- Consumes: `organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(organizationId): Promise<string[]>`, `participantRepository.getParticipants(pollId)`.
- Produces: `NotifyPollActivatedUseCase.execute({ pollId, pollTitle, recipientUserIds })` — the caller now resolves the audience; the dependency object drops `participantRepository` and keeps only `notificationRepository`.

- [ ] **Step 1: Write the failing notification test**

Rewrite the body of `src/application/notification/__tests__/NotifyPollActivatedUseCase.test.ts` around the new signature (keep the file's existing notification-repository fake):

```ts
it('creates one notification per recipient', async () => {
  await useCase.execute({
    pollId: 'poll-1',
    pollTitle: 'Open Poll',
    recipientUserIds: ['user-1', 'user-2'],
  });

  expect(notificationRepository.saveBatch).toHaveBeenCalledTimes(1);

  const [notifications] = (notificationRepository.saveBatch as any).mock
    .calls[0];

  expect(notifications).toHaveLength(2);
  expect(notifications[0].userId).toBe('user-1');
  expect(notifications[0].type).toBe('poll_activated');
});

it('does nothing when there are no recipients', async () => {
  await useCase.execute({
    pollId: 'poll-1',
    pollTitle: 'Open Poll',
    recipientUserIds: [],
  });

  expect(notificationRepository.saveBatch).not.toHaveBeenCalled();
});
```

and construct it as:

```ts
useCase = new NotifyPollActivatedUseCase({
  notificationRepository: notificationRepository as NotificationRepository,
});
```

- [ ] **Step 2: Write the failing activation test**

Append inside the top-level `describe` of `src/application/poll/__tests__/ActivatePollUseCase.test.ts`:

```ts
it('OPEN poll: notifies org members including descendants, not participants', async () => {
  pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
  organizationRepository.findAcceptedMemberUserIdsIncludingDescendants = vi
    .fn()
    .mockResolvedValue(['member-1', 'member-2']);
  notificationRepository.saveBatch = vi.fn().mockResolvedValue(undefined);

  const result = await useCase.execute({
    pollId: 'poll-1',
    userId: 'user-admin',
  });

  expect(result.success).toBe(true);
  expect(
    organizationRepository.findAcceptedMemberUserIdsIncludingDescendants
  ).toHaveBeenCalledWith('org-1');
  expect(participantRepository.getParticipants).not.toHaveBeenCalled();

  const [notifications] = (notificationRepository.saveBatch as any).mock
    .calls[0];
  expect(notifications.map((n: any) => n.userId)).toEqual([
    'member-1',
    'member-2',
  ]);
});
```

Build `openPoll` in READY state (created with `'OPEN'`, questions added, `takeSnapshot()` called) using the file's existing fixture style, and make sure `participantRepository.getParticipants` and `notificationRepository.saveBatch` are `vi.fn()` mocks in `beforeEach`.

- [ ] **Step 3: Run both tests to verify they fail**

Run: `yarn test src/application/notification/__tests__/NotifyPollActivatedUseCase.test.ts src/application/poll/__tests__/ActivatePollUseCase.test.ts`
Expected: FAIL — the notify use case still resolves participants itself.

- [ ] **Step 4: Implement the notification use case**

Replace `src/application/notification/NotifyPollActivatedUseCase.ts` with:

```ts
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollActivatedDependencies {
  notificationRepository: NotificationRepository;
}

export interface NotifyPollActivatedInput {
  pollId: string;
  pollTitle: string;
  /**
   * Resolved by the caller: snapshot participants for organization polls,
   * org members (including descendants) for open polls, which have no
   * participants until people vote.
   */
  recipientUserIds: string[];
}

export class NotifyPollActivatedUseCase {
  constructor(private deps: NotifyPollActivatedDependencies) {}

  async execute(input: NotifyPollActivatedInput): Promise<void> {
    const { pollId, pollTitle, recipientUserIds } = input;

    if (recipientUserIds.length === 0) {
      return;
    }

    const notifications = recipientUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'poll_activated',
          title: 'notification.types.pollActivated.title',
          body: 'notification.types.pollActivated.body',
          data: { pollId, pollTitle },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
```

- [ ] **Step 5: Implement the activation branch**

In `src/application/poll/ActivatePollUseCase.ts`, replace the notification block at the end with:

```ts
// Open polls have no participants at activation — tell the organization's
// own people; outsiders arrive through the shared link.
let recipientUserIds: string[] = [];

if (poll.isOpen()) {
  recipientUserIds =
    await this.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
      poll.organizationId
    );
} else {
  const participantsResult = await this.participantRepository.getParticipants(
    poll.id
  );

  if (participantsResult.success) {
    recipientUserIds = participantsResult.value.map((p) => p.userId);
  }
}

const notifyUseCase = new NotifyPollActivatedUseCase({
  notificationRepository: this.notificationRepository,
});
await notifyUseCase
  .execute({ pollId: poll.id, pollTitle: poll.title, recipientUserIds })
  .catch((err) => {
    console.error('Failed to send poll activated notifications:', err);
  });
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `yarn test src/application/notification/__tests__/NotifyPollActivatedUseCase.test.ts src/application/poll/__tests__/ActivatePollUseCase.test.ts`
Expected: PASS.

- [ ] **Step 7: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/notification/NotifyPollActivatedUseCase.ts src/application/notification/__tests__/NotifyPollActivatedUseCase.test.ts src/application/poll/ActivatePollUseCase.ts src/application/poll/__tests__/ActivatePollUseCase.test.ts
```

---

**Phase 3 complete — stop for user review.** Mark this line `[x]` when done: - [x] Phase 3 implemented (2026-07-31), awaiting review

Notes from execution:

- `PreviewPollWeightConfigUseCase` takes `actingUserId`, not `adminUserId` — the plan's test snippet
  used the wrong field name.
- `NotifyPollActivatedUseCase` no longer takes a `participantRepository`; its test's participant mock
  class was deleted along with the "getParticipants failure" case, which the caller now owns.

---

## Phase 4 — Web layer and UI

### Task 11: Creating an open poll (schema, action, form)

**Files:**

- Modify: `src/application/poll/PollSchemas.ts`
- Create: `src/application/poll/__tests__/PollSchemas.pollType.test.ts`
- Modify: `src/web/actions/poll/poll.ts` (`createPollAction`)
- Modify: `src/app/[locale]/polls/create/CreatePollForm.tsx`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `CreatePollInput.pollType` (Task 2).
- Produces: `createPollSchema` accepts `pollType?: 'ORGANIZATION' | 'OPEN'` and rejects `OPEN` + non-null `boardId`; `createPollAction` reads the `pollType` form field.

- [ ] **Step 1: Write the failing schema test**

Create `src/application/poll/__tests__/PollSchemas.pollType.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createPollSchema } from '../PollSchemas';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';

const noProfanity = { containsProfanity: () => false } as any;

const base = {
  title: 'Open Poll',
  description: 'Everyone may vote',
  organizationId: 'org-1',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-02-01'),
};

describe('createPollSchema pollType', () => {
  it('defaults to no pollType (use case falls back to ORGANIZATION)', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: null,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pollType).toBeUndefined();
  });

  it('accepts OPEN with no board', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: null,
      pollType: 'OPEN',
    });

    expect(result.success).toBe(true);
    expect(result.data!.pollType).toBe('OPEN');
  });

  it('rejects OPEN combined with a board', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: 'board-1',
      pollType: 'OPEN',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED
    );
  });

  it('rejects an unknown poll type', () => {
    const result = createPollSchema(noProfanity).safeParse({
      ...base,
      boardId: null,
      pollType: 'PUBLIC',
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/application/poll/__tests__/PollSchemas.pollType.test.ts`
Expected: FAIL — `pollType` is stripped by the schema.

- [ ] **Step 3: Extend the schema**

In `src/application/poll/PollSchemas.ts`, inside `createPollSchema`'s object, after `propertyIds`:

```ts
      pollType: z.enum(['ORGANIZATION', 'OPEN']).optional(),
```

and add a second `.refine` after the existing date refinement:

```ts
    .refine(
      (data) => !(data.pollType === 'OPEN' && data.boardId !== null),
      {
        message: PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED,
        path: ['boardId'],
      }
    );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/application/poll/__tests__/PollSchemas.pollType.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Read the field in the action**

In `src/web/actions/poll/poll.ts`, inside `createPollAction`, add to the extraction block:

```ts
const pollTypeRaw = formData.get('pollType') as string | null;
```

and to the `input` object:

```ts
      pollType: pollTypeRaw && pollTypeRaw.trim() ? pollTypeRaw : undefined,
```

- [ ] **Step 6: Add poll-type UI to the create form**

In `src/app/[locale]/polls/create/CreatePollForm.tsx`:

Add state next to the weight-config state:

```ts
const [pollType, setPollType] = useState<'ORGANIZATION' | 'OPEN'>(
  'ORGANIZATION'
);
const isOpenPoll = pollType === 'OPEN';
```

Send it with the form data, next to `pollFormData.append('distributionType', ...)`:

```ts
pollFormData.append('pollType', pollType);
```

Guard the board field: an open poll must be org-wide. Replace the board `<Field>` block with:

```tsx
{
  !isOpenPoll && (
    <Field>
      <Label>{t('selectBoard')}</Label>
      <Select
        name="boardId"
        value={pollData.boardId}
        onChange={(e) => setPollData({ ...pollData, boardId: e.target.value })}
        disabled={isLoading || !pollData.organizationId}
      >
        <option value="">{t('orgWidePoll')}</option>
        {filteredBoards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
```

Add the poll-type selector directly above the organization `<Field>` in the same card:

```tsx
<Field>
  <Label>{t('type.label')}</Label>
  <Select
    name="pollType"
    value={pollType}
    onChange={(e) => {
      const next = e.target.value as 'ORGANIZATION' | 'OPEN';
      setPollType(next);

      if (next === 'OPEN') {
        setPollData((prev) => ({ ...prev, boardId: '' }));
        setDistributionType('EQUAL');
        setPropertyAggregation('RAW_SUM');
        setPropertyIds([]);
      }
    }}
  >
    <option value="ORGANIZATION">{t('type.organization')}</option>
    <option value="OPEN">{t('type.open')}</option>
  </Select>
  {isOpenPoll && (
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
      {t('type.openExplainer')}
    </p>
  )}
</Field>
```

Hide the weight-distribution card for open polls by extending its condition:

```tsx
      {!isOpenPoll &&
        (userHasOwnership || adminOrgIds.has(pollData.organizationId)) &&
        pollData.organizationId && (
```

- [ ] **Step 7: Add the translations**

In `messages/en.json`, inside `poll`, add a `type` object:

```json
"type": {
  "label": "Poll type",
  "organization": "Organization poll",
  "open": "Open poll (anyone with the link)",
  "openExplainer": "Any verified user who has the link can vote once, whether or not they are a member of this organization. Weight is always equal: one person, one vote. There is no participant snapshot — results are counted from the votes cast.",
  "openBadge": "Open poll"
}
```

In `messages/ru.json`, inside `poll`:

```json
"type": {
  "label": "Тип голосования",
  "organization": "Голосование организации",
  "open": "Открытое голосование (по ссылке)",
  "openExplainer": "Любой подтверждённый пользователь, у которого есть ссылка, может проголосовать один раз — независимо от того, состоит ли он в этой организации. Вес всегда равный: один человек — один голос. Список участников заранее не фиксируется — результат считается по поданным голосам.",
  "openBadge": "Открытое голосование"
}
```

- [ ] **Step 8: Manual check**

Run: `yarn dev`, open `/polls/create`, select "Open poll".
Expected: the board selector and the weight-distribution card disappear, the explainer shows, and saving creates a poll. Verify in the DB:

```bash
npx prisma studio
```

Expected: the new row has `poll_type = OPEN`, `distribution_type = EQUAL`.

- [ ] **Step 9: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/application/poll/PollSchemas.ts src/application/poll/__tests__/PollSchemas.pollType.test.ts src/web/actions/poll/poll.ts "src/app/[locale]/polls/create/CreatePollForm.tsx" messages/en.json messages/ru.json
```

---

### Task 12: Open-poll surfaces — card, sharing, participants, results, vote page

**Files:**

- Modify: `src/web/components/polls/PollCard.tsx`
- Modify: `src/web/actions/poll/poll.ts` (`searchPollsAction` enrichment)
- Modify: `src/web/components/polls/participants/ParticipantManagement.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/participants/page.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/vote/page.tsx`
- Modify: `src/web/components/polls/results/PollResults.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/results/page.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `pollJson.pollType` (present automatically — `Poll.toJSON()` spreads `props`), `poll.pollType` from `getPollByIdAction`.
- Produces: no new module APIs; UI only.

- [ ] **Step 1: Fix `canVote` enrichment for open polls**

In `src/web/actions/poll/poll.ts`, inside `searchPollsAction`'s enrichment, replace the `canVote` / `hasFinishedVoting` block with:

```ts
// Open polls have no snapshot: any authenticated user may vote until
// they have finished. Organization polls require a participant row.
const participant = await prisma.pollParticipant.findFirst({
  where: { pollId: poll.id, userId: user.id },
});

const votesCount = await prisma.vote.count({
  where: {
    userId: user.id,
    question: { pollId: poll.id },
  },
});
const totalQuestions = pollJson.questions?.length || 0;
const hasFinishedVoting = votesCount >= totalQuestions && totalQuestions > 0;

pollJson.hasFinishedVoting = hasFinishedVoting;
pollJson.canVote = pollJson.pollType === 'OPEN' || !!participant;
```

- [ ] **Step 2: Badge and copy-link on the poll card**

In `src/web/components/polls/PollCard.tsx`:

Add near the other derived flags:

```ts
const isOpenPoll = poll.pollType === 'OPEN';
```

Add the badge inside the badge row, after `<PollStateBadge state={poll.state} />`:

```tsx
{
  isOpenPoll && (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/40 rounded-full">
      {t('type.openBadge')}
    </span>
  );
}
```

Add a copy-link handler next to the other handlers:

```ts
const handleCopyLink = async () => {
  const url = `${window.location.origin}/polls/${poll.id}/vote`;

  try {
    await navigator.clipboard.writeText(url);
    toast.success(t('type.linkCopied'));
  } catch {
    toast.error(t('type.copyLinkError'));
  }
};
```

Add the button in the first action row, after the results link:

```tsx
{
  isOpenPoll && canManage && (
    <Button
      color="zinc"
      onClick={handleCopyLink}
      className="flex-1 cursor-pointer"
    >
      {t('type.copyLink')}
    </Button>
  );
}
```

- [ ] **Step 3: Participants page for open polls**

In `src/app/[locale]/polls/[pollId]/participants/page.tsx`, pass the flag:

```tsx
<ParticipantManagement
  pollId={pollId}
  participantsData={{
    participants: serializedParticipants,
    canModify: participantsData.canModify,
  }}
  pollState={poll.state}
  isOpenPoll={poll.pollType === 'OPEN'}
  weightConfig={weightConfig}
  properties={properties}
  descendantGroups={descendantGroups}
  orgHasOwnershipData={orgHasOwnershipData}
  votesCast={votesCast}
  buildingTotal={buildingTotal}
/>
```

In `src/web/components/polls/participants/ParticipantManagement.tsx`:

Add `isOpenPoll?: boolean;` to `ParticipantManagementProps` after `pollState`, and destructure it with a default:

```ts
  pollState,
  isOpenPoll = false,
```

Add the poll-wide translations hook next to the existing one (the file currently only has the `poll.participants` namespace):

```ts
const tPoll = useTranslations('poll');
```

Add the copy-link handler next to `handleViewHistory`:

```ts
const handleCopyLink = async () => {
  const url = `${window.location.origin}/polls/${pollId}/vote`;

  try {
    await navigator.clipboard.writeText(url);
    toast.success(tPoll('type.linkCopied'));
  } catch {
    toast.error(tPoll('type.copyLinkError'));
  }
};
```

Define the shared open-poll header block above the `if (participants.length === 0)` early return:

```tsx
const openPollHeader = isOpenPoll ? (
  <div className="mb-4 space-y-2">
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {t('openPollHint')}
    </p>
    <button
      type="button"
      onClick={handleCopyLink}
      className="text-sm text-sky-700 dark:text-sky-300 underline cursor-pointer"
    >
      {tPoll('type.copyLink')}
    </button>
  </div>
) : null;
```

Render it in the empty-state branch (an open poll has no voters until someone votes, and that is exactly when the admin needs the link):

```tsx
if (participants.length === 0) {
  return (
    <>
      {openPollHeader}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          {t('noParticipants')}
        </p>
      </div>
    </>
  );
}
```

In the main return, put `{openPollHeader}` as the first child of `<div className="space-y-4">` and render the weight-config editor only for organization polls:

```tsx
{
  /* Weight config editor — open polls have a fixed EQUAL config */
}
{
  !isOpenPoll && (
    <WeightConfigEditor
      pollId={pollId}
      initialConfig={weightConfig}
      properties={properties}
      descendantGroups={descendantGroups}
      orgHasOwnershipData={orgHasOwnershipData}
      votesCast={votesCast}
      pollState={pollState}
      onSaved={() => router.refresh()}
      previewAction={previewPollWeightConfigAction}
      updateAction={updatePollWeightConfigAction}
    />
  );
}
```

In the actions cell of the table, wrap the "Edit weight" and "Remove" buttons so only "View history" survives for open polls (weights are fixed at 1, and a voter row cannot be removed without destroying a cast vote):

```tsx
<div className="flex gap-2">
  {!isOpenPoll && (
    <Button
      type="button"
      color="zinc"
      onClick={() => {
        setSelectedParticipant(participant);
        setEditWeightOpen(true);
      }}
      disabled={!canModify}
      title={!canModify ? t('cannotModifyHasVotes') : undefined}
    >
      {t('editWeight')}
    </Button>
  )}
  <Button
    type="button"
    color="zinc"
    onClick={() => handleViewHistory(participant)}
  >
    {t('viewHistory')}
  </Button>
  {!isOpenPoll && (
    <Button
      type="button"
      color="red"
      onClick={() => {
        setSelectedParticipant(participant);
        setRemoveOpen(true);
      }}
      disabled={!canModify}
      title={!canModify ? t('cannotModifyHasVotes') : undefined}
    >
      {t('remove')}
    </Button>
  )}
</div>
```

- [ ] **Step 4: Vote page banner for outsiders**

In `src/app/[locale]/polls/[pollId]/vote/page.tsx`, the serialized poll gains the org context. Add to `serializedPoll`:

```ts
    pollType: poll.pollType,
```

and render the banner directly under the heading block:

```tsx
{
  serializedPoll.pollType === 'OPEN' && (
    <div className="mb-6 rounded-lg bg-sky-50 p-4 dark:bg-sky-900/20">
      <p className="text-sm text-sky-900 dark:text-sky-200">
        {votingT('openPollBanner')}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Results labelling**

In `src/app/[locale]/polls/[pollId]/results/page.tsx`, pass the flag to `PollResults`:

```tsx
        isOpenPoll={poll.pollType === 'OPEN'}
```

In `src/web/components/polls/results/PollResults.tsx`:

Add `isOpenPoll?: boolean;` to `PollResultsProps` after `buildingTotal`, and destructure it with `isOpenPoll = false`.

The "% of building" fragments need no change — they are already gated on `buildingTotal > 0`, and an open poll is always `EQUAL`, for which the page passes `0`.

Two edits in the summary stats grid. First card — an open poll has no fixed electorate, so "voted / total" is meaningless; show the number of people who voted (`totalParticipants` is the participant count, which for an open poll IS the set of completed voters, and unlike `votedParticipants` it is accurate for non-admin viewers too):

```tsx
<div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
    {isOpenPoll ? t('voters') : t('totalParticipants')}
  </div>
  <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
    {isOpenPoll
      ? results.totalParticipants
      : `${results.votedParticipants} / ${results.totalParticipants}`}
  </div>
  {isOpenPoll && (
    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
      {t('openPollDenominatorNote')}
    </div>
  )}
</div>
```

Second card — total weight is just the voter count again when every weight is 1, so drop the card for open polls by wrapping it:

```tsx
{
  !isOpenPoll && (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
      {/* ...unchanged total-weight card body... */}
    </div>
  );
}
```

Change the grid to stay balanced when that card is gone:

```tsx
        <div
          className={`grid grid-cols-1 gap-4 ${
            isOpenPoll ? 'md:grid-cols-2' : 'md:grid-cols-3'
          }`}
        >
```

- [ ] **Step 6: Poll type is read-only when editing**

In `src/app/[locale]/polls/[pollId]/edit/EditPollForm.tsx` the poll is loaded client-side into `pollData`. Carry the type along:

Add to the `PollData` interface (around line 61):

```ts
pollType: string;
```

Add to the `useState<PollData>` initial value (around line 77):

```ts
    pollType: 'ORGANIZATION',
```

Add to the `setPollData({...})` call inside the loader (around line 199):

```ts
          pollType: poll.pollType,
```

Render it read-only directly above the title `<Field>` (around line 845) — the type is fixed at creation, because switching it would invalidate an existing snapshot or already-cast votes:

```tsx
<p className="text-sm text-zinc-500 dark:text-zinc-400">
  {t('type.label')}:{' '}
  {pollData.pollType === 'OPEN' ? t('type.open') : t('type.organization')}
</p>
```

- [ ] **Step 7: Add the remaining translations**

In `messages/en.json`:

- `poll.type.copyLink`: `"Copy voting link"`
- `poll.type.linkCopied`: `"Voting link copied"`
- `poll.type.copyLinkError`: `"Could not copy the link"`
- `poll.participants.openPollHint`: `"This is an open poll. People appear here when they finish voting, always with weight 1."`
- `poll.voting.openPollBanner`: `"Open poll: anyone with the link can vote once. Your vote counts as one."`
- `poll.results.voters`: `"People who voted"`
- `poll.results.openPollDenominatorNote`: `"Percentages are shares of the votes cast, not of a fixed list of eligible voters."`

In `messages/ru.json`:

- `poll.type.copyLink`: `"Скопировать ссылку"`
- `poll.type.linkCopied`: `"Ссылка скопирована"`
- `poll.type.copyLinkError`: `"Не удалось скопировать ссылку"`
- `poll.participants.openPollHint`: `"Это открытое голосование. Люди появляются здесь, когда завершают голосование, всегда с весом 1."`
- `poll.voting.openPollBanner`: `"Открытое голосование: проголосовать может любой, у кого есть ссылка, один раз. Ваш голос считается как один."`
- `poll.results.voters`: `"Проголосовали"`
- `poll.results.openPollDenominatorNote`: `"Проценты считаются от поданных голосов, а не от заранее заданного списка участников."`

- [ ] **Step 8: Manual end-to-end check**

Run `yarn dev` and walk the flow:

1. As an org member, create an open poll with one question, add answers.
2. As an org admin, take the snapshot (poll goes READY with zero participants) and activate it.
3. Copy the voting link from the poll card.
4. Log in as a user who is NOT a member of that organization, open the link, vote, finish.
5. Back as admin: the participants page lists that voter with weight 1 and no edit/remove controls.
6. Finish the poll; as the outsider, open `/polls/{id}/results` — results are visible.
7. As a different non-member who did not vote, `/polls/{id}/results` must be refused.

Expected: every step behaves as described.

- [ ] **Step 9: Full check and stage**

```bash
yarn test && yarn typecheck && yarn lf
git add src/web/components/polls src/web/actions/poll/poll.ts "src/app/[locale]/polls" messages/en.json messages/ru.json
```

---

**Phase 4 complete — stop for user review.** Mark this line `[x]` when done: - [x] Phase 4 implemented (2026-07-31), awaiting review + manual smoke test

Notes from execution:

- `poll.results.votesCast` was replaced by `poll.results.voters`: for an open poll the weight card
  duplicates the voter count (every weight is 1), so it is hidden and the grid drops to two columns.
- Editing `messages/*.json` with Python must keep the existing `←` escapes (`ensure_ascii=False`
  rewrites them as literal arrows and dirties unrelated lines).
- `yarn build` passes.
- Task 12 Step 8 walkthrough DONE (2026-07-31), in two parts:
  1. A throwaway `scripts/open-poll-walkthrough.ts` — 33 checks through the real use cases and
     Prisma repositories against the dev DB (create → snapshot → activate → outsider votes →
     guards → results), all passing. Script deleted after the run.
  2. Browser pass on `localhost:8080` as an org admin: create form, card badge + copy-link,
     participants page (before and after a vote), vote banner, results labels, read-only type on
     edit. All render as designed. Snapshot/activate use `confirm()`, so automation needs
     `window.confirm = () => true` first.
- Regression check of the pre-existing poll types (2026-07-31), also via a throwaway script since
  deleted: ownership unit-count / size-weighted, raw-sum and per-property-normalized, property-scoped
  weighting and EQUAL-with-scope eligibility filtering — weights predicted from the raw ownership
  rows all matched the snapshot, votes still carry snapshot weights, activation still notifies
  exactly the participants, weight edits still allowed pre-vote and refused post-vote, and
  weight-config preview/apply on a READY poll still re-snapshots correctly.
- Test polls from both runs were deliberately left in the dev DB.

---

## Done criteria

- An org member can create an `OPEN` poll; an org admin prepares and activates it.
- Any phone-confirmed user with the link can vote exactly once, weight 1, without being a member.
- No `PollEligibleMember` rows and no participants exist before people vote; participants appear at finish-voting, transactionally with their votes and a weight-history row.
- Results percentages are shares of votes cast; a voting outsider can read finished results, a non-voting outsider cannot.
- Weight configuration and participant mutations are refused on open polls with localized codes.
- Activation notifies org members including descendants.
- `yarn test`, `yarn typecheck` and `yarn lf` are clean.
