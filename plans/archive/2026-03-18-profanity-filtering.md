# Profanity Filtering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block user input containing profanity (EN + RU) across all text fields in the app.

**Architecture:** Domain-owned `ProfanityChecker` interface with `LeoProfanityChecker` infrastructure implementation (singleton, `leo-profanity` lib). Entity factory/mutation methods accept optional `profanityChecker` param. Zod schemas converted to factory functions referencing the same checker.

**Tech Stack:** leo-profanity, vitest, zod, next-intl

**Spec:** `readmes/2026-03-18-profanity-filtering-design.md`

---

## Chunk 1: Foundation (interface, implementation, error codes, localization)

### Task 1: Install leo-profanity

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
yarn add leo-profanity
```

- [ ] **Step 2: Verify types exist**

```bash
ls node_modules/leo-profanity/index.d.ts
```

---

### Task 2: Create ProfanityChecker interface

**Files:**

- Create: `src/domain/shared/profanity/ProfanityChecker.ts`

- [ ] **Step 1: Create the interface**

```typescript
export interface ProfanityChecker {
  containsProfanity(text: string): boolean;
}
```

---

### Task 3: Create profanity config (custom blocked/whitelisted words)

**Files:**

- Create: `src/domain/shared/profanity/profanityConfig.ts`

- [ ] **Step 1: Create config**

```typescript
// Domain-specific words to block beyond library defaults
export const PROFANITY_CUSTOM_BLOCKED: string[] = [];

// False positives to allow
export const PROFANITY_WHITELISTED: string[] = [];
```

---

### Task 4: Create SharedDomainCodes

**Files:**

- Create: `src/domain/shared/SharedDomainCodes.ts`

- [ ] **Step 1: Create shared codes**

```typescript
export const SharedDomainCodes = {
  CONTAINS_PROFANITY: 'domain.shared.containsProfanity',
} as const;

export type SharedDomainCode =
  (typeof SharedDomainCodes)[keyof typeof SharedDomainCodes];
```

---

### Task 5: Add localization messages

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add to en.json**

Add under `"domain"` key, new `"shared"` section:

```json
"shared": {
  "containsProfanity": "Contains inappropriate language"
}
```

- [ ] **Step 2: Add to ru.json**

```json
"shared": {
  "containsProfanity": "Содержит ненормативную лексику"
}
```

---

### Task 6: TDD — LeoProfanityChecker

**Files:**

- Create: `src/infrastructure/profanity/__tests__/LeoProfanityChecker.test.ts`
- Create: `src/infrastructure/profanity/LeoProfanityChecker.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { LeoProfanityChecker } from '../LeoProfanityChecker';

