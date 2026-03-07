# Rate Limiting

## Architecture

Three-layer rate limiting using IP, session, and userId keys:

| Layer                 | Key        | File                                    | Limit    | Covers                                       |
| --------------------- | ---------- | --------------------------------------- | -------- | -------------------------------------------- |
| Middleware            | IP         | `src/infrastructure/rateLimit/index.ts` | 60/min   | Page loads, API routes (`/api/*`), curl/bots |
| Server actions        | IP+session | `src/web/actions/rateLimit.ts`          | 200/min  | All Next.js server actions                   |
| Phone search          | userId     | `src/web/actions/rateLimit.ts`          | 5/30min  | `searchUserByPhoneAction` only               |
| Login                 | IP+phone   | `src/web/actions/rateLimit.ts`          | 5/15min  | `loginAction` — failed attempts only         |
| Registration (IP)     | IP         | `src/web/actions/rateLimit.ts`          | 50/60min | `registerAction` — all attempts              |
| Registration (device) | device_id  | `src/web/actions/rateLimit.ts`          | 3/60min  | `registerAction` — all attempts              |

### Why three layers?

- **IP** — basic abuse gate, works for unauthenticated requests
- **Session** — prevents VPN-hopping bypass; reads cookie (no DB), so unauthenticated actions (login/register) are IP-only
- **userId** — for sensitive operations (phone search) where identity matters; requires auth

### Why two limiters?

Next.js server actions use an internal RSC protocol. Middleware can't return a response that server actions understand — returning 429 JSON or a 302 redirect causes "An unexpected response was received from the server" on the client. So server actions are skipped in middleware and rate-limited at the application level instead.

### Why 60/min for middleware?

Standard rate for web apps. Covers page loads, API routes, and direct HTTP requests (curl, bots, scripts). This is the primary abuse gate.

### Why 200/min for server actions?

A single page load triggers 4-6 data-fetching server actions (e.g. `getOrganizationDetailsAction`, `getBoardsByOrganizationAction`, `getOrgAdminsAction`, etc.). Heavy legitimate usage — navigation + search + voting — can reach 100+/min. The 200/min limit gives headroom for power users while still blocking scripted abuse. The middleware's 60/min on page loads is the real abuse gate; the server action limiter is a safety net against direct POST scripting.

## How it works

### Middleware (`src/proxy.ts`)

- Extracts client IP from `x-forwarded-for` / `x-real-ip` headers
- Skips rate limiting for: static assets, the `/rate-limited` error page, server actions (`Next-Action` header)
- When rate-limited:
  - **Browser requests** (`Accept: text/html`): 302 redirect to `/{locale}/rate-limited?retryAfter=N&from=/original/path`
  - **Everything else** (API, curl, bots): 429 JSON with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers

### Server actions (`src/web/actions/rateLimit.ts`)

- Every server action calls `checkRateLimit()` at the top
- `checkRateLimit()` checks two keys independently: IP and `session:<sessionId>` (same 200/min limiter instance)
- No session cookie → IP-only check (unauthenticated actions like login/register are unaffected)
- When rate-limited: returns `{ success: false, error: '<localized message>' }`
- Existing client-side error handling displays the message — no special handling needed

### Phone search (`searchUserByPhoneAction`)

- Uses `checkPhoneSearchRateLimit(userId)` and `recordFailedPhoneSearch(userId)` — keyed by userId, not IP
- Only failed searches (user not found) count toward the limit
- Requires authentication — `getCurrentUser()` is called before the phone rate limit check

### Login (`loginAction`)

- Uses `checkLoginRateLimit(phone, ip)`, `recordFailedLogin(phone, ip)`, and `resetLoginRateLimit(phone, ip)` — keyed by IP+phone
- Only failed login attempts (wrong password / user not found) count toward the limit
- On successful login, the counter resets so legitimate users aren't penalized for earlier typos
- 5 attempts per 15-minute sliding window
- **CAPTCHA**: Turnstile widget on the login form prevents automated attempts; token verified server-side before login proceeds

### Registration (`registerAction`)

- Dual-key rate limiter: IP (50/hr) + device UUID cookie (3/hr)
- OTP + Turnstile CAPTCHA do the heavy lifting against bots; this is a safety net against CAPTCHA-solving services creating mass accounts
- IP limit is generous (50/hr) to accommodate shared networks (offices, universities) where many legitimate users register from the same IP
- Device limit is tighter (3/hr) per browser — a `device_id` httpOnly cookie (1-year TTL) is set on first registration attempt
- Both limiters use `check()` — every call counts as an attempt, regardless of outcome

### Rate-limited error page (`src/app/[locale]/rate-limited/page.tsx`)

- Shows localized message explaining what happened
- Live countdown timer (seconds until retry)
- Retry button (disabled until countdown reaches 0), navigates back to the original page

## In-memory store details

- Algorithm: sliding window counter (`Map<string, number[]>` — key to timestamps, where key is IP, `session:<id>`, or `user:<id>`)
- Auto-cleanup: stale entries pruned every 60s via `setInterval`
- Edge Runtime compatible (middleware) and Node.js compatible (server actions)
- Resets on app restart (acceptable for rate limiting — ephemeral by nature)
- Single-instance only: if scaled to multiple instances, each has its own counters

## Key files

| File                                                  | Purpose                                     |
| ----------------------------------------------------- | ------------------------------------------- |
| `src/infrastructure/rateLimit/InMemoryRateLimiter.ts` | Rate limiter class (sliding window)         |
| `src/infrastructure/rateLimit/extractIp.ts`           | IP extraction for Edge Runtime (middleware) |
| `src/infrastructure/rateLimit/index.ts`               | Middleware rate limiter singleton (60/min)  |
| `src/web/actions/rateLimit.ts`                        | Server action rate limit helper (200/min)   |
| `src/web/lib/clientIp.ts`                             | IP extraction for Node.js (server actions)  |
| `src/proxy.ts`                                        | Middleware integration                      |
| `src/app/[locale]/rate-limited/page.tsx`              | Error page with countdown + retry           |
| `messages/en.json` / `messages/ru.json`               | Localized messages (`rateLimit` key)        |
