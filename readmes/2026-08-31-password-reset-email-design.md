# Self-service password reset, delivered by email

Date: 2026-08-31
Status: approved, ready for planning

## 1. Problem

A user who forgets their password has no way back into their own account. The only
existing remedy is `ResetUserPasswordUseCase`
(`src/application/auth/ResetUserPasswordUseCase.ts`), which a **superadmin** drives from
the user list — it generates a password and shows it once so the superadmin can pass it
on out of band. That is a support escalation, not a self-service path.

There is also nowhere to reach a user outside the app. Accounts carry a phone number and
nothing else; the platform has never sent an email and has no capability to do so.

## 2. What is being built

Three things, in dependency order:

1. An **optional, unique, confirmable email address** on the user account, settable at
   registration and from the account form.
2. An **email-sending capability** — a port plus an SMTP adapter, wired the way sms.ru
   already is, stubbed until credentials exist.
3. A **self-service reset flow**: the user asks for a code, receives it by email, and
   sets a new password with it.

## 3. Decisions

| Question                         | Decision                                                        | Reason                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reset channel                    | Email now, delivery channel pluggable so SMS can be added later | Everyone has a verified phone; email must not become a dead end                                                        |
| What is delivered                | A 6-digit OTP code, not a link                                  | Reuses the whole existing OTP subsystem, and a code works identically over SMS, so "SMS later" is near-zero extra work |
| Email verification               | Confirmed on save, before it can receive reset codes            | Without it, a mistyped address hands its real owner an account-takeover path                                           |
| Account lookup                   | Either phone or email, format-detected                          | Login is by phone, but the reset arrives by email; accepting both avoids a dead end for users who remember only one    |
| Transport                        | SMTP via nodemailer, behind an `EmailSender` port               | Provider-agnostic, which matters for deliverability to Russian inboxes                                                 |
| Confirmation email sent          | At registration **and** from the account form                   | —                                                                                                                      |
| What an unconfirmed email blocks | Password reset only                                             | Nothing else depends on email yet                                                                                      |
| Reset code expiry                | Reuse `OTP_EXPIRY_MINUTES` (10)                                 | No reason to diverge                                                                                                   |
| SMTP credentials                 | Build against the stub; wire real creds later                   | Keeps the flow shippable and testable now                                                                              |
| Changing a confirmed email       | Notifies the old address                                        | The old address is the only party who can notice a hostile change                                                      |

## 4. Security: the OTP purpose discriminator

`otp_verifications` has a `channel` column (`"sms" | "email"`) but **no purpose column**
(`prisma/schema.prisma:517`). Today that is harmless — phone confirmation is the only
thing that issues an OTP.

After this change there are three kinds of OTP, two of them on channel `email`:
`email_confirmation` and `password_reset`. Both would be issued to the same identifier,
on the same channel, and stored as indistinguishable rows. Nothing would stop a code
issued to confirm an email address from being redeemed at the password-reset endpoint.
An attacker who can make the app send a confirmation code — for instance by getting the
victim to re-save their own address, or by any future flow that re-issues one — could
spend it on a password reset.

So `otp_verifications` gains:

```prisma
purpose String @default("phone_confirmation")
```

with `OtpPurpose = 'phone_confirmation' | 'email_confirmation' | 'password_reset'` in
`src/domain/otp/OtpVerification.ts`. Every lookup filters on it, and a code is only ever
redeemable for the purpose it was issued for. Existing rows take the default, which is
accurate for all of them — the migration needs no backfill.

The index becomes `@@index([identifier, channel, purpose])`.

### 4.1 Throttling is scoped per purpose

`RequestConfirmationOtpUseCase` throttles on identifier + channel
(`src/application/auth/RequestConfirmationOtpUseCase.ts:65`). With three purposes that
budget would be shared, so confirming an address would consume the user's ability to
reset their password minutes later.

`countRecentByIdentifier` and `findLatestByIdentifier` therefore take a `purpose`
argument and each purpose gets its own budget. Total volume stays bounded by the existing
per-IP `countRecentByClientIp` and by `checkRateLimit()` on every action.

`src/domain/otp/OtpRepository.ts` changes accordingly. Both existing call sites in
`RequestConfirmationOtpUseCase` pass `'phone_confirmation'`:

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

### 4.2 The unauthenticated path never trusts a client-supplied user

