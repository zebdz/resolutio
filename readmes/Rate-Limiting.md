# Rate Limiting

## Architecture

Two separate in-memory rate limiters with independent counters per IP:

| Limiter        | File                                    | Limit   | Covers                                       |
| -------------- | --------------------------------------- | ------- | -------------------------------------------- |
| Middleware     | `src/infrastructure/rateLimit/index.ts` | 60/min  | Page loads, API routes (`/api/*`), curl/bots |
| Server actions | `src/web/actions/rateLimit.ts`          | 200/min | All Next.js server actions                   |

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
- When rate-limited: returns `{ success: false, error: '<localized message>' }`
- Existing client-side error handling displays the message — no special handling needed

### Rate-limited error page (`src/app/[locale]/rate-limited/page.tsx`)

- Shows localized message explaining what happened
- Live countdown timer (seconds until retry)
- Retry button (disabled until countdown reaches 0), navigates back to the original page

## In-memory store details

- Algorithm: sliding window counter (`Map<string, number[]>` — IP to timestamps)
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
