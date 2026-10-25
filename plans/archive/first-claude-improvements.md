# Implementation Plan: Resolutio Bug Fixes & Improvements

## Overview

Multi-phase plan to address bugs, security issues, and DDD improvements identified in codebase research.

---

## Phase 1: Critical Security & Bug Fixes (HIGH PRIORITY)

### 1.1 Add Authorization to Poll Lifecycle Use Cases

**Files:**

- `src/application/poll/ActivatePollUseCase.ts`
- `src/application/poll/DeactivatePollUseCase.ts`
- `src/application/poll/FinishPollUseCase.ts`
- `src/domain/poll/PollErrors.ts` (add new error)

**Changes:**

- Inject `OrganizationRepository` dependency
- Inject `PrismaClient` for superadmin check (or create SuperAdminRepository)
- Add check: user must be admin of organization OR superadmin
- Poll creator alone is NOT sufficient (admin-only policy)
- Add error: `PollErrors.NOT_AUTHORIZED`

**Authorization logic:**

```typescript
const isSuperAdmin = await prisma.superAdmin.findUnique({ where: { userId } });
if (isSuperAdmin) return; // bypass

const board = await boardRepository.findById(poll.boardId);
const isAdmin = await organizationRepository.isUserAdmin(
  userId,
  board.organizationId
);
if (!isAdmin) return failure(PollErrors.NOT_AUTHORIZED);
```

**Tests:**

- `src/application/poll/__tests__/ActivatePollUseCase.test.ts` - add tests for:
  - Non-admin user → rejected
  - Admin user → allowed
  - Superadmin → allowed (bypass)
- Same pattern for Deactivate and Finish use case tests

### 1.2 Fix Type Mismatch in GetPollResultsUseCase

**File:** `src/application/poll/GetPollResultsUseCase.ts`

**Changes:**

- Line 192-198: Fix `userName` → should match interface or update interface
- Update `AnswerResult.voters` interface to include `userName` if needed

### 1.3 Fix hasUserFinishedVoting Logic

**File:** `src/infrastructure/repositories/PrismaPollRepository.ts:470-488`

**Changes:**

- Check if user answered ALL questions (not just any)
- Count votes grouped by questionId vs total questions in poll

### 1.4 Validate Questions Have Answers Before Activation

**File:** `src/domain/poll/Poll.ts:223-238`

**Changes:**

- In `activate()`, iterate questions and check each has ≥1 non-archived answer
- Add domain code: `POLL_QUESTION_NO_ANSWERS`

---

## Phase 2: Voting Logic Fixes

### 2.1 Single-Choice Draft Validation ✅

**File:** `src/application/poll/FinishVotingUseCase.ts`

**Changes:**

- Before creating votes, validate single-choice questions have exactly 1 draft
- Add error code: `SINGLE_CHOICE_MULTIPLE_ANSWERS`

### 2.2 Transaction for Poll Activation ✅

**File:** `src/application/poll/ActivatePollUseCase.ts`

**Changes:**

- Wrap participant creation + poll update in Prisma transaction
- Use new `executeActivation()` method for atomic operation

**File:** `src/domain/poll/PollRepository.ts`

**Changes:**

- Added `executeActivation(poll, participants, historyRecords)` method

**File:** `src/infrastructure/repositories/PrismaPollRepository.ts`

**Changes:**

- Implemented `executeActivation()` using `$transaction` for atomic operation
- All participant creation, history records, and poll update happen in single transaction

---

## Phase 3: Domain Model Improvements ✅

### 3.1 Route Answer Creation Through Aggregate ✅

**Files:**

- `src/domain/poll/Poll.ts` - added `addAnswerToQuestion(questionId, text, order)` method
- `src/application/poll/CreateAnswerUseCase.ts` - uses aggregate method

**Changes:**

- Poll.addAnswerToQuestion validates poll state (not active/finished) and routes to Question
- Added domain codes: POLL_CANNOT_ADD_ANSWER_ACTIVE, POLL_CANNOT_ADD_ANSWER_FINISHED
- Added translations to en.json and ru.json

### 3.2 Make Entity IDs Immutable ✅

**Files modified:**