`ConfirmPhoneUseCase` never checks that the OTP it loaded belongs to the user it is
confirming — it finds the user by `input.userId`, finds the OTP by `input.otpId`, and
confirms (`src/application/auth/ConfirmPhoneUseCase.ts:35-79`). This is not exploitable
today because `userId` comes from the session (`src/web/actions/auth/confirmPhone.ts:73`),
so an attacker can only confirm their own account.

Password reset is **unauthenticated**, so that latitude disappears. The reset use cases
derive the user from the OTP row's own `userId`, never from input. The missing
`otp.userId === user.id` check is also added to `ConfirmPhoneUseCase` while we are in
that code — it costs one line and removes a latent hole.

### 4.3 No account enumeration

`RequestPasswordResetUseCase` returns the same success result whether the account does
not exist, has no email, or has an unconfirmed email. The UI always says "if an account
matches, a code has been sent".

This has a consequence for the flow's shape: **step one cannot return an `otpId`**,
because returning one only for real accounts would restore the oracle. So step two takes
the identifier the user already typed, not an id:

```
step 1: { identifier, clientIp }            -> always success
step 2: { identifier, code, newPassword }   -> resolves user, loads latest reset OTP
```

Both steps resolve the identifier (phone or email) to a user and then use **the user's
confirmed email** as the OTP identifier, so the two steps agree on the throttle and
lookup key regardless of which form the user typed.

A syntactically invalid identifier — parsing as neither phone nor email — does return a
format error. That is purely syntactic and leaks nothing about which accounts exist.

## 5. Domain layer

### 5.1 `EmailAddress` value object

New: `src/domain/user/EmailAddress.ts`, mirroring `PhoneNumber.ts` — private
constructor, static `create`, `getValue`, `equals`, `toString`, throwing
`UserDomainCodes.EMAIL_INVALID` on bad input.

It **normalizes to trimmed lowercase**. Without that, `A@mail.ru` and `a@mail.ru` are
distinct strings and the unique index would let them become two accounts that a human
reads as one.

### 5.2 `User`

`UserProps` gains `email?: EmailAddress` and `emailConfirmedAt?: Date`, with getters and
the following behavior on the entity:

- `changeEmail(email: EmailAddress): User` — sets the address **and clears
  `emailConfirmedAt`**. This is the load-bearing invariant: a new address must never
  inherit the previous one's confirmed status, or changing to an attacker-controlled
  address would yield an immediately reset-capable email.
- `confirmEmail(): User` — sets `emailConfirmedAt`.
- `removeEmail(): User` — clears both fields.
- `hasConfirmedEmail(): boolean`.

`create()` accepts an optional email and always leaves it unconfirmed.

### 5.3 New domain codes

Added to `src/domain/user/UserDomainCodes.ts`:

```
EMAIL_INVALID:       'domain.user.emailInvalid'
EMAIL_TAKEN:         'domain.user.emailTaken'
EMAIL_NOT_SET:       'domain.user.emailNotSet'
EMAIL_NOT_CONFIRMED: 'domain.user.emailNotConfirmed'
EMAIL_ALREADY_CONFIRMED: 'domain.user.emailAlreadyConfirmed'
```

`EMAIL_NOT_SET` / `EMAIL_NOT_CONFIRMED` are for the **authenticated** account-page flows.
The unauthenticated reset flow must never surface them (§4.3).

### 5.4 Schema

```prisma
model User {
  email            String?   @unique
  emailConfirmedAt DateTime? @map("email_confirmed_at")
}
```

Postgres treats NULLs as distinct under a unique index, so "optional but unique" works
without a partial index.

## 6. Application layer

### 6.1 `EmailSender` port

`src/application/auth/EmailSender.ts`:

```ts
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  success: boolean;
  backdoorPreview?: string; // stub only, dev convenience
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
```

Deliberately separate from `OtpDeliveryChannel`. The old-address change notification
(§3, decision 10) is plain mail with no code in it, so the OTP interface is the wrong
shape for it. `EmailOtpDeliveryChannel` becomes one consumer of this port, not the port
itself.

### 6.2 `OtpDeliveryChannel` gains a purpose

`send()` takes an additional `purpose: OtpPurpose` so a channel can pick its template.
Additive; `SmsRuOtpDeliveryChannel` and `StubSmsOtpDeliveryChannel` accept and ignore it
for now.

### 6.3 Use cases

