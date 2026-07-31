# Deep links survive login and registration — Design

Date: 2026-07-31
Status: approved design, not yet implemented

## Goal

Someone opens a shared link — say an open poll's ballot at `/polls/{id}/vote` — while logged out.
Today they are bounced to the login screen and, after signing in, land on `/home`: the destination is
lost. This design makes the intended page survive the whole authentication chain, whether the visitor
merely logs in or registers from scratch and completes phone confirmation and privacy setup.

Anonymous visitors who open an **open poll** link additionally get a public preview of what they are
being asked to vote on, so a shared link explains itself before demanding an account.

## What already exists

A `returnTo` mechanism was built for organization join links and is reused wholesale here:

- `src/web/lib/returnToValidation.ts` — cookie name plus `isValidReturnToPath`, which rejects
  absolute URLs, protocol-relative `//host` and `scheme:` paths (open-redirect protection).
- `src/web/lib/returnTo.server.ts` / `returnTo.client.ts` — set and consume-once helpers.
- Consumers already in place: `LoginForm`, the login page, `PrivacySetupForm`, the privacy-setup page.
- `src/app/[locale]/join/[orgSlug]/[token]/page.tsx` — the public-preview + `SetReturnTo` +
  "log in / register" pattern this design copies for open polls.

The gap is that **nothing records the cookie for poll links**, so `AuthenticatedLayout`'s bare
`redirect('/login')` throws the destination away.

Note: `src/web/middleware/auth.ts` looks like it handles this (it sets `?redirect=`), but it is dead
code — never imported — and its public-route test (`pathname.startsWith('/')`) would match every
path anyway. This design does not revive it; see Non-goals.

## Non-goals

- Turning `src/web/middleware/auth.ts` into a real auth gate. Authentication stays where it is today
  (page level, via `AuthenticatedLayout` and `getCurrentUser`). The middleware only _records_ a
  destination; it introduces no redirects, so it cannot break a public page.
- Anonymous voting, or exposing anything about non-open polls to logged-out visitors.
- Preserving query strings and hashes of the original URL beyond what `isValidReturnToPath` accepts.

## 1. Capture the destination — `src/proxy.ts`

Split in two so the rules are unit-testable without constructing a `NextRequest`:

```ts
// src/web/lib/returnToCapture.ts — pure, no Next types
resolveReturnToPath(input: {
  pathname: string;   // as received, locale prefix included
  method: string;
  accept: string | null;
}): string | null;    // locale-stripped path to store, or null to skip

// src/proxy.ts — thin wrapper
captureReturnTo(request: NextRequest, response: NextResponse): NextResponse
```

Locale detection reuses `routing.locales`, the same source `extractLocale` in `proxy.ts` already uses.

Eligibility — all must hold:

- method is `GET`
- browser HTML navigation (the existing `isBrowserRequest` check)
- path is not `/api/...` and not a Next internal (already excluded by the matcher)
- path, **with the locale prefix stripped**, is not one of:
  `/`, `/login`, `/register`, `/confirm-phone`, `/privacy-setup`, `/blocked`, `/rate-limited`,
  `/ip-blocked`
- the resulting value passes `isValidReturnToPath`

Cookie attributes match `setReturnToCookie`: `maxAge` 1800, `sameSite: 'lax'`, `path: '/'`,
`secure` in production, `httpOnly: false` (the client helper reads it).

**Locale stripping is required, not cosmetic.** `LoginForm` and `PrivacySetupForm` navigate with
`useRouter` from `@/src/i18n/routing`, which prepends the active locale. Storing `/ru/polls/x/vote`
would produce `/ru/ru/polls/x/vote`. Store `/polls/x/vote`, exactly as `buildJoinUrl` does.

The helper is applied at **both** page-serving exits of the middleware: the development early return
(`proxy.ts:56`) and the final `intlMiddleware(request)` return. Miss the first and the feature simply
does not work locally.

Capture happens on every eligible page view, regardless of whether a session cookie is present. That
is what makes the half-onboarded case work: a user who is logged in but not yet phone-confirmed opens
the link, gets routed through `/confirm-phone` → `/privacy-setup`, and still lands on the ballot.
Accepted consequences: one cookie write per navigation, and logging out then back in returns the user
to the last page they viewed rather than `/home`.

## 2. Public preview for open polls

New application use case `GetOpenPollPreviewUseCase` (`src/application/poll/`):

```ts
execute(input: { pollId: string }): Promise<Result<OpenPollPreview | null, string>>

interface OpenPollPreview {
  title: string;
  description: string;
  state: PollState;
  organizationName: string;
}
```

