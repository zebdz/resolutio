# Password Reset by Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a user who forgot their password a self-service way back into their account, by adding an optional confirmable email address and mailing them a one-time code.

**Architecture:** Reuses the existing OTP subsystem rather than building a token mechanism — `OtpVerification` is already channel-generic (`'sms' | 'email'`), so this adds a `purpose` discriminator, an `EmailOtpDeliveryChannel` beside the SMS one, and an `EmailSender` port whose SMTP adapter is stubbed until credentials exist. The password change itself reuses `User.changePassword()` plus session revocation, exactly as the superadmin reset already does.

**Tech Stack:** TypeScript, Next.js 15 (App Router, server actions), Prisma + PostgreSQL, vitest, next-intl, Tailwind + Catalyst, nodemailer (new).

**Spec:** `readmes/2026-08-31-password-reset-email-design.md`

## Global Constraints

- **NEVER `git commit`.** Project rule. Every task ends with `git add` only; the user reviews and commits. The skill's standard "Commit" step is replaced by "Stage" throughout.
- **Stop at the end of every phase** and let the user review before starting the next. Mark the phase complete in this file first.
- **TDD is mandatory:** failing test first, run it and see it fail, then minimal implementation, then see it pass.
- **Prefer unit tests over integration tests.**
- Domain layer stays free of framework, ORM, and I/O code.
- Every server action opens with `const rateLimited = await checkRateLimit(); if (rateLimited) return rateLimited;`
- Error codes, never messages. Every new code gets entries in **both** `messages/en.json` and `messages/ru.json`. Default language is Russian.
- Translate codes in actions with `translateErrorCode` from `@/web/actions/utils/translateErrorCode` — never inline `.split('.')` logic.
- No raw SQL in `web/actions/`. Prisma tables use `@@map`, columns use `@map`.
- After `prisma migrate dev`, always run `yarn prisma:generate` — this project does not regenerate the client automatically.
- Clickable native `<button>`/`<a>` need `cursor-pointer`, plus `disabled:cursor-not-allowed` where disableable.
- Localized strings with counts/limits are parameterized — never hardcode a number into a message.
- Run one test file with `yarn vitest run <path>`; the whole suite with `yarn test`.

## Progress

_Updated 2026-08-31, during execution._

**ALL FIVE PHASES COMPLETE.** Full suite green: 305 files, 3245 tests, 0 failures.
Typecheck clean, `yarn build` succeeds, and `npx tsx prisma/verify-password-reset.ts`
passes 14/14 against the real database.

- **Task 1 — `EmailAddress` value object: DONE.** 12 tests passing.
- **Task 2 — `User` email behavior: DONE.** 8 tests passing; `src/domain/user` green at 167.
- **Task 3 — migration + repository mapping: DONE.** 4 tests passing. Migration
  `20260831195650_add_user_email` applied.
- **Task 4 — `OtpPurpose` in the domain: DONE.** 3 tests passing; `src/domain/otp` green at 25.
- **Task 5 — repository + database: DONE.** 4 tests passing. Migration
  `20260831201137_add_otp_purpose` applied.
- **Task 6 — call sites + ownership hole: DONE.** 2 new tests; `ConfirmPhoneUseCase` green at 10.
- **Task 7 — `EmailSender` port, stub, factory: DONE.** 3 tests passing.
- **Task 8 — `NodemailerEmailSender`: DONE.** 4 tests passing. `nodemailer@9.1.0` added.
- **Task 9 — `EmailOtpDeliveryChannel` + templates: DONE.** 5 channel tests, plus 5 pinning
  the template namespaces to the message files. `.env.example` documents the SMTP block.

- **Task 10 — request + confirm email: DONE.** 20 tests passing.
- **Task 11 — `ChangeUserEmailUseCase` + `maskEmail`: DONE.** 16 tests passing.
- **Task 12 — actions + account form section: DONE.** 11 action tests.
- **Task 13 — optional email at registration: DONE.** 7 tests; `RegisterUserUseCase` green at 23.
- **Task 14 — `RequestPasswordResetUseCase` + parser: DONE.** 21 tests passing.
- **Task 15 — `ResetPasswordWithOtpUseCase`: DONE.** 16 tests passing.
- **Task 16 — actions, `/forgot-password`, login link: DONE.** 10 action tests.

**Added beyond the plan:** `prisma/verify-password-reset.ts`, an end-to-end check against
the real database. Every unit test in this feature mocks its repositories, so nothing else
proved that the `purpose` column and `findByEmail` actually round-trip through Prisma. It
creates a scratch user, exercises request → reset → reuse, and deletes what it made.
Run with `npx tsx prisma/verify-password-reset.ts`.

Tasks 7 and 8 were done in the reverse of the plan's order: Task 7's factory imports Task 8's
adapter, so Task 8 had to exist for Task 7's "does not return the stub" test to pass. The
shared `EmailSender` port was written first, since both depend on it.

### Environment notes discovered during execution

1. **`prisma migrate dev` cannot run in this harness** — it is interactive, and refuses
   with "Prisma Migrate has detected that the environment is non-interactive". `--create-only`
   refuses for the same reason. Task 5's migration step needs the same workaround used here:

   ```bash
   TS=$(date +%Y%m%d%H%M%S) && DIR="prisma/migrations/${TS}_add_otp_purpose" && mkdir -p "$DIR"
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
     | grep -v "^Loaded Prisma config" > "$DIR/migration.sql"
   yarn db:migrate && yarn prisma:generate
   ```

   Note Prisma v7 renamed the diff flags: it is `--from-config-datasource` / `--to-schema`,
   not the v6 `--from-database-url` / `--to-schema-datamodel`.

2. **Two migrations were pending before this work started** —
   `20260811090000_add_poll_submitted_state` and `20260811090100_backfill_polls_submitted`.
   Applied with `yarn db:migrate` (which, unlike `migrate dev`, can never reset the database)
   before creating the new one.

3. **The generated Prisma client was stale** — `PollState.SUBMITTED` was in
   `prisma/schema.prisma:18` but absent from `generated/`, so `yarn typecheck` failed with
   7 errors before any of this work started. Same root cause as note 2: the migrations were
   authored but never applied or generated locally. Fixed with `yarn prisma:generate`.

4. **`yarn typecheck` does not cover test files** — it runs against
   `tsconfig.build.json`, which excludes them. Mock classes implementing a changed
   interface therefore drift silently: `RequestConfirmationOtpUseCase.test.ts`'s mock kept
   the old 3-argument `countRecentByIdentifier`, so the new `purpose` landed in
   `sinceHours`, producing `NaN` and disabling the throttle without any type error. Only
   `yarn test` catches this class of breakage — run it, not just typecheck, after any
   repository-interface change.

5. **`UserRepository` has several hand-written mocks.** Adding `findByEmail` in Task 3
   required updating the mocks in `ConfirmPhoneUseCase.test.ts` and
   `RequestConfirmationOtpUseCase.test.ts`. Expect the same for later tasks.

6. **Two tests need a live database** —
   `src/infrastructure/repositories/__tests__/PrismaPropertyAssetRepository.dbConstraint.test.ts`
   fails with `Can't reach database server` when Postgres is down. Not a code failure.

### Refinements to the spec

Two deliberate departures, both to serve phased delivery. Neither changes behavior:

1. **Two migrations, not one.** The spec (§10) describes a single additive migration. Splitting it into `add_user_email` (Phase 1) and `add_otp_purpose` (Phase 2) lets each phase be reviewed and rolled back on its own. Both remain additive with no backfill.
2. **`UserRepository.findByEmail` is added.** The spec implies it in §6.3 but never names it. It is required by both the reset lookup and the uniqueness check.

---

## Phase 1 — Email on the account (domain + schema) — COMPLETE

Adds the field and its behavior. Nothing sends mail yet and nothing reads the field yet; at the end of this phase the column exists, round-trips through the repository, and the invariants are locked by tests.

### Task 1: `EmailAddress` value object

**Files:**

- Create: `src/domain/user/EmailAddress.ts`
- Modify: `src/domain/user/UserDomainCodes.ts`
- Test: `src/domain/user/__tests__/EmailAddress.test.ts`

**Interfaces:**

- Consumes: `UserDomainCodes` from `src/domain/user/UserDomainCodes.ts`
- Produces: `EmailAddress` class with `static create(raw: string): EmailAddress`, `getValue(): string`, `equals(other: EmailAddress): boolean`, `toString(): string`; constant `EMAIL_MAX_LENGTH = 254`; new codes `EMAIL_INVALID`, `EMAIL_TAKEN`, `EMAIL_NOT_SET`, `EMAIL_NOT_CONFIRMED`, `EMAIL_ALREADY_CONFIRMED`

- [ ] **Step 1: Write the failing test**

Create `src/domain/user/__tests__/EmailAddress.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EmailAddress } from '../EmailAddress';
import { UserDomainCodes } from '../UserDomainCodes';

describe('EmailAddress', () => {
  it('accepts a well-formed address', () => {
    expect(EmailAddress.create('ivan@mail.ru').getValue()).toBe('ivan@mail.ru');
  });

  // Normalisation is the whole reason the unique index means anything: without
  // it "A@mail.ru" and "a@mail.ru" are two rows a human reads as one account.
  it('normalizes to trimmed lowercase', () => {
    expect(EmailAddress.create('  Ivan.Petrov@Mail.RU  ').getValue()).toBe(
      'ivan.petrov@mail.ru'
    );
  });

  it.each([
    ['no at sign', 'ivanmail.ru'],
    ['no domain', 'ivan@'],
    ['no local part', '@mail.ru'],
    ['no tld', 'ivan@mail'],
    ['spaces inside', 'iv an@mail.ru'],
    ['empty', ''],
    ['whitespace only', '   '],
    ['two at signs', 'ivan@ivan@mail.ru'],
  ])('rejects %s', (_label, raw) => {
    expect(() => EmailAddress.create(raw)).toThrow(
      UserDomainCodes.EMAIL_INVALID
    );
  });

  it('rejects an address longer than the maximum', () => {
    const tooLong = `${'a'.repeat(250)}@mail.ru`;

    expect(() => EmailAddress.create(tooLong)).toThrow(
      UserDomainCodes.EMAIL_INVALID
    );
  });

  it('compares by value, not identity', () => {
    const a = EmailAddress.create('ivan@mail.ru');
    const b = EmailAddress.create('IVAN@MAIL.RU');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(EmailAddress.create('petr@mail.ru'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/domain/user/__tests__/EmailAddress.test.ts`
Expected: FAIL — `Failed to resolve import "../EmailAddress"`

- [ ] **Step 3: Add the domain codes**

In `src/domain/user/UserDomainCodes.ts`, add these five entries inside the `UserDomainCodes` object, after `PASSWORD_MATCHES_PERSONAL_INFO`:

```ts
  EMAIL_INVALID: 'domain.user.emailInvalid',
  EMAIL_TAKEN: 'domain.user.emailTaken',
  EMAIL_NOT_SET: 'domain.user.emailNotSet',
  EMAIL_NOT_CONFIRMED: 'domain.user.emailNotConfirmed',
  EMAIL_ALREADY_CONFIRMED: 'domain.user.emailAlreadyConfirmed',
```

- [ ] **Step 4: Write the value object**

Create `src/domain/user/EmailAddress.ts`:

```ts
import { UserDomainCodes } from './UserDomainCodes';

// RFC 5321 caps a full address at 254 characters.
export const EMAIL_MAX_LENGTH = 254;

// Deliberately stricter than the RFC and deliberately simple: one local part,
// one "@", a dotted domain with a real TLD. Exotic-but-legal addresses are
// rejected in exchange for catching the typos that would otherwise send a
// reset code to a stranger.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export class EmailAddress {
  private constructor(private readonly value: string) {}

  static create(raw: string): EmailAddress {
    const normalized = (raw ?? '').trim().toLowerCase();

    if (normalized.length === 0 || normalized.length > EMAIL_MAX_LENGTH) {
      throw new Error(UserDomainCodes.EMAIL_INVALID);
    }

    if (!EMAIL_REGEX.test(normalized)) {
      throw new Error(UserDomainCodes.EMAIL_INVALID);
    }

    return new EmailAddress(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/domain/user/__tests__/EmailAddress.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 6: Add the message keys**

In `messages/en.json`, under the existing `domain.user` object:

```json
"emailInvalid": "Enter a valid email address",
"emailTaken": "That email address is already in use",
"emailNotSet": "No email address on file",
"emailNotConfirmed": "That email address is not confirmed yet",
"emailAlreadyConfirmed": "That email address is already confirmed"
```

In `messages/ru.json`, under the same object:

```json
"emailInvalid": "Введите корректный адрес электронной почты",
"emailTaken": "Этот адрес электронной почты уже используется",
"emailNotSet": "Адрес электронной почты не указан",
"emailNotConfirmed": "Этот адрес электронной почты ещё не подтверждён",
"emailAlreadyConfirmed": "Этот адрес электронной почты уже подтверждён"
```

- [ ] **Step 7: Verify and stage**

Run: `yarn vitest run src/domain/user/__tests__/EmailAddress.test.ts && yarn typecheck && yarn lf`
Expected: tests PASS, typecheck clean, lint/format clean

```bash
git add src/domain/user/EmailAddress.ts \
        src/domain/user/__tests__/EmailAddress.test.ts \
        src/domain/user/UserDomainCodes.ts \
        messages/en.json messages/ru.json