All in `src/application/auth/`.

| Use case                             | Auth    | Behavior                                                                                                                                                                                                     |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RequestEmailConfirmationOtpUseCase` | session | Issues an `email_confirmation` OTP to the user's unconfirmed address. Fails loudly (`EMAIL_NOT_SET`, `EMAIL_ALREADY_CONFIRMED`) — the caller is authenticated, so there is nothing to hide.                  |
| `ConfirmEmailUseCase`                | session | Verifies the code, calls `user.confirmEmail()`. Checks `otp.userId === user.id`.                                                                                                                             |
| `RequestPasswordResetUseCase`        | none    | Resolves phone-or-email to a user; requires a **confirmed** email; issues a `password_reset` OTP to it. Always returns success (§4.3).                                                                       |
| `ResetPasswordWithOtpUseCase`        | none    | `{identifier, code, newPassword}`. Loads the latest `password_reset` OTP for the resolved user's email; checks expiry, attempts, verified-already, and hash; then changes the password and revokes sessions. |
| `ChangeUserEmailUseCase`             | session | Applies `user.changeEmail()`, notifies the old address if it was confirmed, then issues a fresh confirmation OTP.                                                                                            |

`ResetPasswordWithOtpUseCase` ends by reusing exactly what the superadmin path already
does (`ResetUserPasswordUseCase.ts:58-63`):

```ts
await this.userRepository.save(user.changePassword(hashedPassword));
await this.sessionRepository.deleteAllForUser(user.id);
```

Sessions are revoked for the same reason the superadmin reset revokes them: a reset
prompted by suspected compromise is pointless if the compromiser's session survives it.

Single use is already implied by the existing model — `markVerified()` stamps
`verifiedAt`, and a code whose OTP row is already verified is rejected.

### 6.4 New-password validation

A new `ResetPasswordSchema` reuses the registration rules rather than restating them:
`PASSWORD_MIN_LENGTH` and `passwordMatchesPersonalInfo` from
`src/domain/user/User.ts:16,47`, plus the `PASSWORDS_MISMATCH` refinement from
`RegisterUserSchema.ts:69`. Because the user is resolved before validation, the personal-
info check runs against their real name and phone.

### 6.5 Registration

`registerUserSchema` gains an optional `email` field. `RegisterUserUseCase` stores it
unconfirmed and, when present, issues an `email_confirmation` OTP.

Registration already runs a phone-confirmation flow, and stacking a second code entry
into it would be heavy. So the email code is **sent** at registration but **entered**
later, from the account form, which carries its own resend control. A user who ignores
it simply has an unconfirmed address until they come back — which blocks nothing except
password reset (§3).

## 7. Infrastructure

New directory `src/infrastructure/email/`:

- `NodemailerEmailSender.ts` — SMTP transport from `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.
- `StubEmailSender.ts` — logs the message, returns success, exposes the body as
  `backdoorPreview` in development. Mirrors `StubSmsOtpDeliveryChannel.ts`.
- `emailSenderFactory.ts` — `createEmailSenderFromEnv()` returns the stub when
  `SMTP_HOST` is absent, exactly as `smsDeliveryChannelFactory.ts:12-30` does for
  `SMS_RU_API_ID`. Dev and tests therefore never send real mail by accident.

In `src/infrastructure/auth/`:

- `EmailOtpDeliveryChannel.ts` — `channel = 'email'`, implements `OtpDeliveryChannel`,
  renders a localized subject and body per `purpose` and locale, delegates to
  `EmailSender`.

Dependency added: `nodemailer` + `@types/nodemailer`. Everything is exported through
`src/infrastructure/index.ts` in the existing style.

Because §3 defers real credentials, the shipped default is the stub. The flow is fully
exercisable end to end — the code appears in the dev log.

## 8. Web layer

### 8.1 Routes

- `/[locale]/forgot-password` — one field, phone or email, plus CAPTCHA.
- `/[locale]/reset-password` — code + new password + confirmation, carrying the
  identifier from step one in component state.

Both mirror `ConfirmPhoneForm.tsx`'s existing countdown-and-resend pattern rather than
inventing a new one.

### 8.2 Server actions

`src/web/actions/auth/passwordReset.ts`:

- `requestPasswordResetAction`
- `resetPasswordWithOtpAction`

`src/web/actions/user/email.ts`:

- `updateEmailAction`
- `requestEmailConfirmationAction`
- `confirmEmailAction`

