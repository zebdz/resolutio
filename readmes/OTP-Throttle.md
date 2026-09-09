# OTP Throttle

## Overview

OTP requests are throttled **per phone number** (not per IP) using a **sliding 24-hour window**. Each subsequent OTP request within the window requires a longer wait before the next one is allowed.

## Delay Schedule

| OTP # in 24h window | Wait before next OTP |
| ------------------- | -------------------- |
| 1st                 | None (immediate)     |
| 2nd                 | 1 minute             |
| 3rd                 | 5 minutes            |
| 4th                 | 30 minutes           |
| 5th                 | 1 hour               |
| 6th                 | 2 hours              |
| 7th                 | 4 hours              |
| 8th                 | 8 hours              |
| 9th                 | 16 hours             |
| 10th+               | 24 hours (max)       |

Beyond the 6th OTP, delay doubles each time, capped at 24 hours.

## How It Works

1. User requests an OTP
2. `readThrottle()` counts how many OTPs were sent to this identifier in the last 24 hours (`recentCount`) and looks up when the last one was created (`lastOtpCreatedAt`)
3. `getRetryAfter(recentCount, lastOtpCreatedAt)` calculates remaining wait time in seconds (`retryAfterSeconds`)
4. If `retryAfterSeconds > 0` — request is rejected with `otp.errors.throttled` (password reset silently skips sending instead)
5. If `retryAfterSeconds === 0` — OTP is generated and sent

All three request use cases (phone confirmation, email confirmation, password reset) go through `readThrottle()`, so the rule is written once.

## OTP Expiry

Each OTP code expires after **10 minutes**.

## Window Reset

The 24-hour window is sliding — old OTPs naturally fall out of the count as they age past 24 hours. There is no manual reset.

## Confirm-phone page

The page renders from server-known state, via `GetPhoneConfirmationStatusUseCase`:

- `hasPendingCode` — the latest phone-confirmation OTP for the user is unverified, unexpired and has attempts left. Without one, the OTP input is hidden and "Send code" is the primary action.
- `retryAfterSeconds` — `getRetryAfter(...)` for the user's phone, so the countdown after a reload matches the throttle. The form shows it as a timer (`formatCountdown`: `4:59`, `1:00:00`), since tiers reach 24h.

Every code request (the first one included) is explicit and goes through the CAPTCHA; nothing is requested on mount. `requestConfirmationOtpAction` returns `retryAfterSeconds` for the _next_ request (`calculateThrottleDelay(recentCount + 1)`), which the form counts down from. Confirming sends only the code: `ConfirmPhoneUseCase` resolves the OTP with `OtpRepository.findLatestByUserId`, so no OTP id is held by the browser.

Login and registration issue the first code themselves, under the same rule the confirm-phone page uses for its button (`shouldIssueCode()` over the `readOtpStatus()` the page renders from): only when nothing can still be entered and `readThrottle()` allows it. Otherwise they still succeed and the page shows the pending code or the wait, so repeated logins or re-registrations of an unconfirmed phone neither burn an SMS nor invalidate the code already in the inbox. A brand-new account has no code yet, so its first one always goes out. Nothing about the code reaches the client from either action; the page reads its state from the server.

## Account page (email confirmation)

Same pattern, via `GetEmailConfirmationStatusUseCase`: `hasPendingCode` is true only for an unverified, unexpired code with attempts left that went to the address currently on file, and `retryAfterSeconds` follows the throttle for that address. Both status use cases share `readOtpStatus()`. The form holds no otp id: `updateEmailAction` and `requestEmailConfirmationAction` return `retryAfterSeconds` for the countdown, and `confirmEmailAction` sends only the code, which `ConfirmEmailUseCase` resolves with `OtpRepository.findLatestByUserId`. No CAPTCHA here: the caller is signed in, rate-limited and throttled.

## Key Files

- `src/application/auth/OtpThrottleCalculator.ts` — delay calculation logic; `readThrottle()` reads the current state for one identifier
- `src/application/auth/RequestConfirmationOtpUseCase.ts`, `RequestEmailConfirmationOtpUseCase.ts`, `RequestPasswordResetUseCase.ts` — use cases that apply throttling
- `src/web/hooks/useCountdown.ts`, `src/web/lib/formatCountdown.ts` — countdown state and its `m:ss` / `h:mm:ss` label
- `src/application/auth/OtpStatus.ts` — `readOtpStatus()`: pending-code + throttle status shared by the two status use cases below; `shouldIssueCode()`: the send rule login and registration apply over it
- `src/application/auth/GetPhoneConfirmationStatusUseCase.ts` — read-only status for the confirm-phone page
- `src/application/auth/GetEmailConfirmationStatusUseCase.ts` — read-only status for the account page's email confirmation
- `src/web/components/auth/otpControls.ts` — pure button rules shared by both code-entry forms
- `src/application/auth/OtpErrors.ts` — error codes