- `src/domain/poll/Vote.ts`
- `src/domain/poll/VoteDraft.ts`
- `src/domain/poll/PollParticipant.ts`
- `src/domain/poll/ParticipantWeightHistory.ts`
- `src/domain/board/Board.ts`
- `src/domain/organization/Organization.ts`

**Changes:**

- Removed public `setId()` methods from all entities
- Tests updated to use `(entity as any).props.id = 'id'` pattern
- Poll, Question, Answer already had no setId (no changes needed)

---

## Phase 4: Repository Refactoring ✅

### 4.1 Split PollRepository ✅

**New files created:**

- `src/domain/poll/QuestionRepository.ts`
- `src/domain/poll/AnswerRepository.ts`
- `src/domain/poll/VoteRepository.ts`
- `src/domain/poll/DraftRepository.ts`
- `src/domain/poll/ParticipantRepository.ts`
- `src/infrastructure/repositories/PrismaQuestionRepository.ts`
- `src/infrastructure/repositories/PrismaAnswerRepository.ts`
- `src/infrastructure/repositories/PrismaVoteRepository.ts`
- `src/infrastructure/repositories/PrismaDraftRepository.ts`
- `src/infrastructure/repositories/PrismaParticipantRepository.ts`

**Changes completed:**

- Extracted methods from PrismaPollRepository to focused repositories
- Updated all poll use cases to inject specific repositories
- PollRepository now focused on Poll aggregate only (from 974 lines to 224 lines)
- All 343 tests passing

---

## Phase 5: Business Rule Enforcement ✅

### 5.1 Connected Organization Validation ✅

**File:** `src/application/organization/JoinOrganizationUseCase.ts`

**Status:** Already implemented (lines 58-76). Uses `getAncestorIds()`, `getDescendantIds()`, `findMembershipsByUserId()` and returns `HIERARCHY_CONFLICT` error.

### 5.2 Superadmin Bypass for Board Operations ✅

**Files modified:**

- `src/application/board/CreateBoardUseCase.ts`
- `src/application/board/ArchiveBoardUseCase.ts`
- `src/application/board/AddBoardMemberUseCase.ts`
- `src/application/board/RemoveBoardMemberUseCase.ts`
- `src/web/actions/board.ts` (updated dependency injection)

**Changes:**

- Added `UserRepository` dependency to all 4 board use cases
- Implemented superadmin bypass check before admin check
- Tests added for superadmin bypass (TDD)

Also fixed infrastructure issues from Phase 4:

- Added missing repository exports to `src/infrastructure/index.ts`
- Updated `src/web/actions/poll.ts` with new repository dependencies
- Updated `src/web/actions/vote.ts` with new repository dependencies
- Updated `src/web/actions/participant.ts` with new repository dependencies

---

## Phase 6: SKIPPED - Entity Immutability

_Decided not to implement._

Immutability adds complexity (cascading copies for nested structures) without meaningful benefit for backend DDD entities that have short request-scoped lifecycles. Current mutable approach with private props and controlled domain methods is sufficient.

---

## Execution Order

```
Phase 1 (Critical Security & Bugs)
├── 1.1 Authorization checks - ADMIN ONLY + superadmin bypass
├── 1.2 Type mismatch fix
├── 1.3 hasUserFinishedVoting fix
└── 1.4 Questions must have answers

Phase 2 (Voting Logic)
├── 2.1 Single-choice validation
└── 2.2 Transaction for activation

Phase 3 (Domain Model)
├── 3.1 Aggregate root pattern
└── 3.2 Immutable IDs

Phase 4 (Repository Refactor)
└── 4.1 Split PollRepository into focused repos

Phase 5 (Business Rules) ✅
├── 5.1 Connected org validation ✅ (already implemented)
└── 5.2 Superadmin bypass for board ops ✅
```

---

## Decisions Made

- **Authorization:** Admin only (not poll creator) can activate/deactivate/finish
- **Superadmin:** Include bypass - superadmins skip authorization
- **Repository split:** Do now - 891 lines is too large
- **Immutability:** Defer - works fine, polish later

---

## Verification

After each phase:

1. Run `yarn test` - all tests must pass
2. Run `yarn build` - no TypeScript errors
3. Manual test key flows:
   - Create poll → add questions → add answers → activate
   - Vote on poll → finish voting
   - Check poll results