Returns `null` unless the poll exists, is not archived, and `pollType === 'OPEN'`. No authentication
is required — that is the point — so the returned shape is deliberately minimal: no questions, no
answers, no participants, no creator, no ids beyond the one the caller already has.

`src/app/[locale]/polls/[pollId]/vote/page.tsx` gains an anonymous branch **before**
`AuthenticatedLayout` renders:

| Visitor    | Poll                                  | Behaviour               |
| ---------- | ------------------------------------- | ----------------------- |
| Logged out | open                                  | Public preview screen   |
| Logged out | organization / archived / nonexistent | `redirect('/login')`    |
| Logged in  | any                                   | Today's flow, unchanged |

A regular poll and a nonexistent poll produce byte-identical responses, so the preview cannot be used
to probe which poll ids exist.

The preview screen (`PublicOpenPollPreview`, modelled on the join page) shows the poll title,
description, owning organization, a status note when the poll is not `ACTIVE` ("voting has not
started" / "voting has ended"), and two buttons: _log in to vote_ and _register_. It also renders a
`SetReturnTo` with `/polls/{id}/vote` — redundant with the middleware today, but it keeps the flow
correct if the capture rule is ever narrowed.

## 3. Server-side reads must stop deleting the cookie

`consumeReturnToCookieServer()` calls `cookieStore.delete()`, which Next 15 forbids inside a Server
Component. Probed against the running app on 2026-07-31: a page that calls it with the cookie present
returns **HTTP 500 — "Cookies can only be modified in a Server Action or Route Handler."**

This is a pre-existing bug in `login/page.tsx` and `privacy-setup/page.tsx`. It stays mostly hidden
today because only the join flow ever writes the cookie; capturing on every page view would make it
fire constantly, so it has to be fixed as part of this work rather than after it.

Fix: split read from delete.

- `returnTo.server.ts` gains `readReturnToCookieServer()` — reads, validates, returns; never writes.
  `consumeReturnToCookieServer` is removed along with the unused `setReturnToCookie` (a Server
  Component cannot call that either; the middleware writes the cookie through
  `response.cookies.set`, which is allowed).
- All four server pages (login, privacy-setup, confirm-phone, register) use the read-only variant.
- Client-side consumption keeps deleting — `consumeReturnToClient` runs in the browser, where
  `document.cookie` is writable — so the cookie is still cleared on the common paths.

Consequence: a server-side redirect leaves the cookie in place. That is harmless — the next
navigation overwrites it with the page just visited, and it expires after 30 minutes — but it does
mean the cookie is a hint about where to go, never a one-shot token.

## 4. Close the chain gaps

With the cookie present, most of the chain already works: `LoginForm` sends an unconfirmed user to
`/confirm-phone` _without_ consuming the cookie, `ConfirmPhoneForm` continues to `/privacy-setup`,
and `PrivacySetupForm` consumes it and lands the user on the ballot.

Two places still discard it and must consume `returnTo` before falling back to `/home`:

- `src/app/[locale]/confirm-phone/page.tsx:26` — already-confirmed user with privacy setup complete
- `src/app/[locale]/register/page.tsx:25` — already-logged-in visitor

## 5. Security

- Every write and read goes through `isValidReturnToPath`; the cookie can only ever hold a
  same-origin relative path.
- The preview exposes title, description, organization name and state of **open** polls only —
  polls whose electorate is already "anyone with the link".
- The middleware gains no authority: it does not redirect, does not read the database, and cannot
  make a previously public page private.

## 6. Testing

- `resolveReturnToPath` (pure, so this is where the rules are pinned down): `/ru/polls/x/vote` →
  `/polls/x/vote`; `/en/polls/x/vote` → `/polls/x/vote`; every skip-list entry under both locales →
  `null`; non-GET → `null`; missing or non-HTML `accept` → `null`; a path failing
  `isValidReturnToPath` → `null`.
- `GetOpenPollPreviewUseCase`: open poll → preview; organization poll → null; archived open poll →
  null; unknown id → null.
- `confirm-phone` and `register` pages honour `returnTo` and fall back to `/home` without it.
- Manual: log out, open an open-poll link, register from scratch, complete OTP and privacy setup,
  and land on the ballot; repeat with an existing account; repeat with a regular poll link and
  confirm the login screen reveals nothing.

## 7. Risks

- Capturing on every navigation means the cookie is rewritten constantly; anything that later reads
  `returnTo` for a different purpose must not assume it was set deliberately.
- The dev-mode branch in `proxy.ts` returns before the main body, so it is easy to add the capture in
  one place and believe it works while it silently does nothing locally.
