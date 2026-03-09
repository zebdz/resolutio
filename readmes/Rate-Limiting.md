# Rate Limiting

## Architecture

Three-layer rate limiting using IP, session, and userId keys:

| Layer                    | Key                    | File                                       | Limit             | Covers                                               |
| ------------------------ | ---------------------- | ------------------------------------------ | ----------------- | ---------------------------------------------------- |
| Middleware (session)     | session (auth)         | `src/infrastructure/rateLimit/registry.ts` | 60/min            | Page loads, API routes — authenticated users         |
| Middleware (IP)          | IP (unauth)            | `src/infrastructure/rateLimit/registry.ts` | 50,000/min        | Page loads, API routes — unauthenticated traffic     |
| Server actions (session) | session (auth)         | `src/web/actions/rateLimit.ts`             | 200/min           | All Next.js server actions — authenticated users     |
| Server actions (IP)      | IP (unauth)            | `src/web/actions/rateLimit.ts`             | 200,000/min       | All Next.js server actions — unauthenticated traffic |
| Phone search             | userId                 | `src/web/actions/rateLimit.ts`             | 5/30min           | `searchUserByPhoneAction` only                       |
| Login                    | IP+phone               | `src/web/actions/rateLimit.ts`             | 5/15min           | `loginAction` — failed attempts only                 |
| Registration (IP)        | IP                     | `src/web/actions/rateLimit.ts`             | 5,000/60min       | `registerAction` — all attempts                      |
| Registration (device)    | device_id              | `src/web/actions/rateLimit.ts`             | 3/60min           | `registerAction` — all attempts                      |
| Confirmation OTP         | phone (per-identifier) | `RequestConfirmationOtpUseCase`            | escalating delays | `requestConfirmationOtpAction` — per-phone throttle  |

### Why three layers?

- **IP** — basic abuse gate, works for unauthenticated requests
- **Session** — prevents VPN-hopping bypass; reads cookie (no DB), so unauthenticated actions (login/register) are IP-only
- **userId** — for sensitive operations (phone search) where identity matters; requires auth

### Why two limiters?

Next.js server actions use an internal RSC protocol. Middleware can't return a response that server actions understand — returning 429 JSON or a 302 redirect causes "An unexpected response was received from the server" on the client. So server actions are skipped in middleware and rate-limited at the application level instead.

### Why split session/IP limiters?

Authed and unauthed traffic have fundamentally different trust levels. Session-keyed limits (60/min middleware, 200/min server actions) are tight — each session is a single user. IP-keyed limits must be very high because CGNAT (mobile carriers, universities, corporate networks) funnels thousands of legitimate users through a single IP. Sharing one limiter instance would force a compromise — too high for sessions, too low for IPs.

### Why 50,000/min for middleware IP?

IP-only rate limiting is an anomaly detector, not the primary abuse gate. Real abuse defenses (Turnstile CAPTCHA, OTP, device_id cookie, session-based limiting) are already strong. The high IP limit catches only extreme outliers while avoiding CGNAT collateral damage.

### Why 200,000/min for server actions IP?

Same CGNAT reasoning as middleware. A single page load triggers 4-6 data-fetching server actions, so the server action limit is proportionally higher. Authenticated users are already tracked by session — this IP limit only affects unauthenticated traffic and exists as an extreme-anomaly safety net.

## How it works

### Middleware (`src/proxy.ts`)

- Extracts client IP from `x-forwarded-for` / `x-real-ip` headers
- Skips rate limiting for: static assets, the `/rate-limited` error page, server actions (`Next-Action` header)
- **Single-key per request**: authenticated and unauthenticated use separate keys (no dual recording):
  - Has `session` cookie → `mw-session:<cookie>` only (IP counter untouched)
  - No `session` cookie → IP only
- This prevents shared-IP issues (NAT/VPN/office) — authenticated traffic doesn't inflate the IP counter
- Uses `mw-session:` prefix to avoid collision with server action `session:` keys in the monitor
- When rate-limited:
  - **Browser requests** (`Accept: text/html`): 302 redirect to `/{locale}/rate-limited?retryAfter=N&from=/original/path`
  - **Everything else** (API, curl, bots): 429 JSON with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers

### Server actions (`src/web/actions/rateLimit.ts`)

- Every server action calls `checkRateLimit()` at the top
- `checkRateLimit()` checks a single key per request: `session:<sessionId>` (authenticated) or IP (unauthenticated)
- Authenticated traffic doesn't inflate the IP counter — same fix as middleware
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

