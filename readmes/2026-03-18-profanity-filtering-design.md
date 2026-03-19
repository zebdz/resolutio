# Profanity Filtering

## Overview

Hard-block user input containing profanity in both EN and RU. Uses `leo-profanity` library with custom blocked/whitelisted word lists. Domain owns the check via a `ProfanityChecker` interface; infrastructure provides `LeoProfanityChecker` singleton. Zod schemas reference the same checker for early field-level errors.

**Prerequisite:** `yarn add leo-profanity` (ships with TypeScript definitions).

## 1. Domain Interface & Config

### `src/domain/shared/profanity/ProfanityChecker.ts`

```typescript
export interface ProfanityChecker {
  containsProfanity(text: string): boolean;
}
```

### `src/domain/shared/profanity/profanityConfig.ts`

```typescript
export const PROFANITY_CUSTOM_BLOCKED: string[] = [];
export const PROFANITY_WHITELISTED: string[] = [];
```

### `src/domain/shared/SharedDomainCodes.ts`

```typescript
export const SharedDomainCodes = {
  CONTAINS_PROFANITY: 'domain.shared.containsProfanity',
} as const;
```

### Localization

Uses a generic message (no `{field}` param — Zod field errors already display next to the correct input):

- EN: `"Contains inappropriate language"`
- RU: `"Содержит ненормативную лексику"`

## 2. Infrastructure Implementation

### `src/infrastructure/profanity/LeoProfanityChecker.ts`

- Implements `ProfanityChecker`
- Singleton via private constructor + `getInstance()`
- **Dictionary loading order** (critical — `loadDictionary()` replaces, not appends):
  1. Default EN dictionary is loaded automatically
  2. Get RU words via `leoProfanity.getDictionary('ru')`
  3. Add RU words to active dictionary via `leoProfanity.add(ruWords)`
  4. Add custom blocked words via `leoProfanity.add(PROFANITY_CUSTOM_BLOCKED)`
  5. Remove whitelisted words via `leoProfanity.remove(PROFANITY_WHITELISTED)`

## 3. Entity Integration

Entity factory/mutation methods gain an **optional** `profanityChecker?: ProfanityChecker` parameter. When provided, text fields are checked after existing validations pass.

**Error signaling differs by entity pattern:**

- Entities using `Result<T, string>` (Organization, Poll, Question, Answer, Board, JoinToken, JoinParentRequest, ParticipantWeightHistory): return `failure(SharedDomainCodes.CONTAINS_PROFANITY)`
- Entities using `throw` (User, Nickname): `throw new Error(SharedDomainCodes.CONTAINS_PROFANITY)`

Optional parameter means existing tests and DB-reconstruction paths don't need changes.

### Entities, Methods & Fields

| Entity                     | Methods                                                                     | Fields                                |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| `Organization`             | `create()`, `updateName()`, `updateDescription()`                           | `name`, `description`                 |
| `Poll`                     | `create()`, `updateTitle()`, `updateDescription()`, `addAnswerToQuestion()` | `title`, `description`                |
| `Question`                 | `create()`, `updateText()`, `updateDetails()`                               | `text`, `details`                     |
| `Answer`                   | `create()`, `updateText()`                                                  | `text`                                |
| `User`                     | `create()`                                                                  | `firstName`, `lastName`, `middleName` |
| `Nickname`                 | `create()`                                                                  | `value`                               |
| `Board`                    | `create()`                                                                  | `name`                                |
| `JoinToken`                | `create()`                                                                  | `description`                         |
| `JoinParentRequest`        | `create()`, `reject()`                                                      | `message`, `rejectionReason`          |
| `ParticipantWeightHistory` | `create()`                                                                  | `reason`                              |

**Also affected:** simple join request rejection reason (no domain entity — validated only at schema/use-case level via `HandleJoinRequestSchema`).

## 4. Zod Schema Integration

Schemas become factory functions accepting `ProfanityChecker`:

```typescript
export const createOrganizationSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    name: z.string()
      .min(...)
      .max(...)
      .refine(
        (val) => !profanityChecker.containsProfanity(val),
        { message: SharedDomainCodes.CONTAINS_PROFANITY }
      ),
  });
```

### Schemas affected

- `CreateOrganizationSchema`
- `UpdateOrganizationSchema`
- `RegisterUserSchema`
- `UpdateUserProfileSchema` (nickname)
- `PollSchemas` (create/update poll, question, answer)
- `HandleJoinParentRequestSchema` (rejection reason)
- `HandleJoinRequestSchema` (rejection reason)
- `CreateJoinTokenSchema`
- `RequestJoinParentSchema` (message)
- Weight change schema in `participant.ts` action
- Any other schemas with user-facing text fields

Each schema's consuming server action and tests must be updated to pass the `ProfanityChecker` instance.

## 5. Use Case Wiring

Use cases receive `ProfanityChecker` via constructor injection (like repositories). Pass it to entity factory/mutation methods and schema creation.

Server actions get `LeoProfanityChecker.getInstance()` and pass it when constructing use cases/schemas.

## 6. Error Translation

Add to `ERROR_CODE_PARAMS` map in `translateErrorCode.ts`:

```typescript
[SharedDomainCodes.CONTAINS_PROFANITY]: {}
```

No special parameters needed — the message is generic and Zod field errors already associate with the correct field.

## 7. Testing

- **`LeoProfanityChecker` unit tests**: detects EN profanity, detects RU profanity, respects whitelist, respects custom blocked words, clean text passes
- **Entity factory/mutation tests**: creation/update fails with profanity in each text field, returns correct code
- **Zod schema tests**: `.refine()` catches profanity with correct error code
- Existing tests pass `undefined` for the optional parameter — no changes needed
- No integration tests

## Files to Create

- `src/domain/shared/profanity/ProfanityChecker.ts`
- `src/domain/shared/profanity/profanityConfig.ts`
- `src/domain/shared/SharedDomainCodes.ts`
- `src/infrastructure/profanity/LeoProfanityChecker.ts`
- `src/infrastructure/profanity/__tests__/LeoProfanityChecker.test.ts`

## Files to Modify

### Domain entities + tests

- `Organization.ts` — `create()`, `updateName()`, `updateDescription()`
- `Organization.test.ts`
- `Poll.ts` — `create()`, `updateTitle()`, `updateDescription()`, `addAnswerToQuestion()`
- `Poll.test.ts`
- `Question.ts` — `create()`, `updateText()`, `updateDetails()`
- `Question.test.ts`
- `Answer.ts` — `create()`, `updateText()`
- `Answer.test.ts`
- `User.ts` — `create()`
- `User.test.ts`
- `Nickname.ts` — `create()`
- `Nickname.test.ts`
- `Board.ts` — `create()`
- `Board.test.ts`
- `JoinToken.ts` — `create()`
- `JoinToken.test.ts`
- `JoinParentRequest.ts` — `create()`, `reject()`
- `JoinParentRequest.test.ts`
- `ParticipantWeightHistory.ts` — `create()`
- `ParticipantWeightHistory.test.ts`

### Schemas + use cases + actions

- All Zod schemas listed in Section 4 — convert to factory functions
- All use cases that create/update the above entities — inject `ProfanityChecker`
- All server actions that wire up those use cases — pass `LeoProfanityChecker.getInstance()`

### Error translation + localization

- `translateErrorCode.ts` — add `CONTAINS_PROFANITY` to `ERROR_CODE_PARAMS`
- `messages/en.json` — add `domain.shared.containsProfanity`
- `messages/ru.json` — add `domain.shared.containsProfanity`
