# Superadmin: SMS/OTP Delivery Config Display — Design

- **Date:** 2026-07-02
- **Status:** Approved (pending spec review)
- **Type:** Feature (superadmin, read-only)

## Context & motivation

`SMS_RU_MAX_COST_RUBLES` is an environment variable read at request time when
constructing the SMS delivery channel. It cannot be inspected from outside the
running Node process: it is loaded into `process.env` by Next.js at startup, so
it never appears in `/proc/<pid>/environ`, and there is no UI surface for it.
Operators currently have no reliable way to confirm which value the **running**
server is actually enforcing.

Superadmin pages run **inside** the Next.js server process, so a Server
Component / server action reading `process.env` observes the true runtime
value. This feature surfaces the effective SMS delivery configuration in the
superadmin area.

## Goal

Display the **effective (working) SMS delivery configuration** — what the
running process actually enforces — on the superadmin Settings page, read-only.

## Non-goals (out of scope)

- Editing the value from the UI (it is an env var; changing it requires a
  `.env` edit + restart, plus the GitHub Actions variable to survive redeploys).
- OTP timing config (`OTP_EXPIRY_MINUTES`, `OTP_MAX_ATTEMPTS`) — deferred (YAGNI).
- Multi-provider SMS abstraction.

## Effective-value semantics

The env var alone is not the whole story. The "working value" is derived from
three env vars, mirroring the existing channel-construction logic in
`auth.ts` and `confirmPhone.ts`:

| `SMS_RU_API_ID` | `SMS_RU_MAX_COST_RUBLES` | Effective state                                                                                 |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| unset/empty     | (any)                    | **Stub channel** — no real SMS sent; cost cap irrelevant                                        |
| set             | unset/empty              | Real channel, **no cost cap** (`maxCost: undefined` → check skipped)                            |
| set             | numeric (e.g. `10`)      | Real channel, cap = that number of ₽                                                            |
| set             | non-numeric (e.g. `abc`) | Real channel, **invalid** — currently behaves as no cap (`NaN`); surfaced as a misconfiguration |

Verified against `SmsRuOtpDeliveryChannel.ts:413` — the cost check runs only
when `maxCost !== undefined`.

## Architecture & components

Approach: **shared pure resolver** (single source of truth), so the value shown
in superadmin is provably identical to what the delivery channel enforces, and
the duplicated inline logic in the two actions is removed.

### 1. Pure resolver (infrastructure, no I/O)

`src/infrastructure/auth/smsDeliveryConfig.ts`

```ts
export interface SmsDeliveryConfig {
  channelActive: boolean; // true = real sms.ru; false = stub (SMS disabled)
  testMode: boolean; // sms.ru test mode
  maxCostRubles: number | null; // effective cap; null = no limit
  maxCostInvalid: boolean; // env set but not a finite number
}

export function resolveSmsDeliveryConfig(raw: {
  apiId?: string;
  testMode?: string;
  maxCost?: string;
}): SmsDeliveryConfig;
```

Behavior-preserving mapping (matches current `env ? Number(env) : undefined`):

- `channelActive = Boolean(raw.apiId)`
- `testMode = raw.testMode === 'true'`
- `raw.maxCost` falsy → `maxCostRubles = null`, `maxCostInvalid = false`
- `raw.maxCost` set & `Number.isFinite` → `maxCostRubles = Number(...)`
- `raw.maxCost` set & non-finite → `maxCostRubles = null`, `maxCostInvalid = true`

The channel receives `maxCostRubles ?? undefined`, preserving today's
"invalid/empty → no cap" behavior.

### 2. Refactor existing consumers (behavior-preserving)

`auth.ts` and `confirmPhone.ts` build the channel from the resolver instead of
inline `process.env` reads. No behavior change.

### 3. Superadmin read action

`src/web/actions/superadmin/smsDeliveryConfig.ts`

```ts
export async function getSmsDeliveryConfigAction(): Promise<
  ActionResult<SmsDeliveryConfig>
>;
```

Mirrors `systemSettings.ts`: `checkRateLimit()` → `requireSuperadmin()` →
`isError(auth)` guard → return plain serialized object.

### 4. UI

Read-only `SmsDeliveryConfigCard` section added to
`src/app/[locale]/superadmin/settings/page.tsx`, below the editable settings.
Server-rendered (static per request; no client fetch). A muted
"read-only · set via environment" tag signals it is not editable here.

## Data flow

`settings/page.tsx` (Server Component; superadmin already enforced by
`superadmin/layout.tsx`) → `getSmsDeliveryConfigAction()` → plain
`SmsDeliveryConfig` → `<SmsDeliveryConfigCard>` renders localized labels.

## Security & serialization

- Superadmin-gated twice: `superadmin/layout.tsx` + the action's
  `requireSuperadmin()`.
- **`SMS_RU_API_ID` value is never serialized** — only the boolean
  `channelActive` crosses the boundary. No secrets exposed.
- Plain object only (no domain class across the Server/Client boundary).
  `maxCostRubles` is `number | null` (no `Decimal`).

## i18n

New keys under `superadmin.settings.smsDelivery.*` in `messages/en.json` and
`messages/ru.json`: `title`, `readOnlyTag`, `channelLabel`, `channelActive`,
`channelStub`, `testModeLabel`, `on`, `off`, `maxCostLabel`,
`maxCostValue` (param: `"{value} ₽"`), `maxCostNoLimit`, `maxCostInvalid`,
`maxCostNotApplicable`. Numbers passed as params, never hardcoded.

## Testing (TDD, unit-first)

- **Resolver unit tests** (`smsDeliveryConfig.test.ts`) — table-driven:
  no apiId → stub; apiId + `"10"` → active, cap 10; apiId + `""`/unset →
  active, `null` (no limit); apiId + `"abc"` → active, invalid; testMode
  `"true"`/other. Written first (red) before the resolver.
- **Action test** — non-superadmin blocked; rate-limited path; returns expected
  shape. Mirrors existing superadmin action tests.
- **Regression** — existing `SmsRuOtpDeliveryChannel` / auth / confirmPhone
  tests stay green after the refactor.

## Open questions

_None — approach A and SMS-only scope confirmed._
