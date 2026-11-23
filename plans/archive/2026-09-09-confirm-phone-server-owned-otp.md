# Confirm-phone: server-owned OTP state, explicit send button

Date: 2026-09-09. Status: phase 5 complete, awaiting review.

## Problem

- `ConfirmPhoneForm` auto-requests an OTP on mount, without a CAPTCHA token,
  whenever sessionStorage has no handoff data (redirect from
  `AuthenticatedLayout`, page reload, http→https origin change). Since 16261ee
  the server rejects token-less requests, so the page opens with "CAPTCHA
  failed", no SMS goes out and the verify button stays disabled.
- After a failed resend the widget keeps a consumed token and is never
  remounted, so resend stays disabled until Turnstile auto-refreshes (~5 min).
- Root design flaw: `otpId` lives only in the client (sessionStorage), so any
  reload or server-side redirect loses it. The auto-request existed to paper
  over that.

## Design

- Server resolves the code: `ConfirmPhoneUseCase.execute({ userId, code })`
  verifies against the latest PHONE_CONFIRMATION OTP issued to that user
  (`OtpRepository.findLatestByUserId`).
- Page renders status server-side via `GetPhoneConfirmationStatusUseCase` →
  `{ hasPendingCode, retryAfterSeconds }`.
- No auto-send, no sessionStorage. Explicit "Send code" / "Resend" button
  behind Turnstile; the widget is remounted (`key`) after every request.
- `RequestConfirmationOtpUseCase` returns `retryAfterSeconds` for the next
  request so the countdown matches the escalating throttle.
- Dev: the stub SMS channel logs the code to the server console, since the UI
  hint no longer survives the register/login → confirm-phone navigation.

## Phase 1 — DONE (single phase; server and client must change together)

- [x] Domain: `OtpRepository.findLatestByUserId(userId, purpose)`
- [x] Application: `ConfirmPhoneUseCase` by user; `GetPhoneConfirmationStatusUseCase`;
      `RequestConfirmationOtpUseCase.retryAfterSeconds`; shared throttle helper
- [x] Infrastructure: `PrismaOtpRepository.findLatestByUserId`; stub channel console log
- [x] Web: actions (code-only confirm; request returns `retryAfterSeconds`), page
      passes status, `ConfirmPhoneForm` rewrite + pure controls helper,
      Login/Register drop sessionStorage handoff
- [x] i18n: `otp.sendCode`, `auth.confirmPhone.subtitleNoCode` (en, ru)
- [x] Docs: `readmes/OTP-Throttle.md`
- [x] Verify: vitest, typecheck, lint, prettier

## Phase 2 — DONE (follow-ups flagged in the phase 1 review)

- [x] Countdown label: pure `formatCountdown(seconds)` → `m:ss` / `h:mm:ss`
      (throttle tiers reach 24h, so raw seconds read badly); `otp.resendIn`
      takes `{time}` (en, ru); `ConfirmPhoneForm` uses it
- [x] `RequestPasswordResetUseCase`, `RequestEmailConfirmationOtpUseCase`
      adopt `readThrottle` (pure refactor, covered by existing throttle tests)
- [x] Docs: `readmes/OTP-Throttle.md`
- [x] Verify: vitest, typecheck, lint, prettier

## Phase 3 — DONE (login/register: lean payload, no re-send while a code is pending)

- [x] Actions: `LoginActionData` → `{ userId, needsConfirmation? }`,
      `RegisterActionData` → `{ userId }`; the forms read nothing else
- [x] Use cases: drop `otpId` / `expiresAt` / `backdoorCode` (and register's
      OTP `expiresInSeconds`, `emailOtpId`) from `LoginResult` / `RegisterResult`;
      tests observe the code through the repository and channel mocks
- [x] `LoginUserUseCase`: skip generating/sending when the latest
      PHONE_CONFIRMATION code `isPending()`; still `needsConfirmation: true`
- [x] Docs: `readmes/OTP-Throttle.md`
- [x] Verify: vitest, typecheck, lint, prettier

## Phase 4 — DONE (email confirmation: server-owned code; login send throttled)

- [x] `LoginUserUseCase`: the send also goes through `readThrottle`; while the
      wait runs, login still succeeds and the page shows it
- [x] `readOtpStatus()` (`OtpStatus.ts`): pending-code + throttle status shared by
      `GetPhoneConfirmationStatusUseCase` and the new
      `GetEmailConfirmationStatusUseCase`; a code issued to a previous address
      does not count as pending
- [x] `ConfirmEmailUseCase.execute({ userId, code })` resolves via
      `findLatestByUserId(userId, EMAIL_CONFIRMATION)`; keeps the guard that the
      code went to the user's current address
- [x] `RequestEmailConfirmationOtpUseCase` returns only `retryAfterSeconds`;
      `updateEmailAction` / `requestEmailConfirmationAction` forward it;
      `confirmEmailAction` reads only `code`
- [x] Account page passes `emailCode: { hasPendingCode, retryAfterSeconds }`
- [x] `AccountForm`: no `pendingOtpId`; code entry shown from server/request
      state, "Send code" otherwise; countdown via `useCountdown` +
      `formatCountdown`; button rules via `otpControls.ts` (renamed from
      `confirmPhoneControls.ts`, now shared with `ConfirmPhoneForm`)
- [x] i18n: `account.email.noCodeHint` added, `account.email.resend` dropped (en, ru)
- [x] Docs: `readmes/OTP-Throttle.md`, `readmes/OTP-Throttle-ru.md`
- [x] Verify: vitest, typecheck, lint, prettier

## Phase 5 — DONE (registration re-send throttled like login)

- [x] `shouldIssueCode(status)` in `OtpStatus.ts`: nothing pending and the
      throttle allows; login and registration both decide from `readOtpStatus()`
- [x] `RegisterUserUseCase`: sends only when `shouldIssueCode`; re-registering
      an unconfirmed phone no longer pumps SMS; a new account always gets its
      first code
- [x] Docs: both throttle readmes
- [x] Verify: vitest, typecheck, lint, prettier

## Unresolved questions

- None blocking.