```

---

### Task 2: `User` email behavior

**Files:**

- Modify: `src/domain/user/User.ts`
- Test: `src/domain/user/__tests__/User.test.ts`

**Interfaces:**

- Consumes: `EmailAddress` from Task 1
- Produces: on `User` — `get email(): EmailAddress | undefined`, `get emailConfirmedAt(): Date | undefined`, `hasConfirmedEmail(): boolean`, `changeEmail(email: EmailAddress): User`, `confirmEmail(): User`, `removeEmail(): User`; `UserProps` gains `email?: EmailAddress` and `emailConfirmedAt?: Date`; `User.create` accepts an optional `email`

- [ ] **Step 1: Write the failing test**

Append to `src/domain/user/__tests__/User.test.ts` (add `EmailAddress` to the imports at the top):

```ts
describe('User email', () => {
  function buildUser(
    overrides: Partial<Parameters<typeof User.reconstitute>[0]> = {}
  ) {
    return User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
      ...overrides,
    });
  }

  it('has no email by default', () => {
    const user = buildUser();

    expect(user.email).toBeUndefined();
    expect(user.emailConfirmedAt).toBeUndefined();
    expect(user.hasConfirmedEmail()).toBe(false);
  });

  it('stores an email as unconfirmed', () => {
    const user = buildUser().changeEmail(EmailAddress.create('ivan@mail.ru'));

    expect(user.email?.getValue()).toBe('ivan@mail.ru');
    expect(user.hasConfirmedEmail()).toBe(false);
  });

  it('marks an email confirmed', () => {
    const user = buildUser()
      .changeEmail(EmailAddress.create('ivan@mail.ru'))
      .confirmEmail();

    expect(user.hasConfirmedEmail()).toBe(true);
    expect(user.emailConfirmedAt).toBeInstanceOf(Date);
  });

  // The load-bearing invariant. If a new address inherited the old one's
  // confirmed flag, changing to an attacker-controlled address would yield an
  // immediately reset-capable email.
  it('clears confirmation when the address changes', () => {
    const user = buildUser()
      .changeEmail(EmailAddress.create('ivan@mail.ru'))
      .confirmEmail()
      .changeEmail(EmailAddress.create('petr@mail.ru'));

    expect(user.email?.getValue()).toBe('petr@mail.ru');
    expect(user.emailConfirmedAt).toBeUndefined();
    expect(user.hasConfirmedEmail()).toBe(false);
  });

  it('clears confirmation even when re-setting the same address', () => {
    const user = buildUser()
      .changeEmail(EmailAddress.create('ivan@mail.ru'))
      .confirmEmail()
      .changeEmail(EmailAddress.create('ivan@mail.ru'));

    expect(user.hasConfirmedEmail()).toBe(false);
  });

  it('removes the email and its confirmation together', () => {
    const user = buildUser()
      .changeEmail(EmailAddress.create('ivan@mail.ru'))
      .confirmEmail()
      .removeEmail();

    expect(user.email).toBeUndefined();
    expect(user.emailConfirmedAt).toBeUndefined();
  });

  it('leaves the rest of the user untouched when the email changes', () => {
    const user = buildUser().changeEmail(EmailAddress.create('ivan@mail.ru'));

    expect(user.id).toBe('user-1');
    expect(user.firstName).toBe('Ivan');
    expect(user.phoneNumber.getValue()).toBe('+79161234567');
    expect(user.password).toBe('hash');
  });

  it('accepts an email at creation, always unconfirmed', () => {
    const user = User.create({
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      email: EmailAddress.create('ivan@mail.ru'),
    });

    expect(user.email?.getValue()).toBe('ivan@mail.ru');
    expect(user.hasConfirmedEmail()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/domain/user/__tests__/User.test.ts`
Expected: FAIL — `user.changeEmail is not a function`

- [ ] **Step 3: Extend `UserProps` and `create`**

In `src/domain/user/User.ts`, add the import:

```ts
import { EmailAddress } from './EmailAddress';
```

Add two fields to `UserProps`, after `confirmedAt`:

```ts
  email?: EmailAddress;
  emailConfirmedAt?: Date;
```

In `User.create`, add `'email' | 'emailConfirmedAt'` to the `Omit<...>` union and re-add `email` as optional in the intersection, so the signature's optional block reads:

```ts
    > & {
      language?: Language;
      consentGivenAt?: Date;
      nickname?: Nickname;
      email?: EmailAddress;
    },
```

and the returned object gains, after `privacySetupCompleted: false,`:

```ts
      email: props.email,
      emailConfirmedAt: undefined,
```

In `User.reconstitute`, both `email` and `emailConfirmedAt` flow through the existing `...props` spread — no change needed there beyond the `UserProps` addition.

- [ ] **Step 4: Add the getters and behavior**

In `src/domain/user/User.ts`, after the `confirmedAt` getter and `confirm()`:

```ts
  get email(): EmailAddress | undefined {
    return this.props.email;
  }

  get emailConfirmedAt(): Date | undefined {
    return this.props.emailConfirmedAt;
  }

  hasConfirmedEmail(): boolean {
    return !!this.props.email && this.props.emailConfirmedAt !== undefined;
  }

  /**
   * Set the address, always unconfirmed. Re-setting the same address also
   * clears confirmation: a new address must never inherit the previous one's
   * confirmed status, or changing to an attacker-controlled address would
   * yield an immediately reset-capable email.
   */
  changeEmail(email: EmailAddress): User {
    return new User({
      ...this.props,
      email,
      emailConfirmedAt: undefined,
    });
  }

  confirmEmail(): User {
    return new User({
      ...this.props,
      emailConfirmedAt: new Date(),
    });
  }

  removeEmail(): User {
    return new User({
      ...this.props,
      email: undefined,
      emailConfirmedAt: undefined,
    });
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/domain/user/__tests__/User.test.ts`
Expected: PASS — the 8 new tests plus all pre-existing ones

- [ ] **Step 6: Verify and stage**

Run: `yarn vitest run src/domain/user && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/domain/user/User.ts src/domain/user/__tests__/User.test.ts
```

---

### Task 3: Migration and repository mapping for the email columns

**Files:**

- Modify: `prisma/schema.prisma:57-97` (the `User` model)
- Modify: `src/infrastructure/repositories/PrismaUserRepository.ts`
- Modify: `src/domain/user/UserRepository.ts`
- Create: `prisma/migrations/<timestamp>_add_user_email/migration.sql` (generated)
- Test: `src/infrastructure/repositories/__tests__/PrismaUserRepository.email.test.ts`

**Interfaces:**

- Consumes: `EmailAddress` (Task 1), `User.email` / `User.emailConfirmedAt` (Task 2)
- Produces: `UserRepository.findByEmail(email: EmailAddress): Promise<User | null>`; `users.email` and `users.email_confirmed_at` columns; `USER_SELECT` and `UserRow` carry both fields

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/repositories/__tests__/PrismaUserRepository.email.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { EmailAddress } from '@/domain/user/EmailAddress';
import type { PrismaClient } from '@/generated/prisma/client';

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    firstName: 'Ivan',
    lastName: 'Ivanov',
    middleName: null,
    phoneNumber: '+79161234567',
    password: 'hash',
    language: 'ru',
    consentGivenAt: null,
    createdAt: new Date('2026-01-01'),
    nickname: 'ivan_ivanov',
    allowFindByName: false,
    allowFindByPhone: false,
    allowFindByAddress: false,
    privacySetupCompleted: false,
    confirmedAt: null,
    address: null,
    email: null,
    emailConfirmedAt: null,
    ...overrides,
  };
}

describe('PrismaUserRepository email mapping', () => {
  it('maps a stored email and its confirmation into the domain object', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(
          buildRow({
            email: 'ivan@mail.ru',
            emailConfirmedAt: new Date('2026-02-01'),
          })
        ),
      },
    } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findById('user-1');

    expect(user?.email?.getValue()).toBe('ivan@mail.ru');
    expect(user?.hasConfirmedEmail()).toBe(true);
  });

  it('maps a null email to undefined', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(buildRow()) },
    } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findById('user-1');

    expect(user?.email).toBeUndefined();
    expect(user?.hasConfirmedEmail()).toBe(false);
  });

  it('looks a user up by normalized email', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue(buildRow({ email: 'ivan@mail.ru' }));
    const prisma = { user: { findFirst } } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findByEmail(
      EmailAddress.create('IVAN@MAIL.RU')
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ivan@mail.ru' } })
    );
    expect(user?.id).toBe('user-1');
  });

  it('returns null when no user has that email', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findByEmail(
      EmailAddress.create('nobody@mail.ru')
    );

    expect(user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/infrastructure/repositories/__tests__/PrismaUserRepository.email.test.ts`
Expected: FAIL — `repository.findByEmail is not a function`

- [ ] **Step 3: Add the schema columns**

In `prisma/schema.prisma`, inside `model User`, after the `confirmedAt` line:

```prisma
  email                 String?   @unique
  emailConfirmedAt      DateTime? @map("email_confirmed_at")
```

Postgres treats NULLs as distinct under a unique index, so "optional but unique" needs no partial index.

- [ ] **Step 4: Generate and apply the migration**

```bash
npx prisma migrate dev --name add_user_email
yarn prisma:generate
```

Expected: a new `prisma/migrations/<timestamp>_add_user_email/` directory containing `ALTER TABLE "users" ADD COLUMN "email" TEXT` and `ADD COLUMN "email_confirmed_at" TIMESTAMP(3)`, plus `CREATE UNIQUE INDEX "users_email_key" ON "users"("email")`. No backfill — every existing row gets NULL, which is correct.

- [ ] **Step 5: Extend the repository interface**

In `src/domain/user/UserRepository.ts`, add the import and the method:

```ts
import { EmailAddress } from './EmailAddress';
```

```ts
  findByEmail(email: EmailAddress): Promise<User | null>;
```

Place it directly after `findByPhoneNumber` so the two lookup methods sit together.

- [ ] **Step 6: Implement the mapping**

In `src/infrastructure/repositories/PrismaUserRepository.ts`:

Add the import:

```ts
import { EmailAddress } from '@/domain/user/EmailAddress';
```

Add both fields to `USER_SELECT` (near `confirmedAt: true` at line 24):

```ts
  email: true,
  emailConfirmedAt: true,
```

Add both to the `UserRow` type (near `confirmedAt: Date | null` at line 60):

```ts
email: string | null;
emailConfirmedAt: Date | null;
```

In `toDomain` (line 439), after the `confirmedAt` mapping:

```ts
      email: user.email ? EmailAddress.create(user.email) : undefined,
      emailConfirmedAt: user.emailConfirmedAt ?? undefined,
```

In `save` (line 141), add to **both** the create and the update data objects, beside `confirmedAt`:

```ts
        email: user.email?.getValue() ?? null,
        emailConfirmedAt: user.emailConfirmedAt ?? null,
```

Add the lookup method after `findByPhoneNumber`:

```ts
  async findByEmail(email: EmailAddress): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.getValue() },
      select: USER_SELECT,
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }
```

`EmailAddress.create` already normalizes, so the stored value and the query value always agree.

- [ ] **Step 7: Run test to verify it passes**

Run: `yarn vitest run src/infrastructure/repositories/__tests__/PrismaUserRepository.email.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 8: Verify the whole suite still passes**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS. Any other test constructing a `UserRow` fixture may need the two new nullable fields added — fix those fixtures, do not weaken the type.

- [ ] **Step 9: Stage**

```bash
git add prisma/schema.prisma prisma/migrations \
        src/domain/user/UserRepository.ts \
        src/infrastructure/repositories/PrismaUserRepository.ts \
        src/infrastructure/repositories/__tests__/PrismaUserRepository.email.test.ts
```

- [ ] **Step 10: Mark the phase complete and stop for review**

Change the Phase 1 heading in this file to `## Phase 1 — Email on the account (domain + schema) — COMPLETE`, then stop and let the user review.

---

## Phase 2 — The OTP purpose discriminator — COMPLETE

Closes the cross-purpose replay described in spec §4. Today phone confirmation is the only thing issuing an OTP, so `otp_verifications` rows are distinguished only by `channel`. Once email confirmation and password reset both issue codes on channel `email`, a code minted for one would be redeemable for the other. This phase adds `purpose` and threads it through every lookup, before any code exists that could exploit the gap.

### Task 4: `OtpPurpose` in the OTP domain

**Files:**

- Modify: `src/domain/otp/OtpVerification.ts`
- Test: `src/domain/otp/__tests__/OtpVerification.test.ts`

**Interfaces:**

- Produces: `OtpPurposes` const object and `OtpPurpose` type; `OtpVerificationProps.purpose: OtpPurpose`; `OtpVerification.create` requires `purpose`; `get purpose(): OtpPurpose`

- [ ] **Step 1: Write the failing test**

Append to `src/domain/otp/__tests__/OtpVerification.test.ts`:

```ts
describe('OtpVerification purpose', () => {
  it('carries the purpose it was created for', () => {
    const otp = OtpVerification.create({
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: OtpPurposes.PASSWORD_RESET,
      code: 'hashed',
      clientIp: '127.0.0.1',
      expiresAt: new Date(Date.now() + 600_000),
      userId: 'user-1',
    });

    expect(otp.purpose).toBe('password_reset');
  });

  it('keeps the purpose across incrementAttempts and markVerified', () => {
    const otp = OtpVerification.create({
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: OtpPurposes.EMAIL_CONFIRMATION,
      code: 'hashed',
      clientIp: '127.0.0.1',
      expiresAt: new Date(Date.now() + 600_000),
      userId: 'user-1',
    });

    expect(otp.incrementAttempts().purpose).toBe('email_confirmation');
    expect(otp.markVerified().purpose).toBe('email_confirmation');
  });

  it('exposes exactly the three known purposes', () => {
    expect(Object.values(OtpPurposes)).toEqual([
      'phone_confirmation',
      'email_confirmation',
      'password_reset',
    ]);
  });
});
```

Add `OtpPurposes` to the existing import from `../OtpVerification` at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/domain/otp/__tests__/OtpVerification.test.ts`
Expected: FAIL — `OtpPurposes is not defined`

- [ ] **Step 3: Add the purpose to the domain object**

In `src/domain/otp/OtpVerification.ts`, at the top beside the existing `OtpChannel`:

```ts
export const OtpPurposes = {
  PHONE_CONFIRMATION: 'phone_confirmation',
  EMAIL_CONFIRMATION: 'email_confirmation',
  PASSWORD_RESET: 'password_reset',
} as const;

export type OtpPurpose = (typeof OtpPurposes)[keyof typeof OtpPurposes];
```

Add to `OtpVerificationProps`, after `channel`:

```ts
purpose: OtpPurpose;
```

Add to the `create` input type, after `channel: OtpChannel;`:

```ts
purpose: OtpPurpose;
```

and to the object it returns, after `channel: input.channel,`:

```ts
      purpose: input.purpose,
```

Add the getter after the `channel` getter:

```ts
  get purpose(): OtpPurpose {
    return this.props.purpose;
  }
```

`incrementAttempts` and `markVerified` already spread `...this.props`, so the purpose survives both with no further change.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/domain/otp/__tests__/OtpVerification.test.ts`
Expected: PASS. `yarn typecheck` will now fail at every `OtpVerification.create` call site — that is the point, and Task 6 fixes them.

- [ ] **Step 5: Stage**

```bash
git add src/domain/otp/OtpVerification.ts \
        src/domain/otp/__tests__/OtpVerification.test.ts
```

---

### Task 5: Thread `purpose` through the repository and the database

**Files:**

- Modify: `src/domain/otp/OtpRepository.ts`
- Modify: `src/infrastructure/repositories/PrismaOtpRepository.ts`
- Modify: `prisma/schema.prisma:517-536` (the `OtpVerification` model)
- Create: `prisma/migrations/<timestamp>_add_otp_purpose/migration.sql` (generated)
- Test: `src/infrastructure/repositories/__tests__/PrismaOtpRepository.purpose.test.ts`

**Interfaces:**

- Consumes: `OtpPurpose`, `OtpPurposes` (Task 4)
- Produces: `findLatestByIdentifier(identifier, channel, purpose)`, `countRecentByIdentifier(identifier, channel, purpose, sinceHours)`; `otp_verifications.purpose` column defaulting to `phone_confirmation`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/repositories/__tests__/PrismaOtpRepository.purpose.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { PrismaOtpRepository } from '../PrismaOtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { PrismaClient } from '@/generated/prisma/client';

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'otp-1',
    identifier: 'ivan@mail.ru',
    channel: 'email',
    purpose: 'password_reset',
    code: 'hashed',
    clientIp: '127.0.0.1',
    userId: 'user-1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 600_000),
    verifiedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('PrismaOtpRepository purpose', () => {
  it('persists the purpose on save', async () => {
    const create = vi.fn().mockResolvedValue(buildRow());
    const prisma = { otpVerification: { create } } as unknown as PrismaClient;

    await new PrismaOtpRepository(prisma).save(
      OtpVerification.create({
        identifier: 'ivan@mail.ru',
        channel: 'email',
        purpose: OtpPurposes.PASSWORD_RESET,
        code: 'hashed',
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 600_000),
        userId: 'user-1',
      })
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purpose: 'password_reset' }),
      })
    );
  });

  it('maps the purpose back into the domain object', async () => {
    const prisma = {
      otpVerification: { findUnique: vi.fn().mockResolvedValue(buildRow()) },
    } as unknown as PrismaClient;

    const otp = await new PrismaOtpRepository(prisma).findById('otp-1');

    expect(otp?.purpose).toBe('password_reset');
  });

  // The replay guard: a lookup for one purpose must never see another's rows.
  it('filters findLatestByIdentifier on purpose', async () => {
    const findFirst = vi.fn().mockResolvedValue(buildRow());
    const prisma = {
      otpVerification: { findFirst },
    } as unknown as PrismaClient;

    await new PrismaOtpRepository(prisma).findLatestByIdentifier(
      'ivan@mail.ru',
      'email',
      OtpPurposes.PASSWORD_RESET
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          identifier: 'ivan@mail.ru',
          channel: 'email',
          purpose: 'password_reset',
        },
      })
    );
  });

  it('filters countRecentByIdentifier on purpose', async () => {
    const count = vi.fn().mockResolvedValue(2);
    const prisma = { otpVerification: { count } } as unknown as PrismaClient;

    const result = await new PrismaOtpRepository(
      prisma
    ).countRecentByIdentifier(
      'ivan@mail.ru',
      'email',
      OtpPurposes.EMAIL_CONFIRMATION,
      24
    );

    expect(result).toBe(2);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          identifier: 'ivan@mail.ru',
          channel: 'email',
          purpose: 'email_confirmation',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/infrastructure/repositories/__tests__/PrismaOtpRepository.purpose.test.ts`
Expected: FAIL — the `where` clause has no `purpose` key

- [ ] **Step 3: Update the repository interface**

Replace the two methods in `src/domain/otp/OtpRepository.ts`, and widen the import:

```ts
import { OtpVerification, OtpChannel, OtpPurpose } from './OtpVerification';
```

```ts
  findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null>;

  countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    sinceHours: number
  ): Promise<number>;
```

`countRecentByClientIp` stays purpose-agnostic on purpose: it is the global per-IP ceiling and should count every code an address caused, whatever it was for.

- [ ] **Step 4: Add the schema column**

In `prisma/schema.prisma`, inside `model OtpVerification`, after the `channel` line:

```prisma
  purpose     String    @default("phone_confirmation") // "phone_confirmation" | "email_confirmation" | "password_reset"
```

Replace the existing `@@index([identifier, channel])` with:

```prisma
  @@index([identifier, channel, purpose])
```

- [ ] **Step 5: Generate and apply the migration**

```bash
npx prisma migrate dev --name add_otp_purpose
yarn prisma:generate
```

Expected: `ALTER TABLE "otp_verifications" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'phone_confirmation'` plus the index swap. Existing rows take the default, which is accurate for every one of them — phone confirmation was the only issuer. No backfill.

- [ ] **Step 6: Implement in the Prisma repository**

In `src/infrastructure/repositories/PrismaOtpRepository.ts`:

Widen the import:

```ts
import {
  OtpVerification,
  type OtpChannel,
  type OtpPurpose,
} from '@/domain/otp/OtpVerification';
```

In `save`, add to the `data` object after `channel: otp.channel,`:

```ts
        purpose: otp.purpose,
```

Replace `findLatestByIdentifier`:

```ts
  async findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    const record = await this.prisma.otpVerification.findFirst({
      where: { identifier, channel, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }
```

Replace `countRecentByIdentifier`:

```ts
  async countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    sinceHours: number
  ): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return this.prisma.otpVerification.count({
      where: {
        identifier,
        channel,
        purpose,
        createdAt: { gte: since },
      },
    });
  }
```

In the `toDomain` parameter type add `purpose: string;` after `channel: string;`, and in the object it builds add after `channel: record.channel as OtpChannel,`:

```ts
      purpose: record.purpose as OtpPurpose,
```

- [ ] **Step 7: Run test to verify it passes**

Run: `yarn vitest run src/infrastructure/repositories/__tests__/PrismaOtpRepository.purpose.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 8: Stage**

```bash
git add prisma/schema.prisma prisma/migrations \
        src/domain/otp/OtpRepository.ts \
        src/infrastructure/repositories/PrismaOtpRepository.ts \
        src/infrastructure/repositories/__tests__/PrismaOtpRepository.purpose.test.ts
```

---

### Task 6: Update existing call sites and close the OTP ownership hole

`yarn typecheck` is currently red from Tasks 4 and 5. This task makes it green and, while in the same code, adds the missing `otp.userId === user.id` check described in spec §4.2.

**Files:**

- Modify: `src/application/auth/RequestConfirmationOtpUseCase.ts:65-96`
- Modify: `src/application/auth/RegisterUserUseCase.ts:177-184`
- Modify: `src/application/auth/ConfirmPhoneUseCase.ts:47-52`
- Modify: `src/application/auth/OtpDeliveryChannel.ts`
- Modify: `src/infrastructure/auth/StubSmsOtpDeliveryChannel.ts`
- Modify: `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`
- Test: `src/application/auth/__tests__/ConfirmPhoneUseCase.test.ts`

**Interfaces:**

- Consumes: `OtpPurposes` (Task 4), the new repository signatures (Task 5)
- Produces: `OtpDeliveryChannel.send(recipient, code, locale, clientIp, purpose)` — the fifth parameter is what lets Phase 3's email channel pick a template

- [ ] **Step 1: Write the failing test**

Append to `src/application/auth/__tests__/ConfirmPhoneUseCase.test.ts`:

```ts
it('rejects an OTP that belongs to a different user', async () => {
  const foreignOtp = OtpVerification.reconstitute({
    id: 'otp-1',
    identifier: '+79161234567',
    channel: 'sms',
    purpose: OtpPurposes.PHONE_CONFIRMATION,
    code: 'hashed',
    clientIp: '127.0.0.1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 600_000),
    verifiedAt: null,
    createdAt: new Date(),
    userId: 'someone-else',
  });

  (otpRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
    foreignOtp
  );

  const result = await useCase.execute({
    userId: 'user-1',
    otpId: 'otp-1',
    code: '123456',
  });

  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error).toBe(OtpErrors.NOT_FOUND);
  }

  expect(userRepository.confirmUser).not.toHaveBeenCalled();
});
```

Add `OtpPurposes` and `OtpVerification` to the file's imports if not already present. Every other `OtpVerification.reconstitute` / `.create` fixture in this file also needs `purpose: OtpPurposes.PHONE_CONFIRMATION` added — the compiler will point at each one.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/ConfirmPhoneUseCase.test.ts`
Expected: FAIL — the use case confirms the user despite the OTP belonging to `someone-else`

- [ ] **Step 3: Add the ownership check**

In `src/application/auth/ConfirmPhoneUseCase.ts`, immediately after the `if (!otp)` block at line 49:

```ts
// The OTP must belong to the user being confirmed. Today `userId` comes
// from the session so this cannot be crossed, but nothing in the use case
// itself enforced it — and the password-reset flow runs unauthenticated.
// NOT_FOUND rather than a distinct code: a caller probing ids learns
// nothing from the difference.
if (otp.userId !== user.id) {
  return failure(OtpErrors.NOT_FOUND);
}
```

Also narrow the lookup to the right purpose, immediately after that:

```ts
if (otp.purpose !== OtpPurposes.PHONE_CONFIRMATION) {
  return failure(OtpErrors.NOT_FOUND);
}
```

with `import { OtpPurposes } from '@/domain/otp/OtpVerification';` added at the top.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/ConfirmPhoneUseCase.test.ts`
Expected: PASS

- [ ] **Step 5: Add `purpose` to the delivery channel interface**

In `src/application/auth/OtpDeliveryChannel.ts`:

```ts
import { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';

export interface OtpDeliveryResult {
  success: boolean;
  backdoorCode?: string;
}

export interface OtpDeliveryChannel {
  channel: OtpChannel;
  send(
    recipient: string,
    code: string,
    locale: string,
    clientIp: string,
    purpose: OtpPurpose
  ): Promise<OtpDeliveryResult>;
}
```

In `src/infrastructure/auth/StubSmsOtpDeliveryChannel.ts` and `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`, add a fifth parameter `_purpose: OtpPurpose` to each `send` signature. SMS templates do not vary by purpose yet, so both ignore it.

- [ ] **Step 6: Fix the two OTP-issuing call sites**

In `src/application/auth/RequestConfirmationOtpUseCase.ts`, import `OtpPurposes`, then:

- line 65, `countRecentByIdentifier(phone, this.deliveryChannel.channel, OtpPurposes.PHONE_CONFIRMATION, THROTTLE_WINDOW_HOURS)`
- line 71, `findLatestByIdentifier(phone, this.deliveryChannel.channel, OtpPurposes.PHONE_CONFIRMATION)`
- line 89, add `purpose: OtpPurposes.PHONE_CONFIRMATION,` to the `OtpVerification.create` argument
- line 101, add `OtpPurposes.PHONE_CONFIRMATION` as the fifth argument to `deliveryChannel.send`

In `src/application/auth/RegisterUserUseCase.ts`:

- line 177, add `purpose: OtpPurposes.PHONE_CONFIRMATION,` to the `OtpVerification.create` argument
- line 188, add `OtpPurposes.PHONE_CONFIRMATION` as the fifth argument to `deliveryChannel.send`

with `import { OtpPurposes } from '@/domain/otp/OtpVerification';` in both files.

- [ ] **Step 7: Verify the whole suite**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean. Any remaining failure is a test fixture missing `purpose` — add `OtpPurposes.PHONE_CONFIRMATION` to it.

- [ ] **Step 8: Stage**

```bash
git add src/application/auth src/infrastructure/auth
```

- [ ] **Step 9: Mark the phase complete and stop for review**

Change the Phase 2 heading to `## Phase 2 — The OTP purpose discriminator — COMPLETE`, then stop and let the user review.

---

## Phase 3 — Email sending infrastructure — COMPLETE

The app has never sent an email. This phase builds the capability and nothing else: a port, a stub, an SMTP adapter, and an OTP channel that renders localized templates. Per the spec's decision, the shipped default is the **stub** — real credentials come later, and the flow stays fully exercisable because the stub surfaces the code in the dev log.

### Task 7: `EmailSender` port, stub, and factory

**Files:**

- Create: `src/application/auth/EmailSender.ts`
- Create: `src/infrastructure/email/StubEmailSender.ts`
- Create: `src/infrastructure/email/emailSenderFactory.ts`
- Modify: `src/infrastructure/index.ts`
- Test: `src/infrastructure/email/__tests__/emailSenderFactory.test.ts`

**Interfaces:**

- Produces: `EmailMessage { to, subject, text, html? }`, `EmailSendResult { success, backdoorPreview? }`, `EmailSender { send(message): Promise<EmailSendResult> }`, `StubEmailSender`, `createEmailSenderFromEnv(): EmailSender`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/email/__tests__/emailSenderFactory.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmailSenderFromEnv } from '../emailSenderFactory';
import { StubEmailSender } from '../StubEmailSender';

describe('createEmailSenderFromEnv', () => {
  const originalHost = process.env.SMTP_HOST;

  beforeEach(() => {
    delete process.env.SMTP_HOST;
  });

  afterEach(() => {
    if (originalHost === undefined) {
      delete process.env.SMTP_HOST;
    } else {
      process.env.SMTP_HOST = originalHost;
    }
  });

  // Dev and tests must never send real mail by accident, exactly as
  // createSmsDeliveryChannelFromEnv falls back when SMS_RU_API_ID is absent.
  it('falls back to the stub when SMTP_HOST is absent', () => {
    expect(createEmailSenderFromEnv()).toBeInstanceOf(StubEmailSender);
  });

  it('does not return the stub once SMTP_HOST is configured', () => {
    process.env.SMTP_HOST = 'smtp.yandex.ru';

    expect(createEmailSenderFromEnv()).not.toBeInstanceOf(StubEmailSender);
  });
});

describe('StubEmailSender', () => {
  it('reports success and echoes the body for dev inspection', async () => {
    const logged = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await new StubEmailSender().send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    expect(result.success).toBe(true);
    expect(result.backdoorPreview).toBe('Ваш код: 123456');
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/infrastructure/email/__tests__/emailSenderFactory.test.ts`
Expected: FAIL — `Failed to resolve import "../emailSenderFactory"`

- [ ] **Step 3: Write the port**

Create `src/application/auth/EmailSender.ts`:

```ts
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  success: boolean;
  /**
   * The rendered body, returned by the stub only so a developer can read the
   * code out of the log. Never populated by a real transport.
   */
  backdoorPreview?: string;
}

/**
 * Deliberately separate from OtpDeliveryChannel. The address-change notice is
 * plain mail with no code in it, so the OTP interface is the wrong shape for
 * it; EmailOtpDeliveryChannel is one consumer of this port, not the port.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
```

- [ ] **Step 4: Write the stub**

Create `src/infrastructure/email/StubEmailSender.ts`:

```ts
import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from '@/application/auth/EmailSender';

/**
 * Does not send mail. Logs the message and hands the body back so the flow is
 * exercisable end to end before SMTP credentials exist. Mirrors
 * StubSmsOtpDeliveryChannel.
 */
export class StubEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.info(
      `[StubEmailSender] to=${message.to} subject=${message.subject}\n${message.text}`
    );

    return { success: true, backdoorPreview: message.text };
  }
}
```

- [ ] **Step 5: Write the factory**

Create `src/infrastructure/email/emailSenderFactory.ts`:

```ts
import type { EmailSender } from '@/application/auth/EmailSender';
import { StubEmailSender } from './StubEmailSender';
import { NodemailerEmailSender } from './NodemailerEmailSender';

/**
 * Build the email transport from environment configuration. Keyed on
 * SMTP_HOST the same way createSmsDeliveryChannelFromEnv is keyed on
 * SMS_RU_API_ID, so a deployment without credentials degrades to the stub
 * instead of throwing — and dev/test never send real mail.
 */
export function createEmailSenderFromEnv(): EmailSender {
  const host = process.env.SMTP_HOST;

  if (!host) {
    return new StubEmailSender();
  }

  return new NodemailerEmailSender({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? '',
  });
}
```

This imports `NodemailerEmailSender`, which Task 8 creates. Write Task 8's file first if you are running these strictly in order and want a green typecheck between tasks; the test above passes either way once both exist.

- [ ] **Step 6: Export from the infrastructure barrel**

In `src/infrastructure/index.ts`, after the Auth block:

```ts
// Email
export { StubEmailSender } from './email/StubEmailSender';
export { NodemailerEmailSender } from './email/NodemailerEmailSender';
export { createEmailSenderFromEnv } from './email/emailSenderFactory';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `yarn vitest run src/infrastructure/email/__tests__/emailSenderFactory.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 8: Stage**

```bash
git add src/application/auth/EmailSender.ts src/infrastructure/email src/infrastructure/index.ts
```

---

### Task 8: `NodemailerEmailSender`

**Files:**

- Create: `src/infrastructure/email/NodemailerEmailSender.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Test: `src/infrastructure/email/__tests__/NodemailerEmailSender.test.ts`

**Interfaces:**

- Consumes: `EmailSender`, `EmailMessage`, `EmailSendResult` (Task 7)
- Produces: `NodemailerEmailSender` with constructor `{ host, port, secure, user, password, from }`

- [ ] **Step 1: Install the dependency**

```bash
yarn add nodemailer && yarn add -D @types/nodemailer
```

- [ ] **Step 2: Write the failing test**

Create `src/infrastructure/email/__tests__/NodemailerEmailSender.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
  createTransport: vi.fn(() => ({ sendMail })),
}));

import { NodemailerEmailSender } from '../NodemailerEmailSender';

describe('NodemailerEmailSender', () => {
  const config = {
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true,
    user: 'noreply@resolutio.ru',
    password: 'secret',
    from: 'Resolutio <noreply@resolutio.ru>',
  };

  beforeEach(() => {
    sendMail.mockReset();
  });

  it('sends the message through the transport', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc' });

    const result = await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код подтверждения',
      text: 'Ваш код: 123456',
    });

    expect(result.success).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Resolutio <noreply@resolutio.ru>',
        to: 'ivan@mail.ru',
        subject: 'Код подтверждения',
        text: 'Ваш код: 123456',
      })
    );
  });

  // A real transport must never echo the body back — backdoorPreview is a
  // stub-only affordance and leaking a live code into a log would defeat it.
  it('never returns a backdoor preview', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc' });

    const result = await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    expect(result.backdoorPreview).toBeUndefined();
  });

  it('reports failure instead of throwing when the transport rejects', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await new NodemailerEmailSender(config).send({
      to: 'ivan@mail.ru',
      subject: 'Код',
      text: 'Ваш код: 123456',
    });

    expect(result.success).toBe(false);
    logged.mockRestore();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn vitest run src/infrastructure/email/__tests__/NodemailerEmailSender.test.ts`
Expected: FAIL — `Failed to resolve import "../NodemailerEmailSender"`

- [ ] **Step 4: Write the adapter**

Create `src/infrastructure/email/NodemailerEmailSender.ts`:

```ts
import nodemailer, { type Transporter } from 'nodemailer';
import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from '@/application/auth/EmailSender';

export interface NodemailerConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export class NodemailerEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: NodemailerConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      // No backdoorPreview: echoing a live code into the caller (and thence a
      // log) is exactly what the stub-only affordance exists to avoid.
      return { success: true };
    } catch (error) {
      // Deliberately does not log the body — it contains a live OTP.
      console.error(
        'NodemailerEmailSender send failed:',
        error instanceof Error ? error.message : error
      );

      return { success: false };
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/infrastructure/email/__tests__/NodemailerEmailSender.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 6: Document the environment variables**

Append to `.env.example` (create the file if it does not exist):

```bash
# Email delivery (SMTP). Leave SMTP_HOST unset to use the stub, which logs the
# message instead of sending it. Required only in production.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

- [ ] **Step 7: Verify and stage**

Run: `yarn vitest run src/infrastructure/email && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/infrastructure/email package.json yarn.lock .env.example
```

---

### Task 9: `EmailOtpDeliveryChannel` and its templates

**Files:**

- Create: `src/application/auth/EmailTemplateRenderer.ts`
- Create: `src/infrastructure/email/NextIntlEmailTemplateRenderer.ts`
- Create: `src/infrastructure/auth/EmailOtpDeliveryChannel.ts`
- Modify: `src/infrastructure/index.ts`
- Modify: `messages/en.json`, `messages/ru.json`
- Test: `src/infrastructure/auth/__tests__/EmailOtpDeliveryChannel.test.ts`

**Interfaces:**

- Consumes: `EmailSender` (Task 7), `OtpPurpose` (Task 4), `OtpDeliveryChannel` with its fifth `purpose` parameter (Task 6)
- Produces: `EmailTemplateRenderer { renderOtp(purpose, locale, code, expiryMinutes), renderEmailChangedNotice(locale, newEmailMasked) }`, `NextIntlEmailTemplateRenderer`, `EmailOtpDeliveryChannel` (`channel = 'email'`)

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/auth/__tests__/EmailOtpDeliveryChannel.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { EmailOtpDeliveryChannel } from '../EmailOtpDeliveryChannel';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import type { EmailSender } from '@/application/auth/EmailSender';
import type { EmailTemplateRenderer } from '@/application/auth/EmailTemplateRenderer';

function build(overrides: { sendResult?: { success: boolean } } = {}) {
  const emailSender: EmailSender = {
    send: vi.fn().mockResolvedValue(overrides.sendResult ?? { success: true }),
  };

  const templateRenderer: EmailTemplateRenderer = {
    renderOtp: vi.fn().mockResolvedValue({
      subject: 'Сброс пароля',
      text: 'Ваш код: 123456. Он действует 10 минут.',
    }),
    renderEmailChangedNotice: vi.fn(),
  };

  return {
    emailSender,
    templateRenderer,
    channel: new EmailOtpDeliveryChannel({
      emailSender,
      templateRenderer,
      expiryMinutes: 10,
    }),
  };
}

describe('EmailOtpDeliveryChannel', () => {
  it('declares the email channel', () => {
    expect(build().channel.channel).toBe('email');
  });

  it('renders the template for the requested purpose and locale', async () => {
    const { channel, templateRenderer } = build();

    await channel.send(
      'ivan@mail.ru',
      '123456',
      'ru',
      '127.0.0.1',
      OtpPurposes.PASSWORD_RESET
    );

    expect(templateRenderer.renderOtp).toHaveBeenCalledWith(
      OtpPurposes.PASSWORD_RESET,
      'ru',
      '123456',
      10
    );
  });

  it('sends the rendered message to the recipient', async () => {
    const { channel, emailSender } = build();

    await channel.send(
      'ivan@mail.ru',
      '123456',
      'ru',
      '127.0.0.1',
      OtpPurposes.EMAIL_CONFIRMATION
    );

    expect(emailSender.send).toHaveBeenCalledWith({
      to: 'ivan@mail.ru',
      subject: 'Сброс пароля',
      text: 'Ваш код: 123456. Он действует 10 минут.',
    });
  });

  it('propagates a delivery failure', async () => {
    const { channel } = build({ sendResult: { success: false } });

    const result = await channel.send(
      'ivan@mail.ru',
      '123456',
      'ru',
      '127.0.0.1',
      OtpPurposes.PASSWORD_RESET
    );

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/infrastructure/auth/__tests__/EmailOtpDeliveryChannel.test.ts`
Expected: FAIL — `Failed to resolve import "../EmailOtpDeliveryChannel"`

- [ ] **Step 3: Write the renderer port**

Create `src/application/auth/EmailTemplateRenderer.ts`:

```ts
import type { OtpPurpose } from '@/domain/otp/OtpVerification';

export interface RenderedEmail {
  subject: string;
  text: string;
}

/**
 * Renders localized email bodies. A port rather than a direct next-intl call
 * so the delivery channel stays unit-testable without a request context.
 */
export interface EmailTemplateRenderer {
  renderOtp(
    purpose: OtpPurpose,
    locale: string,
    code: string,
    expiryMinutes: number
  ): Promise<RenderedEmail>;

  renderEmailChangedNotice(
    locale: string,
    newEmailMasked: string
  ): Promise<RenderedEmail>;
}
```

- [ ] **Step 4: Write the channel**

Create `src/infrastructure/auth/EmailOtpDeliveryChannel.ts`:

```ts
import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { EmailSender } from '@/application/auth/EmailSender';
import type { EmailTemplateRenderer } from '@/application/auth/EmailTemplateRenderer';
import type { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';

interface Dependencies {
  emailSender: EmailSender;
  templateRenderer: EmailTemplateRenderer;
  expiryMinutes: number;
}

export class EmailOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'email';

  private readonly emailSender: EmailSender;
  private readonly templateRenderer: EmailTemplateRenderer;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.emailSender = deps.emailSender;
    this.templateRenderer = deps.templateRenderer;
    this.expiryMinutes = deps.expiryMinutes;
  }

  async send(
    recipient: string,
    code: string,
    locale: string,
    _clientIp: string,
    purpose: OtpPurpose
  ): Promise<OtpDeliveryResult> {
    const { subject, text } = await this.templateRenderer.renderOtp(
      purpose,
      locale,
      code,
      this.expiryMinutes
    );

    const result = await this.emailSender.send({
      to: recipient,
      subject,
      text,
    });

    return { success: result.success, backdoorCode: result.backdoorPreview };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/infrastructure/auth/__tests__/EmailOtpDeliveryChannel.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Write the next-intl renderer**

Create `src/infrastructure/email/NextIntlEmailTemplateRenderer.ts`:

```ts
import { getTranslations } from 'next-intl/server';
import type {
  EmailTemplateRenderer,
  RenderedEmail,
} from '@/application/auth/EmailTemplateRenderer';
import { OtpPurposes, type OtpPurpose } from '@/domain/otp/OtpVerification';

const NAMESPACE_BY_PURPOSE: Record<OtpPurpose, string> = {
  [OtpPurposes.PHONE_CONFIRMATION]: 'email.otp.phoneConfirmation',
  [OtpPurposes.EMAIL_CONFIRMATION]: 'email.otp.emailConfirmation',
  [OtpPurposes.PASSWORD_RESET]: 'email.otp.passwordReset',
};

export class NextIntlEmailTemplateRenderer implements EmailTemplateRenderer {
  async renderOtp(
    purpose: OtpPurpose,
    locale: string,
    code: string,
    expiryMinutes: number
  ): Promise<RenderedEmail> {
    const t = await getTranslations({
      locale,
      namespace: NAMESPACE_BY_PURPOSE[purpose],
    });

    return {
      subject: t('subject'),
      text: t('body', { code, minutes: expiryMinutes }),
    };
  }

  async renderEmailChangedNotice(
    locale: string,
    newEmailMasked: string
  ): Promise<RenderedEmail> {
    const t = await getTranslations({
      locale,
      namespace: 'email.notifications.emailChanged',
    });

    return {
      subject: t('subject'),
      text: t('body', { newEmail: newEmailMasked }),
    };
  }
}
```

- [ ] **Step 7: Add the message keys**

In `messages/en.json`, add a top-level `email` object:

```json
"email": {
  "otp": {
    "phoneConfirmation": {
      "subject": "Your Resolutio confirmation code",
      "body": "Your confirmation code is {code}. It expires in {minutes} minutes.\n\nIf you did not request it, ignore this message."
    },
    "emailConfirmation": {
      "subject": "Confirm your Resolutio email address",
      "body": "Your confirmation code is {code}. It expires in {minutes} minutes.\n\nIf you did not add this address to a Resolutio account, ignore this message."
    },
    "passwordReset": {
      "subject": "Reset your Resolutio password",
      "body": "Your password reset code is {code}. It expires in {minutes} minutes.\n\nIf you did not ask to reset your password, ignore this message — your password has not changed."
    }
  },
  "notifications": {
    "emailChanged": {
      "subject": "The email address on your Resolutio account changed",
      "body": "The email address on your account was changed to {newEmail}.\n\nIf this was not you, contact an administrator immediately — whoever made the change can now request password resets."
    }
  }
}
```

In `messages/ru.json`:

```json
"email": {
  "otp": {
    "phoneConfirmation": {
      "subject": "Код подтверждения Resolutio",
      "body": "Ваш код подтверждения: {code}. Он действует {minutes} мин.\n\nЕсли вы его не запрашивали, проигнорируйте это письмо."
    },
    "emailConfirmation": {
      "subject": "Подтвердите адрес электронной почты",
      "body": "Ваш код подтверждения: {code}. Он действует {minutes} мин.\n\nЕсли вы не добавляли этот адрес в аккаунт Resolutio, проигнорируйте это письмо."
    },
    "passwordReset": {
      "subject": "Восстановление пароля Resolutio",
      "body": "Код для смены пароля: {code}. Он действует {minutes} мин.\n\nЕсли вы не запрашивали смену пароля, проигнорируйте это письмо — пароль не изменён."
    }
  },
  "notifications": {
    "emailChanged": {
      "subject": "Адрес электронной почты в аккаунте изменён",
      "body": "Адрес электронной почты в вашем аккаунте изменён на {newEmail}.\n\nЕсли это были не вы, немедленно обратитесь к администратору — тот, кто внёс изменение, теперь может запросить смену пароля."
    }
  }
}
```

Note `{minutes}` is a parameter, not a literal — the expiry comes from `OTP_EXPIRY_MINUTES`.

- [ ] **Step 8: Export from the barrel**

In `src/infrastructure/index.ts`, extend the Email block:

```ts
export { NextIntlEmailTemplateRenderer } from './email/NextIntlEmailTemplateRenderer';
export { EmailOtpDeliveryChannel } from './auth/EmailOtpDeliveryChannel';
export { createEmailDeliveryChannelFromEnv } from './auth/emailDeliveryChannelFactory';
```

- [ ] **Step 9: Add the channel factory**

Create `src/infrastructure/auth/emailDeliveryChannelFactory.ts`:

```ts
import type { OtpDeliveryChannel } from '@/application/auth/OtpDeliveryChannel';
import { EmailOtpDeliveryChannel } from './EmailOtpDeliveryChannel';
import { NextIntlEmailTemplateRenderer } from '../email/NextIntlEmailTemplateRenderer';
import { createEmailSenderFromEnv } from '../email/emailSenderFactory';

/**
 * Build the OTP email delivery channel from environment configuration.
 * Mirrors createSmsDeliveryChannelFromEnv so the two channels are wired the
 * same way at every call site.
 */
export function createEmailDeliveryChannelFromEnv(): OtpDeliveryChannel {
  return new EmailOtpDeliveryChannel({
    emailSender: createEmailSenderFromEnv(),
    templateRenderer: new NextIntlEmailTemplateRenderer(),
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  });
}
```

- [ ] **Step 10: Verify and stage**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/application/auth/EmailTemplateRenderer.ts \
        src/infrastructure/email src/infrastructure/auth \
        src/infrastructure/index.ts messages/en.json messages/ru.json
```

- [ ] **Step 11: Mark the phase complete and stop for review**

Change the Phase 3 heading to `## Phase 3 — Email sending infrastructure — COMPLETE`, then stop and let the user review.

---

## Phase 4 — Email confirmation (authenticated) — COMPLETE

Everything here runs behind a session, so failures are reported honestly — there is nothing to hide from a caller who is already logged in. That changes in Phase 5.

### Task 10: Request and confirm an email address

**Files:**

- Create: `src/application/auth/RequestEmailConfirmationOtpUseCase.ts`
- Create: `src/application/auth/ConfirmEmailUseCase.ts`
- Test: `src/application/auth/__tests__/RequestEmailConfirmationOtpUseCase.test.ts`
- Test: `src/application/auth/__tests__/ConfirmEmailUseCase.test.ts`

**Interfaces:**

- Consumes: `User.email` / `hasConfirmedEmail` / `confirmEmail` (Task 2), `OtpPurposes` (Task 4), purpose-aware repository (Task 5), `OtpDeliveryChannel.send(..., purpose)` (Task 6)
- Produces:
  - `RequestEmailConfirmationOtpUseCase.execute({ userId, clientIp }): Promise<Result<{ otpId: string; expiresAt: Date; backdoorCode?: string; expiresInSeconds: number }, string>>`
  - `ConfirmEmailUseCase.execute({ userId, otpId, code }): Promise<Result<{ confirmed: true }, string>>`

- [ ] **Step 1: Write the failing test for the request side**

Create `src/application/auth/__tests__/RequestEmailConfirmationOtpUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestEmailConfirmationOtpUseCase } from '../RequestEmailConfirmationOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import type { OtpDeliveryChannel } from '../OtpDeliveryChannel';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('RequestEmailConfirmationOtpUseCase', () => {
  let useCase: RequestEmailConfirmationOtpUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let deliveryChannel: OtpDeliveryChannel;
  let otpCodeHasher: OtpCodeHasher;

  function buildUser(email?: string, confirmed = false) {
    let user = User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    });

    if (email) {
      user = user.changeEmail(EmailAddress.create(email));

      if (confirmed) {
        user = user.confirmEmail();
      }
    }

    return user;
  }

  beforeEach(() => {
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
    };
    otpRepository = {
      countRecentByIdentifier: vi.fn().mockResolvedValue(0),
      findLatestByIdentifier: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (otp: OtpVerification) =>
        OtpVerification.reconstitute({
          id: 'otp-1',
          identifier: otp.identifier,
          channel: otp.channel,
          purpose: otp.purpose,
          code: otp.code,
          clientIp: otp.clientIp,
          attempts: otp.attempts,
          maxAttempts: otp.maxAttempts,
          expiresAt: otp.expiresAt,
          verifiedAt: otp.verifiedAt,
          createdAt: otp.createdAt,
          userId: otp.userId,
        })
      ),
    };
    deliveryChannel = {
      channel: 'email',
      send: vi.fn().mockResolvedValue({ success: true }),
    };
    otpCodeHasher = {
      hash: vi.fn().mockReturnValue('hashed'),
      verify: vi.fn(),
    };

    useCase = new RequestEmailConfirmationOtpUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      deliveryChannel,
      otpCodeHasher,
      expiryMinutes: 10,
    });
  });

  it('issues an email_confirmation OTP to the address on file', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.identifier).toBe('ivan@mail.ru');
    expect(saved.channel).toBe('email');
    expect(saved.purpose).toBe(OtpPurposes.EMAIL_CONFIRMATION);
    expect(saved.userId).toBe('user-1');
  });

  it('delivers the code to the address with the confirmation purpose', async () => {
    await useCase.execute({ userId: 'user-1', clientIp: '127.0.0.1' });

    expect(deliveryChannel.send).toHaveBeenCalledWith(
      'ivan@mail.ru',
      expect.any(String),
      'ru',
      '127.0.0.1',
      OtpPurposes.EMAIL_CONFIRMATION
    );
  });

  it('stores only the hash of the code', async () => {
    await useCase.execute({ userId: 'user-1', clientIp: '127.0.0.1' });

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.code).toBe('hashed');
  });

  // Authenticated caller: report honestly, there is nothing to hide.
  it('fails when the user has no email on file', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser()
    );

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_NOT_SET);
    }

    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('fails when the email is already confirmed', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_ALREADY_CONFIRMED);
    }
  });

  // Throttling is scoped per purpose so confirming an address cannot consume
  // the user's ability to reset their password minutes later.
  it('throttles on the email + email channel + confirmation purpose', async () => {
    await useCase.execute({ userId: 'user-1', clientIp: '127.0.0.1' });

    expect(otpRepository.countRecentByIdentifier).toHaveBeenCalledWith(
      'ivan@mail.ru',
      'email',
      OtpPurposes.EMAIL_CONFIRMATION,
      expect.any(Number)
    );
  });

  it('fails when throttled', async () => {
    (
      otpRepository.countRecentByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(99);
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      OtpVerification.reconstitute({
        id: 'otp-0',
        identifier: 'ivan@mail.ru',
        channel: 'email',
        purpose: OtpPurposes.EMAIL_CONFIRMATION,
        code: 'hashed',
        clientIp: '127.0.0.1',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 600_000),
        verifiedAt: null,
        createdAt: new Date(),
        userId: 'user-1',
      })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.THROTTLED);
    }
  });

  it('fails when delivery fails', async () => {
    (deliveryChannel.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.SEND_FAILED);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/RequestEmailConfirmationOtpUseCase.test.ts`
Expected: FAIL — `Failed to resolve import "../RequestEmailConfirmationOtpUseCase"`

- [ ] **Step 3: Write the request use case**

Create `src/application/auth/RequestEmailConfirmationOtpUseCase.ts`:

```ts
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { UserRepository } from '@/domain/user/UserRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { getRetryAfter, THROTTLE_WINDOW_HOURS } from './OtpThrottleCalculator';

export interface RequestEmailConfirmationOtpInput {
  userId: string;
  clientIp: string;
}

export interface RequestEmailConfirmationOtpResult {
  otpId: string;
  expiresAt: Date;
  backdoorCode?: string;
  expiresInSeconds: number;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  deliveryChannel: OtpDeliveryChannel;
  otpCodeHasher: OtpCodeHasher;
  expiryMinutes?: number;
}

/**
 * Issues a confirmation code to the address a signed-in user has on file.
 * The caller is authenticated, so failures name their real cause.
 */
export class RequestEmailConfirmationOtpUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.deliveryChannel = deps.deliveryChannel;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RequestEmailConfirmationOtpInput
  ): Promise<Result<RequestEmailConfirmationOtpResult, string>> {
    if (!input.clientIp) {
      return failure(AuthErrors.MISSING_IP);
    }

    try {
      const user = await this.userRepository.findById(input.userId);

      if (!user) {
        return failure(UserDomainCodes.USER_NOT_FOUND);
      }

      if (!user.email) {
        return failure(UserDomainCodes.EMAIL_NOT_SET);
      }

      if (user.hasConfirmedEmail()) {
        return failure(UserDomainCodes.EMAIL_ALREADY_CONFIRMED);
      }

      const address = user.email.getValue();

      const recentCount = await this.otpRepository.countRecentByIdentifier(
        address,
        this.deliveryChannel.channel,
        OtpPurposes.EMAIL_CONFIRMATION,
        THROTTLE_WINDOW_HOURS
      );

      const lastOtp = await this.otpRepository.findLatestByIdentifier(
        address,
        this.deliveryChannel.channel,
        OtpPurposes.EMAIL_CONFIRMATION
      );

      if (getRetryAfter(recentCount, lastOtp?.createdAt ?? null) > 0) {
        return failure(OtpErrors.THROTTLED);
      }

      const code = OtpCode.generate();
      const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

      const saved = await this.otpRepository.save(
        OtpVerification.create({
          identifier: address,
          channel: this.deliveryChannel.channel,
          purpose: OtpPurposes.EMAIL_CONFIRMATION,
          code: this.otpCodeHasher.hash(code.getValue()),
          clientIp: input.clientIp,
          expiresAt,
          userId: user.id,
        })
      );

      const deliveryResult = await this.deliveryChannel.send(
        address,
        code.getValue(),
        user.language,
        input.clientIp,
        OtpPurposes.EMAIL_CONFIRMATION
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      return success({
        otpId: saved.id,
        expiresAt,
        backdoorCode: deliveryResult.backdoorCode,
        expiresInSeconds: this.expiryMinutes * 60,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : OtpErrors.SEND_FAILED
      );
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/RequestEmailConfirmationOtpUseCase.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Write the failing test for the confirm side**

Create `src/application/auth/__tests__/ConfirmEmailUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmEmailUseCase } from '../ConfirmEmailUseCase';
import { OtpErrors } from '../OtpErrors';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('ConfirmEmailUseCase', () => {
  let useCase: ConfirmEmailUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let otpCodeHasher: OtpCodeHasher;

  function buildOtp(
    overrides: Partial<{
      purpose: string;
      userId: string;
      expiresAt: Date;
      attempts: number;
      verifiedAt: Date | null;
    }> = {}
  ) {
    return OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: (overrides.purpose ?? OtpPurposes.EMAIL_CONFIRMATION) as never,
      code: 'hashed',
      clientIp: '127.0.0.1',
      attempts: overrides.attempts ?? 0,
      maxAttempts: 5,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 600_000),
      verifiedAt: overrides.verifiedAt ?? null,
      createdAt: new Date(),
      userId: overrides.userId ?? 'user-1',
    });
  }

  beforeEach(() => {
    const user = User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    }).changeEmail(EmailAddress.create('ivan@mail.ru'));

    userRepository = {
      findById: vi.fn().mockResolvedValue(user),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    otpRepository = {
      findById: vi.fn().mockResolvedValue(buildOtp()),
      update: vi.fn().mockImplementation(async (o: OtpVerification) => o),
    };
    otpCodeHasher = { hash: vi.fn(), verify: vi.fn().mockReturnValue(true) };

    useCase = new ConfirmEmailUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      otpCodeHasher,
    });
  });

  it('marks the email confirmed on a valid code', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(true);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.hasConfirmedEmail()).toBe(true);
  });

  it('marks the OTP verified so it cannot be reused', async () => {
    await useCase.execute({ userId: 'user-1', otpId: 'otp-1', code: '123456' });

    const updates = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(
      (updates[updates.length - 1][0] as OtpVerification).isVerified()
    ).toBe(true);
  });

  it('rejects an already-verified code', async () => {
    (otpRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildOtp({ verifiedAt: new Date() })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.ALREADY_VERIFIED);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  // The replay guard from spec §4: a reset code must not confirm an address.
  it('rejects a code minted for a different purpose', async () => {
    (otpRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildOtp({ purpose: OtpPurposes.PASSWORD_RESET })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.NOT_FOUND);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an OTP belonging to another user', async () => {
    (otpRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildOtp({ userId: 'someone-else' })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an expired code', async () => {
    (otpRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildOtp({ expiresAt: new Date(Date.now() - 1000) })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.EXPIRED);
    }
  });

  it('rejects once attempts are exhausted', async () => {
    (otpRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildOtp({ attempts: 5 })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.MAX_ATTEMPTS);
    }
  });

  it('counts a wrong code as an attempt', async () => {
    (otpCodeHasher.verify as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '000000',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }

    const attempted = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(attempted.attempts).toBe(1);
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/ConfirmEmailUseCase.test.ts`
Expected: FAIL — `Failed to resolve import "../ConfirmEmailUseCase"`

- [ ] **Step 7: Write the confirm use case**

Create `src/application/auth/ConfirmEmailUseCase.ts`:

```ts
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpErrors } from './OtpErrors';

export interface ConfirmEmailInput {
  userId: string;
  otpId: string;
  code: string;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
}

export class ConfirmEmailUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
  }

  async execute(
    input: ConfirmEmailInput
  ): Promise<Result<{ confirmed: true }, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    if (!user.email) {
      return failure(UserDomainCodes.EMAIL_NOT_SET);
    }

    const otp = await this.otpRepository.findById(input.otpId);

    if (!otp) {
      return failure(OtpErrors.NOT_FOUND);
    }

    // Ownership and purpose both answer NOT_FOUND: a caller probing ids learns
    // nothing from the difference between "not yours" and "wrong kind".
    if (otp.userId !== user.id) {
      return failure(OtpErrors.NOT_FOUND);
    }

    if (otp.purpose !== OtpPurposes.EMAIL_CONFIRMATION) {
      return failure(OtpErrors.NOT_FOUND);
    }

    // The code was issued to the address then on file. If the address has
    // changed since, this code no longer proves anything about the new one.
    if (otp.identifier !== user.email.getValue()) {
      return failure(OtpErrors.NOT_FOUND);
    }

    if (otp.isVerified()) {
      return failure(OtpErrors.ALREADY_VERIFIED);
    }

    if (otp.isExpired()) {
      return failure(OtpErrors.EXPIRED);
    }

    if (otp.hasMaxAttempts()) {
      return failure(OtpErrors.MAX_ATTEMPTS);
    }

    const incremented = otp.incrementAttempts();
    await this.otpRepository.update(incremented);

    if (!this.otpCodeHasher.verify(input.code, otp.code)) {
      return failure(OtpErrors.INVALID);
    }

    await this.otpRepository.update(incremented.markVerified());
    await this.userRepository.save(user.confirmEmail());

    return success({ confirmed: true });
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/ConfirmEmailUseCase.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 9: Stage**

```bash
git add src/application/auth/RequestEmailConfirmationOtpUseCase.ts \
        src/application/auth/ConfirmEmailUseCase.ts \
        src/application/auth/__tests__/RequestEmailConfirmationOtpUseCase.test.ts \
        src/application/auth/__tests__/ConfirmEmailUseCase.test.ts
```

---

### Task 11: `ChangeUserEmailUseCase`

**Files:**

- Create: `src/application/auth/ChangeUserEmailUseCase.ts`
- Create: `src/application/auth/maskEmail.ts`
- Test: `src/application/auth/__tests__/ChangeUserEmailUseCase.test.ts`
- Test: `src/application/auth/__tests__/maskEmail.test.ts`

**Interfaces:**

- Consumes: `User.changeEmail` (Task 2), `UserRepository.findByEmail` (Task 3), `EmailSender` (Task 7), `EmailTemplateRenderer` (Task 9)
- Produces: `ChangeUserEmailUseCase.execute({ userId, email }): Promise<Result<{ changed: true }, string>>`; `maskEmail(address: string): string`

- [ ] **Step 1: Write the failing test for masking**

Create `src/application/auth/__tests__/maskEmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { maskEmail } from '../maskEmail';

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('ivan@mail.ru')).toBe('i•••@mail.ru');
  });

  it('masks a single-character local part without revealing it', () => {
    expect(maskEmail('i@mail.ru')).toBe('•••@mail.ru');
  });

  it('leaves a malformed value fully masked', () => {
    expect(maskEmail('not-an-email')).toBe('•••');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/maskEmail.test.ts`
Expected: FAIL — `Failed to resolve import "../maskEmail"`

- [ ] **Step 3: Write the masker**

Create `src/application/auth/maskEmail.ts`:

```ts
/**
 * Render an address safe to show in a notice: enough for the owner to
 * recognize, not enough for a reader to reconstruct.
 */
export function maskEmail(address: string): string {
  const at = address.indexOf('@');

  if (at <= 0) {
    return '•••';
  }

  const local = address.slice(0, at);
  const domain = address.slice(at + 1);

  if (local.length < 2) {
    return `•••@${domain}`;
  }

  return `${local[0]}•••@${domain}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/maskEmail.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Write the failing test for the use case**

Create `src/application/auth/__tests__/ChangeUserEmailUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeUserEmailUseCase } from '../ChangeUserEmailUseCase';
import type { EmailSender } from '../EmailSender';
import type { EmailTemplateRenderer } from '../EmailTemplateRenderer';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('ChangeUserEmailUseCase', () => {
  let useCase: ChangeUserEmailUseCase;
  let userRepository: Partial<UserRepository>;
  let emailSender: EmailSender;
  let templateRenderer: EmailTemplateRenderer;

  function buildUser(email?: string, confirmed = false, id = 'user-1') {
    let user = User.reconstitute({
      id,
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    });

    if (email) {
      user = user.changeEmail(EmailAddress.create(email));

      if (confirmed) {
        user = user.confirmEmail();
      }
    }

    return user;
  }

  beforeEach(() => {
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUser()),
      findByEmail: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    emailSender = { send: vi.fn().mockResolvedValue({ success: true }) };
    templateRenderer = {
      renderOtp: vi.fn(),
      renderEmailChangedNotice: vi.fn().mockResolvedValue({
        subject: 'Адрес изменён',
        text: 'Адрес изменён на p•••@mail.ru',
      }),
    };

    useCase = new ChangeUserEmailUseCase({
      userRepository: userRepository as UserRepository,
      emailSender,
      templateRenderer,
    });
  });

  it('stores the new address unconfirmed', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(true);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.email?.getValue()).toBe('ivan@mail.ru');
    expect(saved.hasConfirmedEmail()).toBe(false);
  });

  it('normalizes the address before storing it', async () => {
    await useCase.execute({ userId: 'user-1', email: '  Ivan@Mail.RU ' });

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.email?.getValue()).toBe('ivan@mail.ru');
  });

  it('rejects an invalid address', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_INVALID);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an address already used by another account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true, 'user-2')
    );

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_TAKEN);
    }
  });

  it('allows re-saving the address the user already owns', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(true);
  });

  // The old address is the only party who can notice a hostile change.
  it('notifies the previous address when it was confirmed', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', true)
    );

    await useCase.execute({ userId: 'user-1', email: 'new@mail.ru' });

    expect(templateRenderer.renderEmailChangedNotice).toHaveBeenCalledWith(
      'ru',
      'n•••@mail.ru'
    );
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'old@mail.ru' })
    );
  });

  it('does not notify when the previous address was never confirmed', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', false)
    );

    await useCase.execute({ userId: 'user-1', email: 'new@mail.ru' });

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('does not notify when there was no previous address', async () => {
    await useCase.execute({ userId: 'user-1', email: 'new@mail.ru' });

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  // A failed courtesy notice must not roll back a change the user asked for.
  it('still succeeds when the notice cannot be delivered', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('old@mail.ru', true)
    );
    (emailSender.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      email: 'new@mail.ru',
    });

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/ChangeUserEmailUseCase.test.ts`
Expected: FAIL — `Failed to resolve import "../ChangeUserEmailUseCase"`

- [ ] **Step 7: Write the use case**

Create `src/application/auth/ChangeUserEmailUseCase.ts`:

```ts
import { UserRepository } from '@/domain/user/UserRepository';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { EmailSender } from './EmailSender';
import { EmailTemplateRenderer } from './EmailTemplateRenderer';
import { maskEmail } from './maskEmail';

export interface ChangeUserEmailInput {
  userId: string;
  email: string;
}

interface Dependencies {
  userRepository: UserRepository;
  emailSender: EmailSender;
  templateRenderer: EmailTemplateRenderer;
}

export class ChangeUserEmailUseCase {
  private readonly userRepository: UserRepository;
  private readonly emailSender: EmailSender;
  private readonly templateRenderer: EmailTemplateRenderer;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.emailSender = deps.emailSender;
    this.templateRenderer = deps.templateRenderer;
  }

  async execute(
    input: ChangeUserEmailInput
  ): Promise<Result<{ changed: true }, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    let email: EmailAddress;

    try {
      email = EmailAddress.create(input.email);
    } catch {
      return failure(UserDomainCodes.EMAIL_INVALID);
    }

    const owner = await this.userRepository.findByEmail(email);

    if (owner && owner.id !== user.id) {
      return failure(UserDomainCodes.EMAIL_TAKEN);
    }

    const previous = user.hasConfirmedEmail() ? user.email : undefined;

    await this.userRepository.save(user.changeEmail(email));

    // Tell the old address what happened. Only a confirmed address is worth
    // writing to — an unconfirmed one was never proven to belong to anyone.
    if (previous && previous.getValue() !== email.getValue()) {
      const { subject, text } =
        await this.templateRenderer.renderEmailChangedNotice(
          user.language,
          maskEmail(email.getValue())
        );

      // Best effort: a courtesy notice that fails to send must not roll back a
      // change the user explicitly asked for.
      await this.emailSender.send({ to: previous.getValue(), subject, text });
    }

    return success({ changed: true });
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/ChangeUserEmailUseCase.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 9: Verify and stage**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/application/auth
```

---

### Task 12: Email server actions and the account form section

**Files:**

- Create: `src/web/actions/user/email.ts`
- Modify: `src/app/[locale]/account/page.tsx`
- Modify: `src/web/components/account/AccountForm.tsx`
- Modify: `messages/en.json`, `messages/ru.json`
- Test: `src/web/actions/__tests__/email.user.test.ts`

**Interfaces:**

- Consumes: `ChangeUserEmailUseCase` (Task 11), `RequestEmailConfirmationOtpUseCase` / `ConfirmEmailUseCase` (Task 10), `createEmailDeliveryChannelFromEnv` (Task 9)
- Produces: `updateEmailAction(formData: FormData)`, `requestEmailConfirmationAction()`, `confirmEmailAction(formData: FormData)`, each returning `ActionResult<...>`

- [ ] **Step 1: Write the failing test**

Create `src/web/actions/__tests__/email.user.test.ts`, mirroring the shape of `userPassword.superadmin.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const checkRateLimit = vi.fn();
const getCurrentUser = vi.fn();
const changeEmailExecute = vi.fn();
const requestOtpExecute = vi.fn();

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: () => checkRateLimit(),
}));
vi.mock('@/web/lib/session', () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock('@/web/lib/clientIp', () => ({ getClientIp: async () => '127.0.0.1' }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => code,
}));
vi.mock('@/application/auth/ChangeUserEmailUseCase', () => ({
  ChangeUserEmailUseCase: class {
    execute = changeEmailExecute;
  },
}));
vi.mock('@/application/auth/RequestEmailConfirmationOtpUseCase', () => ({
  RequestEmailConfirmationOtpUseCase: class {
    execute = requestOtpExecute;
  },
}));

import { updateEmailAction } from '../user/email';

describe('updateEmailAction', () => {
  beforeEach(() => {
    checkRateLimit.mockResolvedValue(null);
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    changeEmailExecute.mockResolvedValue({
      success: true,
      value: { changed: true },
    });
    requestOtpExecute.mockResolvedValue({
      success: true,
      value: { otpId: 'otp-1', expiresInSeconds: 600 },
    });
  });

  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const form = new FormData();
    form.set('email', 'ivan@mail.ru');

    const result = await updateEmailAction(form);

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(changeEmailExecute).not.toHaveBeenCalled();
  });

  it('refuses when there is no session', async () => {
    getCurrentUser.mockResolvedValue(null);

    const form = new FormData();
    form.set('email', 'ivan@mail.ru');

    const result = await updateEmailAction(form);

    expect(result.success).toBe(false);
    expect(changeEmailExecute).not.toHaveBeenCalled();
  });

  it('changes the address and immediately sends a confirmation code', async () => {
    const form = new FormData();
    form.set('email', 'ivan@mail.ru');

    const result = await updateEmailAction(form);

    expect(result.success).toBe(true);
    expect(changeEmailExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });
    expect(requestOtpExecute).toHaveBeenCalled();
  });

  it('surfaces the domain error and sends nothing when the change is rejected', async () => {
    changeEmailExecute.mockResolvedValue({
      success: false,
      error: 'domain.user.emailTaken',
    });

    const form = new FormData();
    form.set('email', 'ivan@mail.ru');

    const result = await updateEmailAction(form);

    expect(result).toEqual({
      success: false,
      error: 'domain.user.emailTaken',
    });
    expect(requestOtpExecute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/web/actions/__tests__/email.user.test.ts`
Expected: FAIL — `Failed to resolve import "../user/email"`

- [ ] **Step 3: Write the actions**

Create `src/web/actions/user/email.ts`:

```ts
'use server';

import { getTranslations } from 'next-intl/server';
import { ChangeUserEmailUseCase } from '@/application/auth/ChangeUserEmailUseCase';
import { RequestEmailConfirmationOtpUseCase } from '@/application/auth/RequestEmailConfirmationOtpUseCase';
import { ConfirmEmailUseCase } from '@/application/auth/ConfirmEmailUseCase';
import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
  OtpCodeHasherImpl,
  createEmailSenderFromEnv,
  createEmailDeliveryChannelFromEnv,
  NextIntlEmailTemplateRenderer,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { getClientIp } from '@/web/lib/clientIp';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import type { ActionResult } from '@/web/actions/auth/auth';

const userRepository = new PrismaUserRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const deliveryChannel = createEmailDeliveryChannelFromEnv();
const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

const changeUserEmailUseCase = new ChangeUserEmailUseCase({
  userRepository,
  emailSender: createEmailSenderFromEnv(),
  templateRenderer: new NextIntlEmailTemplateRenderer(),
});

const requestEmailConfirmationOtpUseCase =
  new RequestEmailConfirmationOtpUseCase({
    userRepository,
    otpRepository,
    deliveryChannel,
    otpCodeHasher,
    expiryMinutes,
  });

const confirmEmailUseCase = new ConfirmEmailUseCase({
  userRepository,
  otpRepository,
  otpCodeHasher,
});

export interface EmailOtpIssued {
  otpId: string;
  expiresInSeconds: number;
  backdoorCode?: string;
}

export async function updateEmailAction(
  formData: FormData
): Promise<ActionResult<EmailOtpIssued | null>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const changed = await changeUserEmailUseCase.execute({
      userId: currentUser.id,
      email: (formData.get('email') as string) ?? '',
    });

    if (!changed.success) {
      return { success: false, error: await translateErrorCode(changed.error) };
    }

    // Saving an address is only half the job — it is useless until confirmed,
    // so the code goes out in the same step rather than behind a second click.
    const issued = await requestEmailConfirmationOtpUseCase.execute({
      userId: currentUser.id,
      clientIp: await getClientIp(),
    });

    if (!issued.success) {
      return { success: false, error: await translateErrorCode(issued.error) };
    }

    return {
      success: true,
      data: {
        otpId: issued.value.otpId,
        expiresInSeconds: issued.value.expiresInSeconds,
        backdoorCode: issued.value.backdoorCode,
      },
    };
  } catch (error) {
    console.error('Update email action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function requestEmailConfirmationAction(): Promise<
  ActionResult<EmailOtpIssued>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const issued = await requestEmailConfirmationOtpUseCase.execute({
      userId: currentUser.id,
      clientIp: await getClientIp(),
    });

    if (!issued.success) {
      return { success: false, error: await translateErrorCode(issued.error) };
    }

    return {
      success: true,
      data: {
        otpId: issued.value.otpId,
        expiresInSeconds: issued.value.expiresInSeconds,
        backdoorCode: issued.value.backdoorCode,
      },
    };
  } catch (error) {
    console.error('Request email confirmation action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function confirmEmailAction(
  formData: FormData
): Promise<ActionResult<{ confirmed: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const result = await confirmEmailUseCase.execute({
      userId: currentUser.id,
      otpId: (formData.get('otpId') as string) ?? '',
      code: (formData.get('code') as string) ?? '',
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: { confirmed: true } };
  } catch (error) {
    console.error('Confirm email action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/web/actions/__tests__/email.user.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Pass the email to the account page**

In `src/app/[locale]/account/page.tsx`, add to the object handed to `<AccountForm user={...} />`:

```tsx
  email: user.email?.getValue() ?? null,
  emailConfirmed: user.hasConfirmedEmail(),
```

Both are plain values — no domain object crosses the Server/Client boundary, per the project rule.

- [ ] **Step 6: Add the Email section to the account form**

In `src/web/components/account/AccountForm.tsx`:

Extend the `Props` type's `user` object:

```tsx
email: string | null;
emailConfirmed: boolean;
```

Add the imports:

```tsx
import {
  updateEmailAction,
  requestEmailConfirmationAction,
  confirmEmailAction,
} from '@/src/web/actions/user/email';
import { Badge } from '@/src/web/components/catalyst/badge';
```

Add state beside the other section states:

```tsx
// --- Email form state ---
const [isEmailPending, startEmailTransition] = useTransition();
const [emailError, setEmailError] = useState<string | null>(null);
const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
const [emailValue, setEmailValue] = useState(user.email ?? '');
const [pendingOtpId, setPendingOtpId] = useState<string | null>(null);
const [confirmCode, setConfirmCode] = useState('');

const emailChanged = emailValue.trim().toLowerCase() !== (user.email ?? '');

function handleEmailSave() {
  setEmailError(null);
  setEmailSuccess(null);

  startEmailTransition(async () => {
    const form = new FormData();
    form.set('email', emailValue);

    const result = await updateEmailAction(form);

    if (!result.success) {
      setEmailError(result.error);

      return;
    }

    setPendingOtpId(result.data?.otpId ?? null);
    setEmailSuccess(t('email.codeSent'));
    router.refresh();
  });
}

function handleResendCode() {
  setEmailError(null);
  setEmailSuccess(null);

  startEmailTransition(async () => {
    const result = await requestEmailConfirmationAction();

    if (!result.success) {
      setEmailError(result.error);

      return;
    }

    setPendingOtpId(result.data.otpId);
    setEmailSuccess(t('email.codeSent'));
  });
}

function handleConfirmCode() {
  setEmailError(null);
  setEmailSuccess(null);

  startEmailTransition(async () => {
    const form = new FormData();
    form.set('otpId', pendingOtpId ?? '');
    form.set('code', confirmCode);

    const result = await confirmEmailAction(form);

    if (!result.success) {
      setEmailError(result.error);

      return;
    }

    setPendingOtpId(null);
    setConfirmCode('');
    setEmailSuccess(t('email.confirmed'));
    router.refresh();
  });
}
```

Add the section's JSX, following the layout of the existing Preferences and Privacy sections:

```tsx
<section className="mt-10">
  <h2 className="text-base/7 font-semibold text-zinc-950 dark:text-white">
    {t('email.title')}
  </h2>
  <p className="mt-1 text-sm/6 text-zinc-500 dark:text-zinc-400">
    {t('email.description')}
  </p>

  {emailError && <AlertBanner type="error">{emailError}</AlertBanner>}
  {emailSuccess && <AlertBanner type="success">{emailSuccess}</AlertBanner>}

  <FieldGroup className="mt-6">
    <Field>
      <Label>{t('email.label')}</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          disabled={isEmailPending}
          className="sm:flex-1"
        />
        <Button
          type="button"
          onClick={handleEmailSave}
          disabled={isEmailPending || !emailChanged || !emailValue.trim()}
          className="cursor-pointer disabled:cursor-not-allowed"
        >
          {t('email.save')}
        </Button>
      </div>
      <Description>
        {user.email && user.emailConfirmed ? (
          <Badge color="green">{t('email.confirmedBadge')}</Badge>
        ) : user.email ? (
          <Badge color="amber">{t('email.unconfirmedBadge')}</Badge>
        ) : (
          t('email.none')
        )}
      </Description>
    </Field>

    {user.email && !user.emailConfirmed && (
      <Field>
        <Label>{t('email.codeLabel')}</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            disabled={isEmailPending}
            className="sm:flex-1"
          />
          <Button
            type="button"
            onClick={handleConfirmCode}
            disabled={isEmailPending || confirmCode.length !== 6}
            className="cursor-pointer disabled:cursor-not-allowed"
          >
            {t('email.confirm')}
          </Button>
          <Button
            type="button"
            plain
            onClick={handleResendCode}
            disabled={isEmailPending}
            className="cursor-pointer disabled:cursor-not-allowed"
          >
            {t('email.resend')}
          </Button>
        </div>
      </Field>
    )}
  </FieldGroup>
</section>
```

- [ ] **Step 7: Add the message keys**

In `messages/en.json`, under `account`:

```json
"email": {
  "title": "Email address",
  "description": "Optional. Once confirmed, it lets you reset your password yourself.",
  "label": "Email",
  "save": "Save",
  "none": "No email address on file",
  "confirmedBadge": "Confirmed",
  "unconfirmedBadge": "Not confirmed",
  "codeLabel": "Confirmation code",
  "confirm": "Confirm",
  "resend": "Send again",
  "codeSent": "We sent a confirmation code to that address",
  "confirmed": "Email address confirmed"
}
```

In `messages/ru.json`, under `account`:

```json
"email": {
  "title": "Адрес электронной почты",
  "description": "Необязательно. После подтверждения вы сможете самостоятельно восстановить пароль.",
  "label": "Электронная почта",
  "save": "Сохранить",
  "none": "Адрес не указан",
  "confirmedBadge": "Подтверждён",
  "unconfirmedBadge": "Не подтверждён",
  "codeLabel": "Код подтверждения",
  "confirm": "Подтвердить",
  "resend": "Отправить ещё раз",
  "codeSent": "Мы отправили код подтверждения на этот адрес",
  "confirmed": "Адрес электронной почты подтверждён"
}
```

- [ ] **Step 8: Verify and stage**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/web/actions/user/email.ts \
        src/web/actions/__tests__/email.user.test.ts \
        src/app/\[locale\]/account/page.tsx \
        src/web/components/account/AccountForm.tsx \
        messages/en.json messages/ru.json
```

---

### Task 13: Optional email at registration

**Files:**

- Modify: `src/application/auth/RegisterUserSchema.ts`
- Modify: `src/application/auth/RegisterUserUseCase.ts`
- Modify: `src/web/actions/auth/auth.ts:133-253` (`registerAction`)
- Modify: `src/web/components/auth/RegisterForm.tsx`
- Modify: `messages/en.json`, `messages/ru.json`
- Test: `src/application/auth/__tests__/RegisterUserUseCase.test.ts`

**Interfaces:**

- Consumes: `EmailAddress` (Task 1), `User.create({ email })` (Task 2), `ChangeUserEmailUseCase` is **not** used here — registration writes the address directly as part of creating the aggregate
- Produces: `RegisterUserInput` gains `email?: string`; `RegisterResult` gains `emailOtpId?: string`

- [ ] **Step 1: Write the failing test**

Append to `src/application/auth/__tests__/RegisterUserUseCase.test.ts`:

```ts
describe('registration with an email address', () => {
  it('stores the address unconfirmed', async () => {
    const result = await useCase.execute({
      ...validInput,
      email: 'Ivan@Mail.RU',
    });

    expect(result.success).toBe(true);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.email?.getValue()).toBe('ivan@mail.ru');
    expect(saved.hasConfirmedEmail()).toBe(false);
  });

  it('issues an email_confirmation code alongside the phone code', async () => {
    await useCase.execute({ ...validInput, email: 'ivan@mail.ru' });

    const purposes = (
      otpRepository.save as ReturnType<typeof vi.fn>
    ).mock.calls.map((call) => (call[0] as OtpVerification).purpose);

    expect(purposes).toContain(OtpPurposes.PHONE_CONFIRMATION);
    expect(purposes).toContain(OtpPurposes.EMAIL_CONFIRMATION);
  });

  it('registers normally when no email is given', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.email).toBeUndefined();

    const purposes = (
      otpRepository.save as ReturnType<typeof vi.fn>
    ).mock.calls.map((call) => (call[0] as OtpVerification).purpose);
    expect(purposes).not.toContain(OtpPurposes.EMAIL_CONFIRMATION);
  });

  it('rejects an address already used by another account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-2',
    });

    const result = await useCase.execute({
      ...validInput,
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_TAKEN);
    }
  });

  // Registration must not die because a mail server is down; the phone flow is
  // the one that actually gates the account.
  it('still registers when the confirmation email cannot be sent', async () => {
    (emailDeliveryChannel.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await useCase.execute({
      ...validInput,
      email: 'ivan@mail.ru',
    });

    expect(result.success).toBe(true);
  });
});
```

Add to the suite's `beforeEach`: `userRepository.findByEmail = vi.fn().mockResolvedValue(null);` and an `emailDeliveryChannel` mock (`{ channel: 'email', send: vi.fn().mockResolvedValue({ success: true }) }`) passed to the use case as `emailDeliveryChannel`.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/RegisterUserUseCase.test.ts`
Expected: FAIL — the saved user has no email

- [ ] **Step 3: Add email to the schema**

In `src/application/auth/RegisterUserSchema.ts`, add to the object, after `phoneNumber`:

```ts
      email: z
        .string()
        .trim()
        .toLowerCase()
        .regex(EMAIL_REGEX, UserDomainCodes.EMAIL_INVALID)
        .max(EMAIL_MAX_LENGTH, UserDomainCodes.EMAIL_INVALID)
        .optional()
        .or(z.literal('')),
```

with `import { EMAIL_REGEX, EMAIL_MAX_LENGTH } from '../../domain/user/EmailAddress';` at the top.

- [ ] **Step 4: Wire it through the use case**

In `src/application/auth/RegisterUserUseCase.ts`:

Add `email?: string;` to `RegisterUserInput`, `emailOtpId?: string;` to `RegisterResult`, and `emailDeliveryChannel?: OtpDeliveryChannel;` to `Dependencies` (stored as a private field in the constructor).

After the phone-existence check and before the user is built, resolve and guard the address:

```ts
let email: EmailAddress | undefined;

if (input.email && input.email.trim().length > 0) {
  try {
    email = EmailAddress.create(input.email);
  } catch {
    return failure(UserDomainCodes.EMAIL_INVALID);
  }

  const emailOwner = await this.userRepository.findByEmail(email);

  if (emailOwner && emailOwner.id !== existingUser?.id) {
    return failure(UserDomainCodes.EMAIL_TAKEN);
  }
}
```

Pass `email` into both the `User.create({ ... })` call and the `User.reconstitute({ ... })` re-registration branch.

After the phone OTP is sent, issue the email one:

```ts
let emailOtpId: string | undefined;

if (email && this.emailDeliveryChannel) {
  const emailCode = OtpCode.generate();

  const savedEmailOtp = await this.otpRepository.save(
    OtpVerification.create({
      identifier: email.getValue(),
      channel: this.emailDeliveryChannel.channel,
      purpose: OtpPurposes.EMAIL_CONFIRMATION,
      code: this.otpCodeHasher.hash(emailCode.getValue()),
      clientIp: input.clientIp,
      expiresAt: otpExpiresAt,
      userId: savedUser.id,
    })
  );

  emailOtpId = savedEmailOtp.id;

  // Best effort. The phone flow is what gates the account; a mail server
  // being down must not fail a registration. The user can send a fresh
  // code from the account page whenever they like.
  await this.emailDeliveryChannel.send(
    email.getValue(),
    emailCode.getValue(),
    savedUser.language,
    input.clientIp,
    OtpPurposes.EMAIL_CONFIRMATION
  );
}
```

and add `emailOtpId` to the returned `success({ ... })` object.

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/RegisterUserUseCase.test.ts`
Expected: PASS

- [ ] **Step 6: Wire the action and the form**

In `src/web/actions/auth/auth.ts`, inside `registerAction`, read `email` from the form data and pass it to the use case; construct the use case with `emailDeliveryChannel: createEmailDeliveryChannelFromEnv()`.

In `src/web/components/auth/RegisterForm.tsx`, add the optional field beside the phone input, following the existing field markup:

```tsx
<Field>
  <Label>{t('email')}</Label>
  <Input
    type="email"
    name="email"
    autoComplete="email"
    inputMode="email"
    value={values.email}
    onChange={handleChange}
    invalid={!!fieldErrors.email}
  />
  <Description>{t('emailOptional')}</Description>
  {fieldErrors.email && <ErrorMessage>{fieldErrors.email[0]}</ErrorMessage>}
</Field>
```

and add `email: ''` to the form's initial `values` state.

- [ ] **Step 7: Add the message keys**

In `messages/en.json`, under `auth.register`:

```json
"email": "Email",
"emailOptional": "Optional. Lets you reset your password yourself if you forget it."
```

In `messages/ru.json`, under `auth.register`:

```json
"email": "Электронная почта",
"emailOptional": "Необязательно. Позволит самостоятельно восстановить пароль."
```

- [ ] **Step 8: Verify and stage**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/application/auth src/web/actions/auth/auth.ts \
        src/web/components/auth/RegisterForm.tsx \
        messages/en.json messages/ru.json
```

- [ ] **Step 9: Mark the phase complete and stop for review**

Change the Phase 4 heading to `## Phase 4 — Email confirmation (authenticated) — COMPLETE`, then stop and let the user review.

---

## Phase 5 — Password reset (unauthenticated) — COMPLETE

The rules invert here. There is no session, so nothing the caller supplies is trusted, and no failure may reveal whether an account exists. Read spec §4.2 and §4.3 before starting.

### Task 14: `RequestPasswordResetUseCase`

**Files:**

- Create: `src/application/auth/parseAccountIdentifier.ts`
- Create: `src/application/auth/RequestPasswordResetUseCase.ts`
- Test: `src/application/auth/__tests__/parseAccountIdentifier.test.ts`
- Test: `src/application/auth/__tests__/RequestPasswordResetUseCase.test.ts`

**Interfaces:**

- Consumes: `EmailAddress` (Task 1), `UserRepository.findByEmail` (Task 3), `OtpPurposes` (Task 4), purpose-aware repository (Task 5)
- Produces:
  - `parseAccountIdentifier(raw: string): AccountIdentifier | null` where `AccountIdentifier = { kind: 'email'; email: EmailAddress } | { kind: 'phone'; phone: PhoneNumber }`
  - `RequestPasswordResetUseCase.execute({ identifier, clientIp }): Promise<Result<{ requested: true }, string>>`

- [ ] **Step 1: Write the failing test for identifier parsing**

Create `src/application/auth/__tests__/parseAccountIdentifier.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAccountIdentifier } from '../parseAccountIdentifier';

describe('parseAccountIdentifier', () => {
  it('reads an email address', () => {
    const parsed = parseAccountIdentifier('  Ivan@Mail.RU ');

    expect(parsed?.kind).toBe('email');

    if (parsed?.kind === 'email') {
      expect(parsed.email.getValue()).toBe('ivan@mail.ru');
    }
  });

  it('reads an E.164 phone number', () => {
    const parsed = parseAccountIdentifier('+79161234567');

    expect(parsed?.kind).toBe('phone');

    if (parsed?.kind === 'phone') {
      expect(parsed.phone.getValue()).toBe('+79161234567');
    }
  });

  it('tolerates a phone number typed with spaces and dashes', () => {
    const parsed = parseAccountIdentifier('+7 (916) 123-45-67');

    expect(parsed?.kind).toBe('phone');

    if (parsed?.kind === 'phone') {
      expect(parsed.phone.getValue()).toBe('+79161234567');
    }
  });

  it('returns null for something that is neither', () => {
    expect(parseAccountIdentifier('ivan')).toBeNull();
    expect(parseAccountIdentifier('')).toBeNull();
    expect(parseAccountIdentifier('   ')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/parseAccountIdentifier.test.ts`
Expected: FAIL — `Failed to resolve import "../parseAccountIdentifier"`

- [ ] **Step 3: Write the parser**

Create `src/application/auth/parseAccountIdentifier.ts`:

```ts
import { EmailAddress } from '@/domain/user/EmailAddress';
import { PhoneNumber } from '@/domain/user/PhoneNumber';

export type AccountIdentifier =
  | { kind: 'email'; email: EmailAddress }
  | { kind: 'phone'; phone: PhoneNumber };

/**
 * Read whichever identifier the user typed on the forgot-password screen.
 * Returns null when it is neither — a purely syntactic verdict that reveals
 * nothing about which accounts exist.
 */
export function parseAccountIdentifier(raw: string): AccountIdentifier | null {
  const trimmed = (raw ?? '').trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.includes('@')) {
    try {
      return { kind: 'email', email: EmailAddress.create(trimmed) };
    } catch {
      return null;
    }
  }

  // People type phone numbers with spaces, brackets and dashes; PhoneNumber
  // only accepts E.164, so strip the decoration before handing it over.
  const digits = trimmed.replace(/[^\d+]/g, '');
  const normalized = digits.startsWith('+') ? digits : `+${digits}`;

  try {
    return { kind: 'phone', phone: PhoneNumber.create(normalized) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/parseAccountIdentifier.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Write the failing test for the use case**

Create `src/application/auth/__tests__/RequestPasswordResetUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestPasswordResetUseCase } from '../RequestPasswordResetUseCase';
import { AuthErrors } from '../AuthErrors';
import type { OtpDeliveryChannel } from '../OtpDeliveryChannel';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('RequestPasswordResetUseCase', () => {
  let useCase: RequestPasswordResetUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let deliveryChannel: OtpDeliveryChannel;
  let otpCodeHasher: OtpCodeHasher;

  function buildUser(email?: string, confirmed = true) {
    let user = User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    });

    if (email) {
      user = user.changeEmail(EmailAddress.create(email));

      if (confirmed) {
        user = user.confirmEmail();
      }
    }

    return user;
  }

  beforeEach(() => {
    userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
      findByPhoneNumber: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
    };
    otpRepository = {
      countRecentByIdentifier: vi.fn().mockResolvedValue(0),
      findLatestByIdentifier: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (otp: OtpVerification) => otp),
    };
    deliveryChannel = {
      channel: 'email',
      send: vi.fn().mockResolvedValue({ success: true }),
    };
    otpCodeHasher = {
      hash: vi.fn().mockReturnValue('hashed'),
      verify: vi.fn(),
    };

    useCase = new RequestPasswordResetUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      deliveryChannel,
      otpCodeHasher,
      expiryMinutes: 10,
    });
  });

  it('issues a password_reset OTP to the confirmed address', async () => {
    const result = await useCase.execute({
      identifier: 'ivan@mail.ru',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.identifier).toBe('ivan@mail.ru');
    expect(saved.purpose).toBe(OtpPurposes.PASSWORD_RESET);
    expect(saved.userId).toBe('user-1');
  });

  it('resolves a phone identifier to the same address', async () => {
    await useCase.execute({
      identifier: '+79161234567',
      clientIp: '127.0.0.1',
    });

    expect(userRepository.findByPhoneNumber).toHaveBeenCalled();

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.identifier).toBe('ivan@mail.ru');
  });

  // The three no-enumeration cases. The second assertion is the one that
  // matters: a caller must not be able to time or infer the difference from
  // whether a row was written.
  it('reports success and writes nothing for an unknown account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await useCase.execute({
      identifier: 'nobody@mail.ru',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
    expect(deliveryChannel.send).not.toHaveBeenCalled();
  });

  it('reports success and writes nothing when the account has no email', async () => {
    (
      userRepository.findByPhoneNumber as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildUser());

    const result = await useCase.execute({
      identifier: '+79161234567',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('reports success and writes nothing when the email is unconfirmed', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', false)
    );

    const result = await useCase.execute({
      identifier: 'ivan@mail.ru',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('reports success even when delivery fails', async () => {
    (deliveryChannel.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await useCase.execute({
      identifier: 'ivan@mail.ru',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);
  });

  it('reports success when throttled, so the throttle is not an oracle either', async () => {
    (
      otpRepository.countRecentByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(99);
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      OtpVerification.reconstitute({
        id: 'otp-0',
        identifier: 'ivan@mail.ru',
        channel: 'email',
        purpose: OtpPurposes.PASSWORD_RESET,
        code: 'hashed',
        clientIp: '127.0.0.1',
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 600_000),
        verifiedAt: null,
        createdAt: new Date(),
        userId: 'user-1',
      })
    );

    const result = await useCase.execute({
      identifier: 'ivan@mail.ru',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  // Syntactic, not existential — safe to report.
  it('rejects an identifier that is neither a phone nor an email', async () => {
    const result = await useCase.execute({
      identifier: 'ivan',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);
  });

  it('requires a client IP', async () => {
    const result = await useCase.execute({
      identifier: 'ivan@mail.ru',
      clientIp: '',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.MISSING_IP);
    }
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/RequestPasswordResetUseCase.test.ts`
Expected: FAIL — `Failed to resolve import "../RequestPasswordResetUseCase"`

- [ ] **Step 7: Write the use case**

Create `src/application/auth/RequestPasswordResetUseCase.ts`:

```ts
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { AuthErrors } from './AuthErrors';
import { parseAccountIdentifier } from './parseAccountIdentifier';
import { getRetryAfter, THROTTLE_WINDOW_HOURS } from './OtpThrottleCalculator';

export interface RequestPasswordResetInput {
  identifier: string;
  clientIp: string;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  deliveryChannel: OtpDeliveryChannel;
  otpCodeHasher: OtpCodeHasher;
  expiryMinutes?: number;
}

/**
 * Unauthenticated. Every outcome that depends on account state — unknown
 * account, no address, unconfirmed address, throttled, delivery failed —
 * reports the same success, so the response is not an oracle for which
 * accounts exist. Only a syntactically unusable identifier is reported as a
 * failure, and that verdict reveals nothing.
 */
export class RequestPasswordResetUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.deliveryChannel = deps.deliveryChannel;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RequestPasswordResetInput
  ): Promise<Result<{ requested: true }, string>> {
    if (!input.clientIp) {
      return failure(AuthErrors.MISSING_IP);
    }

    const parsed = parseAccountIdentifier(input.identifier);

    if (!parsed) {
      return failure(UserDomainCodes.EMAIL_INVALID);
    }

    try {
      const user =
        parsed.kind === 'email'
          ? await this.userRepository.findByEmail(parsed.email)
          : await this.userRepository.findByPhoneNumber(parsed.phone);

      await this.issueIfEligible(user, input.clientIp);
    } catch (error) {
      // Even an unexpected fault must not distinguish itself from the happy
      // path to the caller. Log it, report the same thing.
      console.error('Password reset request failed:', error);
    }

    return success({ requested: true });
  }

  private async issueIfEligible(
    user: User | null,
    clientIp: string
  ): Promise<void> {
    if (!user || !user.hasConfirmedEmail() || !user.email) {
      return;
    }

    const address = user.email.getValue();

    const recentCount = await this.otpRepository.countRecentByIdentifier(
      address,
      this.deliveryChannel.channel,
      OtpPurposes.PASSWORD_RESET,
      THROTTLE_WINDOW_HOURS
    );

    const lastOtp = await this.otpRepository.findLatestByIdentifier(
      address,
      this.deliveryChannel.channel,
      OtpPurposes.PASSWORD_RESET
    );

    if (getRetryAfter(recentCount, lastOtp?.createdAt ?? null) > 0) {
      return;
    }

    const code = OtpCode.generate();

    await this.otpRepository.save(
      OtpVerification.create({
        identifier: address,
        channel: this.deliveryChannel.channel,
        purpose: OtpPurposes.PASSWORD_RESET,
        code: this.otpCodeHasher.hash(code.getValue()),
        clientIp,
        expiresAt: new Date(Date.now() + this.expiryMinutes * 60 * 1000),
        userId: user.id,
      })
    );

    await this.deliveryChannel.send(
      address,
      code.getValue(),
      user.language,
      clientIp,
      OtpPurposes.PASSWORD_RESET
    );
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/RequestPasswordResetUseCase.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 9: Stage**

```bash
git add src/application/auth/parseAccountIdentifier.ts \
        src/application/auth/RequestPasswordResetUseCase.ts \
        src/application/auth/__tests__/parseAccountIdentifier.test.ts \
        src/application/auth/__tests__/RequestPasswordResetUseCase.test.ts
```

---

### Task 15: `ResetPasswordWithOtpUseCase`

**Files:**

- Create: `src/application/auth/ResetPasswordSchema.ts`
- Create: `src/application/auth/ResetPasswordWithOtpUseCase.ts`
- Test: `src/application/auth/__tests__/ResetPasswordWithOtpUseCase.test.ts`

**Interfaces:**

- Consumes: `parseAccountIdentifier` (Task 14), `User.changePassword` (`src/domain/user/User.ts:360`), `SessionRepository.deleteAllForUser`, `PasswordHasher` from `RegisterUserUseCase`
- Produces: `ResetPasswordWithOtpUseCase.execute({ identifier, code, newPassword }): Promise<Result<{ reset: true }, string>>`; `resetPasswordSchema`

- [ ] **Step 1: Write the failing test**

Create `src/application/auth/__tests__/ResetPasswordWithOtpUseCase.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetPasswordWithOtpUseCase } from '../ResetPasswordWithOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import type { PasswordHasher } from '../RegisterUserUseCase';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';
import type { SessionRepository } from '@/domain/user/SessionRepository';

describe('ResetPasswordWithOtpUseCase', () => {
  let useCase: ResetPasswordWithOtpUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let sessionRepository: Partial<SessionRepository>;
  let otpCodeHasher: OtpCodeHasher;
  let passwordHasher: PasswordHasher;

  const GOOD_PASSWORD = 'Korova-Zabor-71';

  function buildUser() {
    return User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'old-hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    })
      .changeEmail(EmailAddress.create('ivan@mail.ru'))
      .confirmEmail();
  }

  function buildOtp(
    overrides: Partial<{
      purpose: string;
      expiresAt: Date;
      attempts: number;
      verifiedAt: Date | null;
      userId: string;
    }> = {}
  ) {
    return OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: (overrides.purpose ?? OtpPurposes.PASSWORD_RESET) as never,
      code: 'hashed',
      clientIp: '127.0.0.1',
      attempts: overrides.attempts ?? 0,
      maxAttempts: 5,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 600_000),
      verifiedAt: overrides.verifiedAt ?? null,
      createdAt: new Date(),
      userId: overrides.userId ?? 'user-1',
    });
  }

  beforeEach(() => {
    userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser()),
      findByPhoneNumber: vi.fn().mockResolvedValue(buildUser()),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    otpRepository = {
      findLatestByIdentifier: vi.fn().mockResolvedValue(buildOtp()),
      update: vi.fn().mockImplementation(async (o: OtpVerification) => o),
    };
    sessionRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    otpCodeHasher = { hash: vi.fn(), verify: vi.fn().mockReturnValue(true) };
    passwordHasher = { hash: vi.fn().mockResolvedValue('new-hash') };

    useCase = new ResetPasswordWithOtpUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      sessionRepository: sessionRepository as SessionRepository,
      otpCodeHasher,
      passwordHasher,
    });
  });

  function run(
    overrides: Partial<{
      identifier: string;
      code: string;
      newPassword: string;
    }> = {}
  ) {
    return useCase.execute({
      identifier: overrides.identifier ?? 'ivan@mail.ru',
      code: overrides.code ?? '123456',
      newPassword: overrides.newPassword ?? GOOD_PASSWORD,
    });
  }

  it('stores the hash of the new password', async () => {
    const result = await run();

    expect(result.success).toBe(true);
    expect(passwordHasher.hash).toHaveBeenCalledWith(GOOD_PASSWORD);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.password).toBe('new-hash');
  });

  // Same reasoning as the superadmin reset: a reset prompted by suspected
  // compromise is pointless if the compromiser's session survives it.
  it('revokes every existing session', async () => {
    await run();

    expect(sessionRepository.deleteAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('marks the code verified so it cannot be spent twice', async () => {
    await run();

    const updates = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(
      (updates[updates.length - 1][0] as OtpVerification).isVerified()
    ).toBe(true);
  });

  it('accepts a phone identifier and looks up the same reset code', async () => {
    await run({ identifier: '+79161234567' });

    expect(otpRepository.findLatestByIdentifier).toHaveBeenCalledWith(
      'ivan@mail.ru',
      'email',
      OtpPurposes.PASSWORD_RESET
    );
  });

  // The cross-purpose replay from spec §4 — the reason the purpose column
  // exists at all.
  it('refuses a code minted to confirm an email address', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ purpose: OtpPurposes.EMAIL_CONFIRMATION }));

    const result = await run();

    expect(result.success).toBe(false);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });

  it('refuses an expired code', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ expiresAt: new Date(Date.now() - 1000) }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.EXPIRED);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a code that was already spent', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ verifiedAt: new Date() }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.ALREADY_VERIFIED);
    }
  });

  it('refuses once attempts are exhausted', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ attempts: 5 }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.MAX_ATTEMPTS);
    }
  });

  it('counts a wrong code as an attempt and changes nothing', async () => {
    (otpCodeHasher.verify as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await run({ code: '000000' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }

    const attempted = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(attempted.attempts).toBe(1);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });

  it('refuses a password shorter than the minimum', async () => {
    const result = await run({ newPassword: 'short' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.PASSWORD_TOO_SHORT);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  // The user is resolved before validation, so this can check the real name
  // and phone rather than trusting anything the client sent.
  it('refuses a password that is the user’s own phone number', async () => {
    const result = await run({ newPassword: '79161234567' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO);
    }
  });

  it('reports the same not-found for an unknown account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await run({ identifier: 'nobody@mail.ru' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });

  it('reports the same not-found when no reset code was ever issued', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/application/auth/__tests__/ResetPasswordWithOtpUseCase.test.ts`
Expected: FAIL — `Failed to resolve import "../ResetPasswordWithOtpUseCase"`

- [ ] **Step 3: Write the schema**

Create `src/application/auth/ResetPasswordSchema.ts`:

```ts
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../../domain/user/User';
import { UserDomainCodes } from '../../domain/user/UserDomainCodes';

export const resetPasswordSchema = z
  .object({
    identifier: z.string().min(1, UserDomainCodes.EMAIL_INVALID),
    code: z.string().length(6, UserDomainCodes.EMAIL_INVALID),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, UserDomainCodes.PASSWORD_TOO_SHORT),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: UserDomainCodes.PASSWORDS_MISMATCH,
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

The personal-info check is **not** here: it needs the resolved user, which only the use case has. It lives in the use case instead.

- [ ] **Step 4: Write the use case**

Create `src/application/auth/ResetPasswordWithOtpUseCase.ts`:

```ts
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository } from '@/domain/user/SessionRepository';
import {
  PASSWORD_MIN_LENGTH,
  passwordMatchesPersonalInfo,
} from '@/domain/user/User';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpErrors } from './OtpErrors';
import { PasswordHasher } from './RegisterUserUseCase';
import { parseAccountIdentifier } from './parseAccountIdentifier';

export interface ResetPasswordWithOtpInput {
  identifier: string;
  code: string;
  newPassword: string;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  sessionRepository: SessionRepository;
  otpCodeHasher: OtpCodeHasher;
  passwordHasher: PasswordHasher;
}

/**
 * Unauthenticated. The user is derived from the identifier and then from the
 * OTP row's own userId — never from anything the client asserts about who it
 * is. An unknown account and a wrong code are reported identically, so the
 * second step is no more of an oracle than the first.
 */
export class ResetPasswordWithOtpUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly passwordHasher: PasswordHasher;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.sessionRepository = deps.sessionRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.passwordHasher = deps.passwordHasher;
  }

  async execute(
    input: ResetPasswordWithOtpInput
  ): Promise<Result<{ reset: true }, string>> {
    const parsed = parseAccountIdentifier(input.identifier);

    if (!parsed) {
      return failure(OtpErrors.INVALID);
    }

    const user =
      parsed.kind === 'email'
        ? await this.userRepository.findByEmail(parsed.email)
        : await this.userRepository.findByPhoneNumber(parsed.phone);

    if (!user || !user.hasConfirmedEmail() || !user.email) {
      return failure(OtpErrors.INVALID);
    }

    const otp = await this.otpRepository.findLatestByIdentifier(
      user.email.getValue(),
      'email',
      OtpPurposes.PASSWORD_RESET
    );

    if (!otp) {
      return failure(OtpErrors.INVALID);
    }

    // Defence in depth: findLatestByIdentifier already filters on purpose, but
    // the guard is cheap and this is the endpoint that would pay for a lapse.
    if (otp.purpose !== OtpPurposes.PASSWORD_RESET) {
      return failure(OtpErrors.INVALID);
    }

    // The row's own userId is the authority on whose password this changes.
    if (otp.userId !== user.id) {
      return failure(OtpErrors.INVALID);
    }

    if (otp.isVerified()) {
      return failure(OtpErrors.ALREADY_VERIFIED);
    }

    if (otp.isExpired()) {
      return failure(OtpErrors.EXPIRED);
    }

    if (otp.hasMaxAttempts()) {
      return failure(OtpErrors.MAX_ATTEMPTS);
    }

    const incremented = otp.incrementAttempts();
    await this.otpRepository.update(incremented);

    if (!this.otpCodeHasher.verify(input.code, otp.code)) {
      return failure(OtpErrors.INVALID);
    }

    // Password rules are checked only after the code proves the caller owns
    // the account — otherwise the validation messages themselves would tell an
    // attacker which accounts exist.
    if (!input.newPassword || input.newPassword.length < PASSWORD_MIN_LENGTH) {
      return failure(UserDomainCodes.PASSWORD_TOO_SHORT);
    }

    if (
      passwordMatchesPersonalInfo(input.newPassword, {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
      })
    ) {
      return failure(UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO);
    }

    await this.otpRepository.update(incremented.markVerified());

    const hashedPassword = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.save(user.changePassword(hashedPassword));

    // Every live session was opened with the old password. A reset prompted by
    // a suspected compromise is pointless if the compromiser keeps their access.
    await this.sessionRepository.deleteAllForUser(user.id);

    return success({ reset: true });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/application/auth/__tests__/ResetPasswordWithOtpUseCase.test.ts`
Expected: PASS — 13 tests

- [ ] **Step 6: Verify and stage**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/application/auth
```

---

### Task 16: Reset actions, pages, and the login link

**Files:**

- Create: `src/web/actions/auth/passwordReset.ts`
- Create: `src/app/[locale]/forgot-password/page.tsx`
- Create: `src/web/components/auth/ForgotPasswordForm.tsx`
- Modify: `src/web/components/auth/LoginForm.tsx`
- Modify: `messages/en.json`, `messages/ru.json`
- Test: `src/web/actions/__tests__/passwordReset.test.ts`

**Interfaces:**

- Consumes: `RequestPasswordResetUseCase` (Task 14), `ResetPasswordWithOtpUseCase` (Task 15), `isCaptchaEnforced` / `TurnstileCaptchaVerifier`, `createEmailDeliveryChannelFromEnv` (Task 9)
- Produces: `requestPasswordResetAction(formData, captchaToken?)`, `resetPasswordWithOtpAction(formData, captchaToken?)`

One page with two steps rather than two routes: the identifier has to survive into step two, and keeping it in component state avoids putting an account identifier in a URL.

- [ ] **Step 1: Write the failing test**

Create `src/web/actions/__tests__/passwordReset.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const checkRateLimit = vi.fn();
const requestExecute = vi.fn();
const resetExecute = vi.fn();
const captchaVerify = vi.fn();
const captchaEnforced = vi.fn();

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: () => checkRateLimit(),
}));
vi.mock('@/web/lib/clientIp', () => ({ getClientIp: async () => '127.0.0.1' }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => code,
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {},
  PrismaOtpRepository: class {},
  PrismaSessionRepository: class {},
  OtpCodeHasherImpl: class {},
  Argon2PasswordHasher: class {},
  createEmailDeliveryChannelFromEnv: () => ({
    channel: 'email',
    send: vi.fn(),
  }),
  TurnstileCaptchaVerifier: class {
    verify = captchaVerify;
  },
  isCaptchaEnforced: () => captchaEnforced(),
}));
vi.mock('@/application/auth/RequestPasswordResetUseCase', () => ({
  RequestPasswordResetUseCase: class {
    execute = requestExecute;
  },
}));
vi.mock('@/application/auth/ResetPasswordWithOtpUseCase', () => ({
  ResetPasswordWithOtpUseCase: class {
    execute = resetExecute;
  },
}));

import {
  requestPasswordResetAction,
  resetPasswordWithOtpAction,
} from '../auth/passwordReset';

describe('requestPasswordResetAction', () => {
  beforeEach(() => {
    checkRateLimit.mockResolvedValue(null);
    captchaEnforced.mockReturnValue(false);
    captchaVerify.mockResolvedValue(true);
    requestExecute.mockResolvedValue({
      success: true,
      value: { requested: true },
    });
  });

  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const form = new FormData();
    form.set('identifier', 'ivan@mail.ru');

    const result = await requestPasswordResetAction(form);

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(requestExecute).not.toHaveBeenCalled();
  });

  // An unauthenticated endpoint that sends mail has no other cost ceiling.
  it('refuses when CAPTCHA is enforced and no token is supplied', async () => {
    captchaEnforced.mockReturnValue(true);

    const form = new FormData();
    form.set('identifier', 'ivan@mail.ru');

    const result = await requestPasswordResetAction(form);

    expect(result.success).toBe(false);
    expect(requestExecute).not.toHaveBeenCalled();
  });

  it('refuses when the CAPTCHA token does not verify', async () => {
    captchaEnforced.mockReturnValue(true);
    captchaVerify.mockResolvedValue(false);

    const form = new FormData();
    form.set('identifier', 'ivan@mail.ru');

    const result = await requestPasswordResetAction(form, 'token');

    expect(result.success).toBe(false);
    expect(requestExecute).not.toHaveBeenCalled();
  });

  it('reports success for an account that does not exist', async () => {
    const form = new FormData();
    form.set('identifier', 'nobody@mail.ru');

    const result = await requestPasswordResetAction(form);

    expect(result.success).toBe(true);
  });
});

describe('resetPasswordWithOtpAction', () => {
  beforeEach(() => {
    checkRateLimit.mockResolvedValue(null);
    captchaEnforced.mockReturnValue(false);
    resetExecute.mockResolvedValue({ success: true, value: { reset: true } });
  });

  function buildForm(overrides: Record<string, string> = {}) {
    const form = new FormData();
    form.set('identifier', 'ivan@mail.ru');
    form.set('code', '123456');
    form.set('password', 'Korova-Zabor-71');
    form.set('confirmPassword', 'Korova-Zabor-71');

    Object.entries(overrides).forEach(([key, value]) => form.set(key, value));

    return form;
  }

  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const result = await resetPasswordWithOtpAction(buildForm());

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(resetExecute).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmation before reaching the use case', async () => {
    const result = await resetPasswordWithOtpAction(
      buildForm({ confirmPassword: 'something-else' })
    );

    expect(result.success).toBe(false);
    expect(resetExecute).not.toHaveBeenCalled();
  });

  it('passes a valid submission through to the use case', async () => {
    const result = await resetPasswordWithOtpAction(buildForm());

    expect(result.success).toBe(true);
    expect(resetExecute).toHaveBeenCalledWith({
      identifier: 'ivan@mail.ru',
      code: '123456',
      newPassword: 'Korova-Zabor-71',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/web/actions/__tests__/passwordReset.test.ts`
Expected: FAIL — `Failed to resolve import "../auth/passwordReset"`

- [ ] **Step 3: Write the actions**

Create `src/web/actions/auth/passwordReset.ts`:

```ts
'use server';

import { getTranslations } from 'next-intl/server';
import { RequestPasswordResetUseCase } from '@/application/auth/RequestPasswordResetUseCase';
import { ResetPasswordWithOtpUseCase } from '@/application/auth/ResetPasswordWithOtpUseCase';
import { resetPasswordSchema } from '@/application/auth/ResetPasswordSchema';
import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
  PrismaSessionRepository,
  OtpCodeHasherImpl,
  Argon2PasswordHasher,
  createEmailDeliveryChannelFromEnv,
  TurnstileCaptchaVerifier,
  isCaptchaEnforced,
} from '@/infrastructure/index';
import { getClientIp } from '@/web/lib/clientIp';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import type { ActionResult } from './auth';

const userRepository = new PrismaUserRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const captchaVerifier = new TurnstileCaptchaVerifier(
  process.env.TURNSTILE_SECRET_KEY || ''
);

const requestPasswordResetUseCase = new RequestPasswordResetUseCase({
  userRepository,
  otpRepository,
  deliveryChannel: createEmailDeliveryChannelFromEnv(),
  otpCodeHasher,
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
});

const resetPasswordWithOtpUseCase = new ResetPasswordWithOtpUseCase({
  userRepository,
  otpRepository,
  sessionRepository,
  otpCodeHasher,
  passwordHasher: new Argon2PasswordHasher(),
});

/**
 * Both actions are unauthenticated, so both are CAPTCHA-gated. A missing token
 * is a failure rather than a reason to skip the check — otherwise omitting the
 * field opts a client out of it.
 */
async function captchaRejection(
  captchaToken: string | undefined,
  clientIp: string
): Promise<ActionResult<never> | null> {
  if (isCaptchaEnforced() && !captchaToken) {
    const tOtp = await getTranslations('otp.errors');

    return { success: false, error: tOtp('captchaFailed') };
  }

  if (captchaToken && !(await captchaVerifier.verify(captchaToken, clientIp))) {
    const tOtp = await getTranslations('otp.errors');

    return { success: false, error: tOtp('captchaFailed') };
  }

  return null;
}

export async function requestPasswordResetAction(
  formData: FormData,
  captchaToken?: string
): Promise<ActionResult<{ requested: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const clientIp = await getClientIp();
    const rejected = await captchaRejection(captchaToken, clientIp);

    if (rejected) {
      return rejected;
    }

    const result = await requestPasswordResetUseCase.execute({
      identifier: (formData.get('identifier') as string) ?? '',
      clientIp,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: { requested: true } };
  } catch (error) {
    console.error('Request password reset action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function resetPasswordWithOtpAction(
  formData: FormData,
  captchaToken?: string
): Promise<ActionResult<{ reset: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const clientIp = await getClientIp();
    const rejected = await captchaRejection(captchaToken, clientIp);

    if (rejected) {
      return rejected;
    }

    const parsed = resetPasswordSchema.safeParse({
      identifier: (formData.get('identifier') as string) ?? '',
      code: (formData.get('code') as string) ?? '',
      password: (formData.get('password') as string) ?? '',
      confirmPassword: (formData.get('confirmPassword') as string) ?? '',
    });

    if (!parsed.success) {
      return {
        success: false,
        error: await translateErrorCode(parsed.error.issues[0].message),
      };
    }

    const result = await resetPasswordWithOtpUseCase.execute({
      identifier: parsed.data.identifier,
      code: parsed.data.code,
      newPassword: parsed.data.password,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: { reset: true } };
  } catch (error) {
    console.error('Reset password action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/web/actions/__tests__/passwordReset.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Write the form**

Create `src/web/components/auth/ForgotPasswordForm.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Field,
  Label,
  Description,
  FieldGroup,
} from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import {
  requestPasswordResetAction,
  resetPasswordWithOtpAction,
} from '@/src/web/actions/auth/passwordReset';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<'identify' | 'reset'>('identify');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function handleRequest() {
    setError(null);

    startTransition(async () => {
      const form = new FormData();
      form.set('identifier', identifier);

      const result = await requestPasswordResetAction(form);

      if (!result.success) {
        setError(result.error);

        return;
      }

      // Deliberately the same message whatever happened server-side — the
      // screen must not reveal whether an account matched.
      setNotice(t('codeSentNotice'));
      setStep('reset');
    });
  }

  function handleReset() {
    setError(null);

    startTransition(async () => {
      const form = new FormData();
      form.set('identifier', identifier);
      form.set('code', code);
      form.set('password', password);
      form.set('confirmPassword', confirmPassword);

      const result = await resetPasswordWithOtpAction(form);

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.push('/login');
    });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl/8 font-semibold text-zinc-950 dark:text-white">
        {t('title')}
      </h1>

      {error && <AlertBanner type="error">{error}</AlertBanner>}
      {notice && <AlertBanner type="info">{notice}</AlertBanner>}

      {step === 'identify' ? (
        <FieldGroup className="mt-6">
          <Field>
            <Label>{t('identifierLabel')}</Label>
            <Input
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isPending}
            />
            <Description>{t('identifierHint')}</Description>
          </Field>
          <Button
            type="button"
            onClick={handleRequest}
            disabled={isPending || identifier.trim().length === 0}
            className="w-full cursor-pointer disabled:cursor-not-allowed"
          >
            {t('sendCode')}
          </Button>
        </FieldGroup>
      ) : (
        <FieldGroup className="mt-6">
          <Field>
            <Label>{t('codeLabel')}</Label>
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field>
            <Label>{t('newPasswordLabel')}</Label>
            <Input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field>
            <Label>{t('confirmPasswordLabel')}</Label>
            <Input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
            />
          </Field>
          <Button
            type="button"
            onClick={handleReset}
            disabled={isPending || code.length !== 6 || password.length === 0}
            className="w-full cursor-pointer disabled:cursor-not-allowed"
          >
            {t('resetPassword')}
          </Button>
        </FieldGroup>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write the page and the login link**

Create `src/app/[locale]/forgot-password/page.tsx`, following the structure of the existing `src/app/[locale]/login/page.tsx`:

```tsx
import { ForgotPasswordForm } from '@/src/web/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <ForgotPasswordForm />
    </main>
  );
}
```

In `src/web/components/auth/LoginForm.tsx`, add the link below the password field, using `Link` from `@/src/i18n/routing` and leaving its default `prefetch={false}` alone:

```tsx
<Link
  href="/forgot-password"
  className="cursor-pointer text-sm/6 text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
>
  {t('forgotPassword')}
</Link>
```

- [ ] **Step 7: Add the message keys**

In `messages/en.json`, add `auth.forgotPassword`:

```json
"forgotPassword": {
  "title": "Reset your password",
  "identifierLabel": "Phone number or email",
  "identifierHint": "Whichever you remember. We send the code to the confirmed email address on the account.",
  "sendCode": "Send code",
  "codeSentNotice": "If an account matches, we have sent a code to its email address.",
  "codeLabel": "Code from the email",
  "newPasswordLabel": "New password",
  "confirmPasswordLabel": "Repeat new password",
  "resetPassword": "Set new password"
}
```

and `"forgotPassword": "Forgot your password?"` under `auth.login`.

In `messages/ru.json`:

```json
"forgotPassword": {
  "title": "Восстановление пароля",
  "identifierLabel": "Номер телефона или электронная почта",
  "identifierHint": "Любой из них. Код придёт на подтверждённый адрес электронной почты аккаунта.",
  "sendCode": "Отправить код",
  "codeSentNotice": "Если аккаунт найден, мы отправили код на его адрес электронной почты.",
  "codeLabel": "Код из письма",
  "newPasswordLabel": "Новый пароль",
  "confirmPasswordLabel": "Повторите новый пароль",
  "resetPassword": "Установить пароль"
}
```

and `"forgotPassword": "Забыли пароль?"` under `auth.login`.

- [ ] **Step 8: Exercise the flow by hand**

With `SMTP_HOST` unset the stub logs the code. Run `yarn dev`, then:

1. Register a new account with an email, or add one on `/account`.
2. Read the confirmation code from the dev server log; confirm it on `/account`.
3. Go to `/forgot-password`, enter the **phone number**; read the reset code from the log; set a new password.
4. Log in with the new password, and confirm the old session was dropped.
5. Repeat step 3 entering the **email** instead; confirm it behaves identically.
6. Enter an identifier for an account that does not exist and confirm the screen says exactly the same thing as a real one.

- [ ] **Step 9: Verify and stage**

Run: `yarn test && yarn typecheck && yarn lf`
Expected: PASS, clean

```bash
git add src/web/actions/auth/passwordReset.ts \
        src/web/actions/__tests__/passwordReset.test.ts \
        "src/app/[locale]/forgot-password" \
        src/web/components/auth \
        messages/en.json messages/ru.json
```

- [ ] **Step 10: Mark the phase complete and stop for review**

Change the Phase 5 heading to `## Phase 5 — Password reset (unauthenticated) — COMPLETE`, then stop and let the user review.

---

## Spec coverage

Every section of `readmes/2026-08-31-password-reset-email-design.md` maps to a task:

| Spec section                              | Task                                  |
| ----------------------------------------- | ------------------------------------- |
| §4 purpose discriminator                  | 4, 5                                  |
| §4.1 per-purpose throttling               | 5, 10, 14                             |
| §4.2 no client-supplied user              | 6 (`ConfirmPhoneUseCase` fix), 10, 15 |
| §4.3 no enumeration; identifier-not-otpId | 14, 15, 16                            |
| §5.1 `EmailAddress`                       | 1                                     |
| §5.2 `User` behavior                      | 2                                     |
| §5.3 domain codes                         | 1                                     |
| §5.4 schema                               | 3                                     |
| §6.1 `EmailSender` port                   | 7                                     |
| §6.2 `purpose` on the channel             | 6                                     |
| §6.3 the five use cases                   | 10, 11, 14, 15                        |
| §6.4 password validation                  | 15                                    |
| §6.5 registration                         | 13                                    |
| §7 infrastructure                         | 7, 8, 9                               |
| §8.1 routes                               | 16                                    |
| §8.2 actions                              | 12, 16                                |
| §8.3 forms                                | 12, 13, 16                            |
| §8.4 localization                         | 1, 9, 12, 13, 16                      |
| §9 testing                                | every task                            |
| §10 migration                             | 3, 5 (split — see Refinements)        |

## Known follow-ups

Out of scope here, but worth recording:

- **`deleteExpired` is never scheduled.** `OtpRepository.deleteExpired()` exists but nothing calls it, so `otp_verifications` grows without bound. This feature adds two more OTP sources to that table. Not a blocker — expired rows are rejected on read — but it is now more worth doing.
- **SMS as a second reset channel.** The seam is `OtpDeliveryChannel`. `RequestPasswordResetUseCase` would take the channel matching the user's chosen delivery; everything else is unchanged.
- **Real SMTP credentials.** Until `SMTP_HOST` is set, every deployment runs the stub and no mail leaves the building. Password reset is not actually usable in production until that is wired.