describe('LeoProfanityChecker', () => {
  const checker = LeoProfanityChecker.getInstance();

  it('should detect English profanity', () => {
    expect(checker.containsProfanity('this is shit')).toBe(true);
  });

  it('should detect Russian profanity', () => {
    // Use an actual Russian profane word from leo-profanity's RU dictionary
    expect(checker.containsProfanity('это блять')).toBe(true);
  });

  it('should pass clean text', () => {
    expect(checker.containsProfanity('hello world')).toBe(false);
  });

  it('should pass clean Russian text', () => {
    expect(checker.containsProfanity('привет мир')).toBe(false);
  });

  it('should return same singleton instance', () => {
    const a = LeoProfanityChecker.getInstance();
    const b = LeoProfanityChecker.getInstance();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
yarn vitest run src/infrastructure/profanity/__tests__/LeoProfanityChecker.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement LeoProfanityChecker**

```typescript
import leoProfanity from 'leo-profanity';
import { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import {
  PROFANITY_CUSTOM_BLOCKED,
  PROFANITY_WHITELISTED,
} from '@/domain/shared/profanity/profanityConfig';

export class LeoProfanityChecker implements ProfanityChecker {
  private static instance: LeoProfanityChecker;

  private constructor() {
    // Default EN dictionary is loaded automatically
    // getDictionary('ru') returns RU words without replacing active dictionary
    const ruWords = leoProfanity.getDictionary('ru');
    leoProfanity.add(ruWords);
    leoProfanity.add(PROFANITY_CUSTOM_BLOCKED);
    leoProfanity.remove(PROFANITY_WHITELISTED);
  }

  static getInstance(): LeoProfanityChecker {
    if (!LeoProfanityChecker.instance) {
      LeoProfanityChecker.instance = new LeoProfanityChecker();
    }
    return LeoProfanityChecker.instance;
  }

  containsProfanity(text: string): boolean {
    return leoProfanity.check(text);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn vitest run src/infrastructure/profanity/__tests__/LeoProfanityChecker.test.ts
```

- [ ] **Step 5: Add whitelist/blocklist tests**

Add to the same test file:

```typescript
describe('LeoProfanityChecker custom lists', () => {
  // These tests validate the config mechanism works.
  // With empty lists, just verify the checker doesn't crash on edge cases.
  it('should handle empty string', () => {
    expect(checker.containsProfanity('')).toBe(false);
  });

  it('should handle whitespace-only string', () => {
    expect(checker.containsProfanity('   ')).toBe(false);
  });
});
```

- [ ] **Step 6: Run all tests — expect PASS**

```bash
yarn vitest run src/infrastructure/profanity/__tests__/LeoProfanityChecker.test.ts
```

---

### Task 7: Add CONTAINS_PROFANITY to ERROR_CODE_PARAMS

**Files:**

- Modify: `src/web/actions/utils/translateErrorCode.ts`

- [ ] **Step 1: Add import and entry**

Add import at top:

```typescript
import { SharedDomainCodes } from '@/domain/shared/SharedDomainCodes';
```

Add entry to `ERROR_CODE_PARAMS` (no params needed — generic message):

```typescript
[SharedDomainCodes.CONTAINS_PROFANITY]: {},
```

---

## Chunk 2: Organization entity + schema integration

### Task 8: TDD — Organization profanity check

**Files:**

- Modify: `src/domain/organization/__tests__/Organization.test.ts`
- Modify: `src/domain/organization/Organization.ts`

- [ ] **Step 1: Write failing tests**

Add to `Organization.test.ts`:

```typescript
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

describe('Organization profanity check', () => {
  describe('create', () => {
    it('should reject name with profanity', () => {
      const result = Organization.create(
        'badword org',
        'Valid desc',
        'user-1',
        null,
        undefined,
        mockProfanityChecker
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('should reject description with profanity', () => {
      const result = Organization.create(
        'Valid Org',
        'has badword here',
        'user-1',
        null,
        undefined,
        mockProfanityChecker
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('should pass clean text with profanityChecker', () => {
      const result = Organization.create(
        'Clean Org',
        'Clean desc',
        'user-1',
        null,
        undefined,
        mockProfanityChecker
      );
      expect(result.success).toBe(true);
    });

    it('should pass without profanityChecker (backward compat)', () => {
      const result = Organization.create('Any Org', 'Any desc', 'user-1');
      expect(result.success).toBe(true);
    });
  });

  describe('updateName', () => {
    it('should reject name with profanity', () => {
      const org = makeOrg();
      const result = org.updateName('badword name', mockProfanityChecker);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
      expect(org.name).toBe('Test Org');
    });
  });

  describe('updateDescription', () => {
    it('should reject description with profanity', () => {
      const org = makeOrg();
      const result = org.updateDescription(
        'badword text',
        mockProfanityChecker
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
      expect(org.description).toBe('A test organization');
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
yarn vitest run src/domain/organization/__tests__/Organization.test.ts
```

Expected: FAIL — `create()` doesn't accept profanityChecker param.

- [ ] **Step 3: Implement profanity check in Organization**

Modify `Organization.ts`:

Add imports:

```typescript
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
```

Update `create()` signature — add `profanityChecker` as last optional param:

```typescript
public static create(
  name: string,
  description: string,
  createdById: string,
  parentId: string | null = null,
  allowMultiTreeMembership?: boolean,
  profanityChecker?: ProfanityChecker
): Result<Organization, string> {
```

Add profanity checks after existing validations pass but before constructing the entity:

```typescript
// Profanity check (after other validations)
if (profanityChecker?.containsProfanity(name.trim())) {
  return failure(SharedDomainCodes.CONTAINS_PROFANITY);
}

if (profanityChecker?.containsProfanity(description.trim())) {
  return failure(SharedDomainCodes.CONTAINS_PROFANITY);
}
```

Update `updateName()` — add optional param:

```typescript
public updateName(name: string, profanityChecker?: ProfanityChecker): Result<void, string> {
  const validation = Organization.validateName(name);
  if (!validation.success) {
    return validation;
  }

  if (profanityChecker?.containsProfanity(name.trim())) {
    return failure(SharedDomainCodes.CONTAINS_PROFANITY);
  }

  this.props.name = name.trim();
  return success(undefined);
}
```

Update `updateDescription()` — add optional param:

```typescript
public updateDescription(description: string, profanityChecker?: ProfanityChecker): Result<void, string> {
  if (!description || description.trim().length === 0) {
    return failure(OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY);
  }

  if (description.length > ORGANIZATION_DESCRIPTION_MAX_LENGTH) {
    return failure(OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG);
  }

  if (profanityChecker?.containsProfanity(description.trim())) {
    return failure(SharedDomainCodes.CONTAINS_PROFANITY);
  }

  this.props.description = description.trim();
  return success(undefined);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn vitest run src/domain/organization/__tests__/Organization.test.ts
```

---

### Task 9: Convert CreateOrganizationSchema to factory function

**Files:**

- Modify: `src/application/organization/CreateOrganizationSchema.ts`

- [ ] **Step 1: Convert to factory**

```typescript
import { z } from 'zod';
import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_DESCRIPTION_MAX_LENGTH,
} from '../../domain/organization/Organization';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export const createOrganizationSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    name: z
      .string()
      .min(1, OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY)
      .max(
        ORGANIZATION_NAME_MAX_LENGTH,
        OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG
      )
      .trim()
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    description: z
      .string()
      .min(1, OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY)
      .max(
        ORGANIZATION_DESCRIPTION_MAX_LENGTH,
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG
      )
      .trim()
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    parentId: z.string().optional().nullable(),
    autoJoin: z.boolean().optional().default(true),
    allowMultiTreeMembership: z.boolean().optional().default(false),
  });

// Use z.input so autoJoin remains optional for callers (use case ignores it)
export type CreateOrganizationInput = z.input<
  ReturnType<typeof createOrganizationSchema>
>;
```

---

### Task 10: Wire ProfanityChecker into CreateOrganizationUseCase

**Files:**

- Modify: `src/application/organization/CreateOrganizationUseCase.ts`

- [ ] **Step 1: Add to dependencies interface**

```typescript
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export interface CreateOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}
```

- [ ] **Step 2: Pass to Organization.create()**

In `execute()`, update the `Organization.create()` call:

```typescript
const organizationResult = Organization.create(
  name,
  description,
  userId,
  parentId,
  input.allowMultiTreeMembership,
  this.deps.profanityChecker
);
```

---

### Task 11: Wire ProfanityChecker into organization server action

**Files:**

- Modify: `src/web/actions/organization.ts`

- [ ] **Step 1: Import and instantiate**

Add import:

```typescript
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';
```

Add near other dependency init:

```typescript
const profanityChecker = LeoProfanityChecker.getInstance();
```

- [ ] **Step 2: Pass to use case constructor**

Update `createOrganizationUseCase` instantiation:

```typescript
const createOrganizationUseCase = new CreateOrganizationUseCase({
  organizationRepository,
  userRepository,
  profanityChecker,
});
```

- [ ] **Step 3: Update schema usage in createOrganization action**

Replace `CreateOrganizationSchema` import with `createOrganizationSchema`:

```typescript
import { createOrganizationSchema } from '@/application/organization/CreateOrganizationSchema';
```

In the action, change:

```typescript
// Before:
const validation = CreateOrganizationSchema.safeParse(data);
// After:
const validation = createOrganizationSchema(profanityChecker).safeParse(data);
```

- [ ] **Step 4: Wire UpdateOrganizationUseCase**

In `src/application/organization/UpdateOrganizationUseCase.ts`:

- Add `profanityChecker: ProfanityChecker` to `UpdateOrganizationDependencies` interface
- Pass checker to `organization.updateName(input.name, this.deps.profanityChecker)` and `organization.updateDescription(input.description, this.deps.profanityChecker)`

In `src/web/actions/organization.ts`:

- Update `UpdateOrganizationUseCase` instantiation to include `profanityChecker`

- [ ] **Step 5: Update existing schema tests**

Update `src/application/organization/__tests__/CreateOrganizationSchema.test.ts`:

- Change from `CreateOrganizationSchema.safeParse(...)` to `createOrganizationSchema(mockProfanityChecker).safeParse(...)`
- Add a mock `ProfanityChecker` that returns `false` (no profanity) so existing tests pass unchanged
- Add new test: schema rejects profane input

- [ ] **Step 6: Run existing org tests to verify no regressions**

```bash
yarn vitest run src/domain/organization/__tests__/Organization.test.ts
yarn vitest run src/application/organization/__tests__/
```

---

## Chunk 3: Poll entities (Poll, Question, Answer) + schemas

### Task 12: TDD — Poll profanity check

**Files:**

- Modify: `src/domain/poll/__tests__/Poll.test.ts`
- Modify: `src/domain/poll/Poll.ts`

- [ ] **Step 1: Write failing tests for Poll.create, updateTitle, updateDescription, addAnswerToQuestion**

Same pattern as Organization tests — mock `ProfanityChecker` that flags "badword". Test:

- `create()` rejects title with profanity
- `create()` rejects description with profanity
- `create()` passes clean text with checker
- `create()` passes without checker (backward compat)
- `updateTitle()` rejects profanity
- `updateDescription()` rejects profanity
- `addAnswerToQuestion()` rejects answer text with profanity (via `Answer.create()`)

- [ ] **Step 2: Run tests — expect FAIL**

```bash
yarn vitest run src/domain/poll/__tests__/Poll.test.ts
```

- [ ] **Step 3: Implement profanity checks in Poll.ts**

Add optional `profanityChecker?: ProfanityChecker` param to:

- `create()` — check `title` and `description`
- `updateTitle()` — check new title
- `updateDescription()` — check new description
- `addAnswerToQuestion()` — **pass checker to `Answer.create()`, do NOT check here** (avoid double-check; Answer owns its own validation)

For `addAnswerToQuestion()`:

```typescript
public addAnswerToQuestion(
  questionId: string,
  text: string,
  order: number,
  profanityChecker?: ProfanityChecker
): Result<Answer, string> {
  // ...existing checks...
  const answerResult = Answer.create(text, order, questionId, profanityChecker);
  // ...rest unchanged...
}
```

For `create()`, `updateTitle()`, `updateDescription()` — pattern: after existing validations, before state mutation:

```typescript
if (profanityChecker?.containsProfanity(title.trim())) {
  return failure(SharedDomainCodes.CONTAINS_PROFANITY);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
yarn vitest run src/domain/poll/__tests__/Poll.test.ts
```

---

### Task 13: TDD — Question profanity check

**Files:**

- Modify: `src/domain/poll/__tests__/Poll.test.ts` (Question tests are here)
- Modify: `src/domain/poll/Question.ts`

- [ ] **Step 1: Write failing tests for Question.create, updateText, updateDetails**

- `create()` rejects text with profanity
- `create()` rejects details with profanity
- `updateText()` rejects profanity
- `updateDetails()` rejects profanity

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement in Question.ts**

Add optional `profanityChecker?: ProfanityChecker` **after `details`** as the last param in `create()`:

```typescript
public static create(
  text: string,
  pollId: string,
  page: number = 1,
  order: number = 0,
  questionType: QuestionType = 'single-choice',
  details?: string,
  profanityChecker?: ProfanityChecker
): Result<Question, string> {
```

Add optional `profanityChecker?: ProfanityChecker` to `updateText()` and `updateDetails()`.

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 14: TDD — Answer profanity check

**Files:**

- Modify: `src/domain/poll/__tests__/Poll.test.ts` (Answer tests are here)
- Modify: `src/domain/poll/Answer.ts`

- [ ] **Step 1: Write failing tests for Answer.create, updateText**

- `create()` rejects text with profanity
- `updateText()` rejects profanity

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement in Answer.ts**

Add optional `profanityChecker?: ProfanityChecker` to `create()` and `updateText()`.

Current `Answer.create()` signature: `create(text, order, questionId)` → add `profanityChecker` as 4th param:

```typescript
static create(
  text: string,
  order: number,
  questionId: string,
  profanityChecker?: ProfanityChecker
): Result<Answer, string> {
```

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 15: Convert PollSchemas to factory functions

**Files:**

- Modify: `src/application/poll/PollSchemas.ts`

- [ ] **Step 1: Convert all schemas and replace hardcoded English strings with domain codes**

Note: PollSchemas currently use hardcoded English strings (e.g., `'Poll title is required'`). Replace with domain codes from `PollDomainCodes`. **Use exact code names** from `PollDomainCodes`:

- `PollDomainCodes.POLL_TITLE_EMPTY` (not `TITLE_EMPTY`)
- `PollDomainCodes.POLL_TITLE_TOO_LONG` (not `TITLE_TOO_LONG`)
- `PollDomainCodes.POLL_DESCRIPTION_EMPTY`
- `PollDomainCodes.POLL_DESCRIPTION_TOO_LONG`
- `PollDomainCodes.QUESTION_TEXT_EMPTY`
- `PollDomainCodes.QUESTION_TEXT_TOO_LONG`
- `PollDomainCodes.QUESTION_DETAILS_TOO_LONG`
- `PollDomainCodes.ANSWER_TEXT_EMPTY`
- `PollDomainCodes.ANSWER_TEXT_TOO_LONG`

Import:

```typescript
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
```

Convert each schema to a factory function. Add `.refine()` for profanity on all text fields.

Example for `createPollSchema`:

```typescript
export const createPollSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    title: z
      .string()
      .min(1, PollDomainCodes.POLL_TITLE_EMPTY)
      .max(POLL_TITLE_MAX_LENGTH, PollDomainCodes.POLL_TITLE_TOO_LONG)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    // ...
  });
```

**For `addQuestionSchema` — the `answers` array needs per-element profanity refinement:**

```typescript
answers: z
  .array(
    z.string()
      .min(1, PollDomainCodes.ANSWER_TEXT_EMPTY)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
  )
  .min(1, 'At least one answer is required'),
```

Do the same for: `updatePollSchema`, `addQuestionSchema`, `updateQuestionSchema`, `addAnswerSchema`, `updateAnswerSchema`.

- [ ] **Step 2: Update type exports**

For each schema that exports a type, update to use `ReturnType<typeof schemaFactory>`:

```typescript
export type CreatePollInput = z.input<ReturnType<typeof createPollSchema>>;
```

---

### Task 16: Wire ProfanityChecker into poll use cases + server actions

**Files:**

- Modify: `src/application/poll/CreatePollUseCase.ts`
- Modify: `src/application/poll/UpdatePollUseCase.ts`
- Modify: `src/application/poll/AddQuestionUseCase.ts`
- Modify: `src/application/poll/UpdateQuestionUseCase.ts`
- Modify: `src/application/poll/CreateAnswerUseCase.ts`
- Modify: `src/application/poll/UpdateAnswerUseCase.ts`
- Modify: `src/web/actions/poll.ts`

- [ ] **Step 1: Add `profanityChecker: ProfanityChecker` to each use case's dependencies interface**

- [ ] **Step 2: Pass checker to entity create/update calls in each use case**

- [ ] **Step 3: In poll server action, import `LeoProfanityChecker`, create instance, pass to all use case constructors**

- [ ] **Step 4: Update schema usage in poll action — call factory functions with profanityChecker**

- [ ] **Step 5: Run poll tests**

```bash
yarn vitest run src/domain/poll/__tests__/Poll.test.ts
yarn vitest run src/application/poll/__tests__/
```

---

## Chunk 4: User, Nickname, Board entities

### Task 17: TDD — User profanity check

**Files:**

- Modify: `src/domain/user/__tests__/User.test.ts`
- Modify: `src/domain/user/User.ts`

- [ ] **Step 1: Write failing tests**

Note: `User.create()` **throws** on validation failure (not Result). Tests use `expect(() => ...).toThrow()`.

```typescript
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

describe('User profanity check', () => {
  it('should throw on firstName with profanity', () => {
    expect(() =>
      User.create(
        {
          firstName: 'badword',
          lastName: 'Doe',
          phone: PhoneNumber.create('+1234567890'),
          passwordHash: 'hashedpassword123',
          // ... other required props
        },
        mockProfanityChecker
      )
    ).toThrow(SharedDomainCodes.CONTAINS_PROFANITY);
  });

  it('should throw on lastName with profanity', () => {
    // Similar...
  });

  it('should throw on middleName with profanity', () => {
    // Similar, middleName is optional
  });

  it('should pass clean names with checker', () => {
    // Should not throw
  });

  it('should pass without checker (backward compat)', () => {
    // Should not throw
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement in User.ts**

Add optional `profanityChecker?: ProfanityChecker` as second param to `User.create()`.
After existing name validation, before constructing the user:

```typescript
if (profanityChecker?.containsProfanity(props.firstName)) {
  throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
}
if (profanityChecker?.containsProfanity(props.lastName)) {
  throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
}
if (props.middleName && profanityChecker?.containsProfanity(props.middleName)) {
  throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
}
```

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 18: TDD — Nickname profanity check

**Files:**

- Modify: `src/domain/user/__tests__/Nickname.test.ts`
- Modify: `src/domain/user/Nickname.ts`

- [ ] **Step 1: Write failing tests**

`Nickname.create()` also **throws**:

```typescript
describe('Nickname profanity check', () => {
  it('should throw on nickname with profanity', () => {
    expect(() => Nickname.create('badword_user', mockProfanityChecker)).toThrow(
      SharedDomainCodes.CONTAINS_PROFANITY
    );
  });

  it('should pass clean nickname with checker', () => {
    expect(() =>
      Nickname.create('clean_user', mockProfanityChecker)
    ).not.toThrow();
  });

  it('should pass without checker (backward compat)', () => {
    expect(() => Nickname.create('any_nickname')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement in Nickname.ts**

Add optional `profanityChecker?: ProfanityChecker` to `Nickname.create()`.
After existing validation, before constructing:

```typescript
if (profanityChecker?.containsProfanity(nickname)) {
  throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
}
```

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 19: TDD — Board profanity check

**Files:**

- Modify: `src/domain/board/__tests__/Board.test.ts` (create if doesn't exist)
- Modify: `src/domain/board/Board.ts`

- [ ] **Step 1: Write failing tests**

Board uses `Result` pattern:

```typescript
describe('Board profanity check', () => {
  it('should reject name with profanity', () => {
    const result = Board.create('badword', 'org-1', mockProfanityChecker);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
    }
  });

  it('should pass clean name with checker', () => {
    const result = Board.create('Clean Board', 'org-1', mockProfanityChecker);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement in Board.ts**

Add optional `profanityChecker?: ProfanityChecker` to `Board.create()`.

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 20: Wire into User/Nickname/Board use cases + actions

**Files:**

- Modify: `src/application/auth/RegisterUserUseCase.ts` (or wherever User.create is called)
- Modify: `src/application/auth/RegisterUserSchema.ts`
- Modify: `src/application/user/UpdateUserProfileSchema.ts`
- Modify: `src/application/board/CreateBoardUseCase.ts`
- Modify: `src/application/board/CreateBoardSchema.ts`
- Modify: `src/domain/user/User.ts` — add profanity check to `updateMiddleName()`
- Modify: `src/web/actions/auth.ts`
- Modify: `src/web/actions/board.ts`
- Modify: `src/web/actions/user.ts`

- [ ] **Step 1: Add profanityChecker to use case deps, pass to entity methods**

- [ ] **Step 2: Add profanity check to `User.updateMiddleName()`**

`User.updateMiddleName()` currently has no validation. Add optional `profanityChecker` param:

```typescript
updateMiddleName(middleName: string | undefined, profanityChecker?: ProfanityChecker): User {
  if (middleName && profanityChecker?.containsProfanity(middleName)) {
    throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
  }
  return new User({ ...this.props, middleName });
}
```

Add a test for this in `User.test.ts`.

- [ ] **Step 3: Convert RegisterUserSchema to factory function with profanity refinements on name fields**

- [ ] **Step 4: Convert UpdateUserProfileSchema to factory function**

`UpdateUserProfileSchema` has a `nickname` field that needs profanity refinement:

```typescript
export const updateUserProfileSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    userId: z.string().min(1, 'User ID is required'),
    language: z.enum(['en', 'ru']).optional(),
    nickname: z
      .string()
      .min(NICKNAME_MIN_LENGTH, UserDomainCodes.NICKNAME_INVALID)
      .max(NICKNAME_MAX_LENGTH, UserDomainCodes.NICKNAME_INVALID)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    allowFindByName: z.boolean().optional(),
    allowFindByPhone: z.boolean().optional(),
  });
```

- [ ] **Step 5: Convert CreateBoardSchema to factory function**

- [ ] **Step 6: Wire LeoProfanityChecker in server actions**

- [ ] **Step 7: Update existing schema tests that import the converted schemas**

- [ ] **Step 8: Run tests**

```bash
yarn vitest run src/domain/user/__tests__/
yarn vitest run src/domain/board/__tests__/
yarn vitest run src/application/auth/__tests__/
yarn vitest run src/application/board/__tests__/
yarn vitest run src/application/user/__tests__/
```

---

## Chunk 5: JoinToken, JoinParentRequest, ParticipantWeightHistory, HandleJoinRequest

### Task 21: TDD — JoinToken profanity check

**Files:**

- Modify: `src/domain/organization/__tests__/JoinToken.test.ts`
- Modify: `src/domain/organization/JoinToken.ts`

- [ ] **Step 1: Write failing test** — `create()` rejects description with profanity
- [ ] **Step 2: Run tests — expect FAIL**
- [ ] **Step 3: Add optional `profanityChecker` to `JoinToken.create()`, check description**
- [ ] **Step 4: Run tests — expect PASS**

---

### Task 22: TDD — JoinParentRequest profanity check

**Files:**

- Modify: `src/domain/organization/__tests__/JoinParentRequest.test.ts` (create if doesn't exist)
- Modify: `src/domain/organization/JoinParentRequest.ts`

- [ ] **Step 1: Write failing tests**

- `create()` rejects message with profanity
- `reject()` rejects rejectionReason with profanity

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement**

Add optional `profanityChecker` to `create()` and `reject()`.

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 23: TDD — ParticipantWeightHistory profanity check

**Files:**

- Modify: `src/domain/poll/__tests__/ParticipantWeightHistory.test.ts`
- Modify: `src/domain/poll/ParticipantWeightHistory.ts`

- [ ] **Step 1: Write failing test** — `create()` rejects reason with profanity (reason is nullable, only check when non-null)
- [ ] **Step 2: Run tests — expect FAIL**
- [ ] **Step 3: Implement — add optional `profanityChecker` to `create()`, check reason when non-null**
- [ ] **Step 4: Run tests — expect PASS**

---

### Task 24: Wire into remaining use cases + schemas + actions

**Files:**

- Modify: Use cases that call JoinToken.create, JoinParentRequest.create/reject, ParticipantWeightHistory.create
- Modify: `src/application/organization/CreateJoinTokenSchema.ts`
- Modify: `src/application/organization/RequestJoinParentSchema.ts`
- Modify: `src/application/organization/HandleJoinParentRequestSchema.ts`
- Modify: `src/application/organization/HandleJoinRequestSchema.ts` (rejection reason)
- Modify: Weight change schema in `src/web/actions/participant.ts`
- Modify: `src/web/actions/joinToken.ts`
- Modify: `src/web/actions/joinParentRequest.ts`
- Modify: `src/web/actions/organization.ts` (HandleJoinRequest)

- [ ] **Step 1: Convert schemas to factory functions with profanity refinements**

Explicitly:

- `CreateJoinTokenSchema` — profanity on `description`
- `RequestJoinParentSchema` — profanity on `message`
- `HandleJoinParentRequestSchema` — profanity on `rejectionReason`
- `HandleJoinRequestSchema` — profanity on `rejectionReason` (if field exists)
- Weight change schema in `participant.ts` — profanity on `reason`

- [ ] **Step 2: Add profanityChecker to use case deps, pass to entity methods**

- [ ] **Step 3: Wire LeoProfanityChecker in server actions**

- [ ] **Step 4: Run all tests**

```bash
yarn vitest run
```

---

## Chunk 6: Final verification

### Task 25: Full test suite + cleanup

- [ ] **Step 1: Run full test suite**

```bash
yarn vitest run
```

- [ ] **Step 2: Run TypeScript type check**

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Run linter**

```bash
yarn lint
```

- [ ] **Step 4: Fix any failures**

- [ ] **Step 5: Manual smoke test**

Test in browser: create an org with a profane name → should see localized error. Try clean name → should work.