- Dual-key rate limiter: IP (5,000/hr) + device UUID cookie (3/hr)
- OTP + Turnstile CAPTCHA do the heavy lifting against bots; this is a safety net against CAPTCHA-solving services creating mass accounts
- IP limit is very high (5,000/hr) because CGNAT can funnel thousands of legitimate users through a single IP; the device_id limit (3/hr) is the real per-browser gate
- Device limit is tighter (3/hr) per browser — a `device_id` httpOnly cookie (1-year TTL) is set on first registration attempt
- Both limiters use `check()` — every call counts as an attempt, regardless of outcome

### Confirmation OTP (`requestConfirmationOtpAction`)

- Throttle is **per-phone**, not per-IP — uses `OtpRepository.countRecentByIdentifier()` to count recent OTPs sent to the same phone number
- Escalating delays via `OtpThrottleCalculator.getRetryAfter()`: each subsequent request within the window increases the wait time
- This prevents SMS bombing a single phone number regardless of how many IPs the attacker uses
- Registration and login both send an initial OTP; the confirmation page allows resending via this action
- The general server action rate limit (`checkRateLimit()` — 200/min session, 200,000/min IP) also applies on top

### Rate-limited error page (`src/app/[locale]/rate-limited/page.tsx`)

- Shows localized message explaining what happened
- Live countdown timer (seconds until retry)
- Retry button (disabled until countdown reaches 0), navigates back to the original page

## Superadmin whitelist

Superadmins are automatically whitelisted from all rate limiting and IP blocking. This prevents superadmins from getting 429s while managing the platform.

- **How it works**: When `requireSuperadmin()` succeeds, it calls `registerSuperadminAccess(ip, userId, sessionId)` which adds IP, session (both with 1hr TTL), and userId to an in-memory whitelist
- **Session-based bypass (authenticated)**: Middleware and `checkRateLimit()` use `isSuperadminSession(sessionId)` for authenticated requests — prevents regular users on the same IP/network from inheriting superadmin's rate limit bypass
- **IP-based bypass (unauthenticated)**: Falls back to `isSuperadminIp(ip)` for unauthenticated requests (theoretical)
- **IP block bypass**: `isSuperadminIp(ip)` still used for IP block check (line 56 in proxy.ts) — correct, IP blocks target IPs
- **TTL**: IP and session entries expire after 1 hour; re-registered on every superadmin action call
- **UserIds**: Stored in a `Set` (no expiry) — used for potential future checks

### Live monitoring

The `/superadmin/rate-monitor` page shows real-time rate limit entries across all limiters with 2s polling. Features:

- Filter by key (IP/session) or limiter label
- Progress bars per limiter showing usage ratio (green/yellow/red)
- Unlock blocked keys directly from the monitor

## In-memory store details

- Algorithm: sliding window counter (`Map<string, number[]>` — key to timestamps, where key is IP, `session:<id>`, or `user:<id>`)
- Auto-cleanup: stale entries pruned every 60s via `setInterval`
- Node.js runtime (Next.js 16 `proxy.ts` runs in Node.js, not Edge)
- `globalThis` singleton pattern ensures middleware and server actions share the same limiter instances across separate module bundles (same pattern as Prisma client in `src/infrastructure/database/prisma.ts`)
- Resets on app restart (acceptable for rate limiting — ephemeral by nature)
- Single-instance only: if scaled to multiple instances, each has its own counters

## Key files

| File                                                  | Purpose                                             |
| ----------------------------------------------------- | --------------------------------------------------- |
| `src/infrastructure/rateLimit/InMemoryRateLimiter.ts` | Rate limiter class (sliding window)                 |
| `src/infrastructure/rateLimit/extractIp.ts`           | IP extraction for middleware                        |
| `src/infrastructure/rateLimit/registry.ts`            | All limiter singletons via globalThis               |
| `src/infrastructure/rateLimit/index.ts`               | Re-exports from registry                            |
| `src/infrastructure/rateLimit/superadminWhitelist.ts` | Superadmin IP/userId whitelist (globalThis)         |
| `src/web/actions/rateLimit.ts`                        | Server action rate limit helper (session+IP)        |
| `src/web/actions/superadminAuth.ts`                   | Shared requireSuperadmin() + whitelist registration |
| `src/web/actions/rateLimitMonitor.ts`                 | Live monitor snapshot/detail actions                |
| `src/web/lib/clientIp.ts`                             | IP extraction for Node.js (server actions)          |
| `src/proxy.ts`                                        | Middleware integration                              |
| `src/app/[locale]/rate-limited/page.tsx`              | Error page with countdown + retry                   |
| `src/app/[locale]/superadmin/rate-monitor/`           | Live rate limit monitoring page                     |
| `messages/en.json` / `messages/ru.json`               | Localized messages (`rateLimit` key)                |