Every one opens with `checkRateLimit()` per the project rule. The two unauthenticated
actions are additionally CAPTCHA-gated through `isCaptchaEnforced()`
(`src/infrastructure/auth/captchaPolicy.ts`) — an unauthenticated endpoint that mails
people has no other cost ceiling. Error codes are translated with the shared
`translateErrorCode` utility.

### 8.3 Forms

- `RegisterForm.tsx` — optional email input.
- `AccountForm.tsx` — a new Email section beside the existing Preferences and Privacy
  sections, following their established shape (local state, dirty check, own submit).
  Shows the address with a confirmed/unconfirmed badge, an inline code entry, and a
  resend control.
- Login page — a "Forgot password?" link.

Per the project's Server→Client rule, the account page passes `email` and a derived
`emailConfirmed: boolean` as plain values; no domain object crosses the boundary.

### 8.4 Localization

New keys in `messages/en.json` and `messages/ru.json`:

- `auth.forgotPassword.*`, `auth.resetPassword.*`
- `account.email.*`
- `email.otp.emailConfirmation.*`, `email.otp.passwordReset.*` (subject + body)
- `email.notifications.emailChanged.*` (old-address notice)
- `domain.user.email*` for the new domain codes

Message bodies are parameterized (code, expiry minutes) rather than hardcoding numbers.

## 9. Testing

Unit-first, TDD, per the project rules. Failing test before implementation in every case.

**Domain**

- `EmailAddress`: rejects malformed input; normalizes case and whitespace; equality by value.
- `User.changeEmail` clears `emailConfirmedAt`; `confirmEmail` sets it;
  `hasConfirmedEmail` reflects both.

**Application**

- `RequestPasswordResetUseCase`: unknown identifier, no email, and unconfirmed email each
  return success **and write no OTP row** — the second assertion is the one that actually
  proves the absence of an enumeration oracle.
- Phone-form and email-form identifiers resolve to the same user and the same OTP identifier.
- `ResetPasswordWithOtpUseCase`: an `email_confirmation` code is rejected at the reset
  endpoint (the §4 replay); expired; max attempts; already-verified; wrong code increments
  attempts; success changes the hash **and** deletes sessions; a password matching personal
  info is rejected.
- `ConfirmEmailUseCase`: an OTP belonging to another user is rejected.
- `ChangeUserEmailUseCase`: old confirmed address is notified; new address starts unconfirmed.

**Infrastructure**

- `EmailOtpDeliveryChannel`: correct template per purpose and locale; send failure propagates.
- `emailSenderFactory`: returns the stub with no `SMTP_HOST`.

**Actions**

- Mirroring `src/web/actions/__tests__/userPassword.superadmin.test.ts`: rate limit and
  CAPTCHA gates fire before any work.

## 10. Migration

One migration, additive, no backfill:

- `users.email` (nullable, unique), `users.email_confirmed_at` (nullable)
- `otp_verifications.purpose` (default `'phone_confirmation'`)
- index `otp_verifications(identifier, channel, purpose)`

Existing rows are correct under the defaults. Per the project note, run
`yarn prisma:generate` after `prisma migrate dev`.

## 11. Out of scope

- SMS as a reset channel. The design keeps it cheap to add — `OtpDeliveryChannel` is
  already the seam and the code is channel-agnostic — but nothing here builds it.
- Email as a login identifier. Login stays phone-only.
- Changing the superadmin reset path.
- Email as a notification transport for anything other than the two messages above.

## 12. Rejected alternatives

- **A one-time reset link.** Standard email UX, but it needs its own token aggregate,
  table, and repository, and a link degrades badly over SMS — so the "SMS later" decision
  would force the OTP flow to be built anyway, leaving two mechanisms to maintain.
- **Storing the email unverified and using it immediately.** Smallest scope, but a
  mistyped address gives its real owner a working takeover path, since the reset flow
  accepts an email as the identifier.
- **Verifying lazily on first successful reset.** Avoids building a confirm step but does
  nothing about the risk — the first reset is precisely the dangerous one.
- **Sharing one OTP throttle budget across purposes.** Simpler, but confirming an address
  would lock the user out of resetting their password for the throttle window.
- **Returning an `otpId` from step one.** Matches the existing phone-confirmation flow,
  but an id that only materializes for real accounts is an enumeration oracle.
