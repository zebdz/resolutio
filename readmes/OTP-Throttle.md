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
2. System counts how many OTPs were sent to this phone in the last 24 hours (`recentCount`)
3. System looks up when the last OTP was created (`lastOtpCreatedAt`)
4. `getRetryAfter(recentCount, lastOtpCreatedAt)` calculates remaining wait time in seconds
5. If `retryAfter > 0` — request is rejected with `otp.errors.throttled`
6. If `retryAfter === 0` — OTP is generated and sent

## OTP Expiry

Each OTP code expires after **10 minutes**.

## Window Reset

The 24-hour window is sliding — old OTPs naturally fall out of the count as they age past 24 hours. There is no manual reset.

## Key Files

- `src/application/auth/OtpThrottleCalculator.ts` — delay calculation logic
- `src/application/auth/RequestConfirmationOtpUseCase.ts` — use case that applies throttling
- `src/application/auth/OtpErrors.ts` — error codes
