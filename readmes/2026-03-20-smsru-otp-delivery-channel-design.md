# SmsRu OTP Delivery Channel — Design Spec

## Goal

Replace `StubSmsOtpDeliveryChannel` with a real implementation that sends SMS via sms.ru API, using Effect's HTTP client for typed errors, retries, and clean error handling.

## Scope

Infrastructure-only. No changes to domain, application layer, or existing interfaces.

## sms.ru API

**Endpoint**: `POST https://sms.ru/sms/send`

**Required params**: `api_id`, `to` (phone), `msg` (UTF-8), `json=1`

**Success response**:

```json
{
  "status": "OK",
  "status_code": 100,
  "sms": {
    "79255070602": {
      "status": "OK",
      "status_code": 100,
      "sms_id": "000000-10000000"
    }
  },
  "balance": 4122.56
}
```

**Key error codes**:
| Code | Meaning | Retryable? |
|------|---------|------------|
| 100 | Success | — |
| 200 | Invalid api_id | No |
| 201 | Insufficient balance | No |
| 202 | Invalid phone number | No |
| 209 | Phone in stop-list | No |
| 220 | Service temporarily unavailable | Yes |
| 500 | Server error | Yes |

## Architecture

```
OtpDeliveryChannel (interface, application layer — unchanged)
        ↑ implements
SmsRuOtpDeliveryChannel (infrastructure layer — new)
        ↓ uses internally
Effect HttpClient → sms.ru/sms/send
        ↓ at boundary
Effect.runPromise → Promise<OtpDeliveryResult>
```

Effect stays encapsulated inside the infrastructure class. The existing `OtpDeliveryChannel` interface returns `Promise<OtpDeliveryResult>` — no interface changes.

## Effect error types

```typescript
// src/infrastructure/auth/SmsRuErrors.ts

class SmsRuApiError extends Data.TaggedError('SmsRuApiError')<{
  statusCode: number;
  message: string;
}> {}

class SmsRuNetworkError extends Data.TaggedError('SmsRuNetworkError')<{
  cause: unknown;
}> {}
```

## Retry policy

- Retry on: `SmsRuNetworkError`, or `SmsRuApiError` with statusCode 220 or 500
- Schedule: exponential backoff, 500ms base, max 2 retries (3 total attempts)
- Worst-case retry wait: ~1.5s (acceptable for SMS delivery — user is already waiting for SMS to arrive)
- Non-retryable errors (200, 201, 202, 209): fail immediately

## Message templating

Localized based on `locale` param passed from use case:

- `ru`: `"Ваш код подтверждения: {code}"`
- `en`: `"Your verification code: {code}"`

Simple map inside the channel class. No external i18n dependency.

## Configuration

| Env var            | Purpose                                                                                                                                                                                                                    | Required          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `SMS_RU_API_ID`    | sms.ru API key                                                                                                                                                                                                             | Yes in production |
| `SMS_RU_TEST_MODE` | If `"true"`, passes `test=1` to sms.ru (simulates without charge). In this mode `backdoorCode` is returned so the OTP flow still works for development/staging. **Warning**: do not use in production — it leaks the code. | No                |

## Channel selection

In server actions (`auth.ts`, `confirmPhone.ts`):

```typescript
const deliveryChannel = process.env.SMS_RU_API_ID
  ? new SmsRuOtpDeliveryChannel()
  : new StubSmsOtpDeliveryChannel();
```

Stub in dev (no API key configured), real in production. Zero code changes to use cases.

Both channels and their consuming use cases are instantiated at module level (cold start). The env var check happens once at process start — this is correct since env vars don't change at runtime.

The constructor validates that `SMS_RU_API_ID` is non-empty (throws if empty string — catches misconfiguration early).

## Security

- `backdoorCode` is never returned from the real channel (only in test mode)
- API key stays server-side, never exposed to client
- sms.ru recommends CAPTCHA on all SMS-triggering endpoints — already implemented (Turnstile)

## Files

| File                                                                | Action                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`                | New — implementation                                                                                       |
| `src/infrastructure/auth/SmsRuErrors.ts`                            | New — Effect TaggedError types                                                                             |
| `src/infrastructure/auth/SmsRuLogger.ts`                            | New — file logger for sms-ru.log and sms-ru.error.log                                                      |
| `src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts` | New — tests                                                                                                |
| `src/infrastructure/index.ts`                                       | Modify — export new channel                                                                                |
| `src/web/actions/auth.ts`                                           | Modify — conditional channel selection                                                                     |
| `src/web/actions/confirmPhone.ts`                                   | Modify — conditional channel selection                                                                     |
| `package.json`                                                      | Modify — add `effect`, `@effect/platform` (uses `FetchHttpClient` — Node 18+ `fetch` available in Next.js) |
| `.env.example`                                                      | Modify — add `SMS_RU_API_ID`, `SMS_RU_TEST_MODE`                                                           |
| `.gitignore`                                                        | Modify — add `logs/`                                                                                       |

## Error code coverage

`OtpErrors.SEND_FAILED` is already translated in both locales:

- EN: "Failed to send verification code. Please try again."
- RU: "Не удалось отправить код. Попробуйте ещё раз."

No new user-facing error codes needed. All sms.ru-specific errors (invalid API key, insufficient balance, etc.) are infrastructure details — they map to `SEND_FAILED` at the use case level.

## Logging

Dedicated file logging for sms.ru calls — important since every SMS costs money.

**Log files** (in `logs/` directory relative to app root):

- `logs/sms-ru.log` — all SMS attempts (success + failure), for cost tracking and audit
- `logs/sms-ru.error.log` — errors only, for quick debugging

**Log format** (one JSON line per entry):

```json
{
  "timestamp": "2026-03-20T12:34:56.789Z",
  "timestamp_msk": "20.03.2026, 15:34:56",
  "phone": "79255070602",
  "locale": "ru",
  "statusCode": 100,
  "smsId": "000000-10000000",
  "balance": 4122.56,
  "testMode": false
}
```

Error log includes additional fields:

```json
{
  "timestamp": "2026-03-20T12:34:56.789Z",
  "timestamp_msk": "20.03.2026, 15:34:56",
  "phone": "79255070602",
  "locale": "ru",
  "statusCode": 201,
  "error": "Insufficient balance",
  "retryAttempt": 0,
  "testMode": false
}
```

**Implementation**: Simple `fs.appendFile` — no logging library needed. The logger is a small utility class `SmsRuLogger` in the same infrastructure module.

**Deployment**: `logs/` directory created on first write. Add `logs/` to `.gitignore`. The deployment script should ensure the directory is writable (it will be — same user owns the app dir).

## What does NOT change

- `OtpDeliveryChannel` interface
- Use cases (RegisterUser, LoginUser, RequestConfirmationOtp, ConfirmPhone)
- Domain layer
- Rate limiting
- Zod schemas
