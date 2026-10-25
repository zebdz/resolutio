# Superadmin SMS/OTP Delivery Config Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the effective (runtime) SMS/OTP delivery configuration — including the working value of `SMS_RU_MAX_COST_RUBLES` — read-only on the superadmin Settings page.

**Architecture:** Extract the effective-config logic (currently duplicated inline in `auth.ts` and `confirmPhone.ts`) into one pure resolver, plus a channel factory that both auth actions call. The superadmin Settings page (already superadmin-guarded by its layout) reads env via the same resolver server-side and renders a presentational card. Single source of truth ⇒ the displayed value is provably identical to what the delivery channel enforces.

**Tech Stack:** TypeScript, Next.js 15 (App Router, Server Components), next-intl, Vitest, Tailwind + Catalyst.

## Global Constraints

- **Never commit** — tasks end by staging (`git add`) and stopping for user review. The user commits. (Project CLAUDE.md)
- **DDD layering** — the resolver is pure (no I/O, no framework). Env reads live only at the infrastructure edge (factory) and the server page. (Project CLAUDE.md)
- **Localize everything** — all UI strings from `messages/en.json` + `messages/ru.json`; numbers passed as params, never hardcoded. Default language Russian. (Project CLAUDE.md, memory `feedback_parameterize_messages`)
- **Never serialize secrets** — the `SMS_RU_API_ID` value must never cross to the client; expose only the boolean `channelActive`. Plain objects only across the Server/Client boundary; `maxCostRubles` is `number | null`. (Project CLAUDE.md Security)
- **Behavior-preserving refactor** — `auth.ts` / `confirmPhone.ts` OTP-sending behavior is unchanged.
- **TDD** — failing test first for every non-trivial unit.
- Commands: `yarn test <path>` (single file), `yarn test` (full suite), `yarn typecheck`, `yarn lint`.

---

## File Structure

- Create `src/infrastructure/auth/smsDeliveryConfig.ts` — `SmsDeliveryConfig` value object, pure `resolveSmsDeliveryConfig`, pure `smsDeliveryDisplayKeys`.
- Create `src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts` — unit tests for both pure functions.
- Create `src/infrastructure/auth/smsDeliveryChannelFactory.ts` — `createSmsDeliveryChannelFromEnv()` (env edge).
- Create `src/infrastructure/auth/__tests__/smsDeliveryChannelFactory.test.ts` — stub-vs-real selection.
- Modify `src/infrastructure/index.ts` — barrel exports.
- Modify `src/web/actions/auth/auth.ts` — use the factory.
- Modify `src/web/actions/auth/confirmPhone.ts` — use the factory.
- Modify `messages/en.json`, `messages/ru.json` — `superadmin.settings.smsDelivery.*` keys.
- Create `src/app/[locale]/superadmin/settings/SmsDeliveryConfigCard.tsx` — presentational server component.
- Modify `src/app/[locale]/superadmin/settings/page.tsx` — read config, render the card.

---

## Task 1: Pure resolver `resolveSmsDeliveryConfig`

**Files:**

- Create: `src/infrastructure/auth/smsDeliveryConfig.ts`
- Test: `src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:

  ```ts
  export interface SmsDeliveryConfig {
    channelActive: boolean;
    testMode: boolean;
    maxCostRubles: number | null;
    maxCostInvalid: boolean;
  }
  export function resolveSmsDeliveryConfig(raw: {
    apiId?: string;
    testMode?: string;
    maxCost?: string;
  }): SmsDeliveryConfig;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveSmsDeliveryConfig } from '../smsDeliveryConfig';

describe('resolveSmsDeliveryConfig', () => {
  it('reports stub channel when apiId is absent', () => {
    expect(resolveSmsDeliveryConfig({}).channelActive).toBe(false);
  });

  it('reports active channel when apiId is present', () => {
    expect(resolveSmsDeliveryConfig({ apiId: 'abc123' }).channelActive).toBe(
      true
    );
  });

  it('parses a numeric max cost', () => {
    const c = resolveSmsDeliveryConfig({ apiId: 'x', maxCost: '10' });
    expect(c.maxCostRubles).toBe(10);
    expect(c.maxCostInvalid).toBe(false);
  });

  it('accepts a decimal max cost', () => {
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', maxCost: '2.5' }).maxCostRubles
    ).toBe(2.5);
  });

  it('treats empty or absent max cost as no limit (null)', () => {
    expect(resolveSmsDeliveryConfig({ apiId: 'x' }).maxCostRubles).toBeNull();
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', maxCost: '' }).maxCostRubles
    ).toBeNull();
  });

  it('flags a non-numeric max cost as invalid and falls back to no limit', () => {
    const c = resolveSmsDeliveryConfig({ apiId: 'x', maxCost: 'abc' });
    expect(c.maxCostRubles).toBeNull();
    expect(c.maxCostInvalid).toBe(true);
  });

  it('parses test mode from the string "true" only', () => {
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', testMode: 'true' }).testMode
    ).toBe(true);
    expect(
      resolveSmsDeliveryConfig({ apiId: 'x', testMode: 'false' }).testMode
    ).toBe(false);
    expect(resolveSmsDeliveryConfig({ apiId: 'x' }).testMode).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`
Expected: FAIL — cannot resolve `../smsDeliveryConfig`.

- [ ] **Step 3: Write minimal implementation**

Create `src/infrastructure/auth/smsDeliveryConfig.ts`:

```ts
export interface SmsDeliveryConfig {
  /** true = real sms.ru channel; false = stub (SMS effectively disabled). */
  channelActive: boolean;
  /** sms.ru test mode — messages are validated but not actually sent/charged. */
  testMode: boolean;
  /** Effective per-SMS cost cap in rubles; null means no cap. */
  maxCostRubles: number | null;
  /** True when SMS_RU_MAX_COST_RUBLES is set but not a finite number. */
  maxCostInvalid: boolean;
}

/**
 * Pure resolver: given the raw SMS env-var strings, compute the effective
 * delivery configuration the app enforces. Mirrors the channel-construction
 * logic in auth.ts / confirmPhone.ts so the value shown in superadmin is
 * identical to what the delivery channel actually applies.
 *
 * Deliberately does NOT expose the apiId value — only whether it is present —
 * so the result is safe to serialize to the client.
 */
export function resolveSmsDeliveryConfig(raw: {
  apiId?: string;
  testMode?: string;
  maxCost?: string;
}): SmsDeliveryConfig {
  const channelActive = Boolean(raw.apiId);
  const testMode = raw.testMode === 'true';

  let maxCostRubles: number | null = null;
  let maxCostInvalid = false;

  if (raw.maxCost) {
    const parsed = Number(raw.maxCost);
    if (Number.isFinite(parsed)) {
      maxCostRubles = parsed;
    } else {
      maxCostInvalid = true;
    }
  }

  return { channelActive, testMode, maxCostRubles, maxCostInvalid };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Stage and checkpoint**

```bash
git add src/infrastructure/auth/smsDeliveryConfig.ts \
        src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts
```

Mark this task complete in the plan, then STOP for user review. Do NOT commit.

---

## Task 2: Channel factory `createSmsDeliveryChannelFromEnv`

**Files:**

- Create: `src/infrastructure/auth/smsDeliveryChannelFactory.ts`
- Test: `src/infrastructure/auth/__tests__/smsDeliveryChannelFactory.test.ts`
- Modify: `src/infrastructure/index.ts` (add barrel exports)

**Interfaces:**

- Consumes: `resolveSmsDeliveryConfig` (Task 1); `StubSmsOtpDeliveryChannel` (`./StubSmsOtpDeliveryChannel`, no-arg ctor); `SmsRuOtpDeliveryChannel` (`./SmsRuOtpDeliveryChannel`, ctor `{ apiId: string; testMode?: boolean; maxCost?: number }`); type `OtpDeliveryChannel` (`@/application/auth/OtpDeliveryChannel`).
- Produces: `export function createSmsDeliveryChannelFromEnv(): OtpDeliveryChannel`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/auth/__tests__/smsDeliveryChannelFactory.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createSmsDeliveryChannelFromEnv } from '../smsDeliveryChannelFactory';
import { StubSmsOtpDeliveryChannel } from '../StubSmsOtpDeliveryChannel';
import { SmsRuOtpDeliveryChannel } from '../SmsRuOtpDeliveryChannel';

describe('createSmsDeliveryChannelFromEnv', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('returns the stub channel when SMS_RU_API_ID is not set', () => {
    delete process.env.SMS_RU_API_ID;
    expect(createSmsDeliveryChannelFromEnv()).toBeInstanceOf(
      StubSmsOtpDeliveryChannel
    );
  });

  it('returns the real sms.ru channel when SMS_RU_API_ID is set', () => {
    process.env.SMS_RU_API_ID = 'test-api-id';
    expect(createSmsDeliveryChannelFromEnv()).toBeInstanceOf(
      SmsRuOtpDeliveryChannel
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/infrastructure/auth/__tests__/smsDeliveryChannelFactory.test.ts`
Expected: FAIL — cannot resolve `../smsDeliveryChannelFactory`.

- [ ] **Step 3: Write minimal implementation**

Create `src/infrastructure/auth/smsDeliveryChannelFactory.ts`:

```ts
import type { OtpDeliveryChannel } from '@/application/auth/OtpDeliveryChannel';
import { StubSmsOtpDeliveryChannel } from './StubSmsOtpDeliveryChannel';
import { SmsRuOtpDeliveryChannel } from './SmsRuOtpDeliveryChannel';
import { resolveSmsDeliveryConfig } from './smsDeliveryConfig';

/**
 * Build the OTP SMS delivery channel from environment configuration.
 * Centralizes the stub-vs-real selection previously duplicated in auth.ts and
 * confirmPhone.ts, and reuses resolveSmsDeliveryConfig so the effective
 * testMode / maxCost match exactly what superadmin displays.
 */
export function createSmsDeliveryChannelFromEnv(): OtpDeliveryChannel {
  const apiId = process.env.SMS_RU_API_ID;

  if (!apiId) {
    return new StubSmsOtpDeliveryChannel();
  }

  const config = resolveSmsDeliveryConfig({
    apiId,
    testMode: process.env.SMS_RU_TEST_MODE,
    maxCost: process.env.SMS_RU_MAX_COST_RUBLES,
  });

  return new SmsRuOtpDeliveryChannel({
    apiId,
    testMode: config.testMode,
    maxCost: config.maxCostRubles ?? undefined,
  });
}
```

- [ ] **Step 4: Add barrel exports**

In `src/infrastructure/index.ts`, replace this line (line 34):

```ts
export { SmsRuOtpDeliveryChannel } from './auth/SmsRuOtpDeliveryChannel';
```

with:

```ts
export { SmsRuOtpDeliveryChannel } from './auth/SmsRuOtpDeliveryChannel';
export { createSmsDeliveryChannelFromEnv } from './auth/smsDeliveryChannelFactory';
```

> The pure resolver / display-keys are imported directly from
> `@/infrastructure/auth/smsDeliveryConfig` where needed (consistent with how
> `systemSettings.ts` imports `PrismaSystemSettingRepository` directly), so the
> barrel only needs to expose the factory that `auth.ts` / `confirmPhone.ts`
> consume.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/infrastructure/auth/__tests__/smsDeliveryChannelFactory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Stage and checkpoint**

```bash
git add src/infrastructure/auth/smsDeliveryChannelFactory.ts \
        src/infrastructure/auth/__tests__/smsDeliveryChannelFactory.test.ts \
        src/infrastructure/index.ts
```

Mark complete, STOP for user review. Do NOT commit.

---

## Task 3: Use the factory in `auth.ts` and `confirmPhone.ts` (behavior-preserving)

**Files:**

- Modify: `src/web/actions/auth/auth.ts` (imports ~15-26; channel block ~96-104)
- Modify: `src/web/actions/auth/confirmPhone.ts` (imports ~8-16; channel block ~28-36)

**Interfaces:**

- Consumes: `createSmsDeliveryChannelFromEnv` from `@/infrastructure/index` (Task 2).
- Produces: nothing new. Pure refactor.

- [ ] **Step 1: Establish a green baseline**

Run: `yarn test`
Expected: PASS (whole suite green before touching anything). Note the count.

- [ ] **Step 2: Edit `auth.ts` imports**

In `src/web/actions/auth/auth.ts`, replace:

```ts
  OtpCodeHasherImpl,
  StubSmsOtpDeliveryChannel,
  SmsRuOtpDeliveryChannel,
  TurnstileCaptchaVerifier,
```

with:

```ts
  OtpCodeHasherImpl,
  createSmsDeliveryChannelFromEnv,
  TurnstileCaptchaVerifier,
```

- [ ] **Step 3: Edit `auth.ts` channel construction**

Replace:

```ts
const deliveryChannel = process.env.SMS_RU_API_ID
  ? new SmsRuOtpDeliveryChannel({
      apiId: process.env.SMS_RU_API_ID,
      testMode: process.env.SMS_RU_TEST_MODE === 'true',
      maxCost: process.env.SMS_RU_MAX_COST_RUBLES
        ? Number(process.env.SMS_RU_MAX_COST_RUBLES)
        : undefined,
    })
  : new StubSmsOtpDeliveryChannel();
```

with:

```ts
const deliveryChannel = createSmsDeliveryChannelFromEnv();
```

- [ ] **Step 4: Edit `confirmPhone.ts` imports**

In `src/web/actions/auth/confirmPhone.ts`, replace:

```ts
  OtpCodeHasherImpl,
  StubSmsOtpDeliveryChannel,
  SmsRuOtpDeliveryChannel,
  TurnstileCaptchaVerifier,
```

with:

```ts
  OtpCodeHasherImpl,
  createSmsDeliveryChannelFromEnv,
  TurnstileCaptchaVerifier,
```

- [ ] **Step 5: Edit `confirmPhone.ts` channel construction**

Replace:

```ts
const deliveryChannel = process.env.SMS_RU_API_ID
  ? new SmsRuOtpDeliveryChannel({
      apiId: process.env.SMS_RU_API_ID,
      testMode: process.env.SMS_RU_TEST_MODE === 'true',
      maxCost: process.env.SMS_RU_MAX_COST_RUBLES
        ? Number(process.env.SMS_RU_MAX_COST_RUBLES)
        : undefined,
    })
  : new StubSmsOtpDeliveryChannel();
```

with:

```ts
const deliveryChannel = createSmsDeliveryChannelFromEnv();
```

- [ ] **Step 6: Verify green + typecheck + lint**

Run: `yarn test` → Expected: PASS, same count as Step 1.
Run: `yarn typecheck` → Expected: no errors (confirms no unused `StubSmsOtpDeliveryChannel` / `SmsRuOtpDeliveryChannel` imports remain).
Run: `yarn lint` → Expected: no errors.

- [ ] **Step 7: Stage and checkpoint**

```bash
git add src/web/actions/auth/auth.ts src/web/actions/auth/confirmPhone.ts
```

Mark complete, STOP for user review. Do NOT commit.

---

## Task 4: i18n keys (`superadmin.settings.smsDelivery`)

**Files:**

- Modify: `messages/en.json` (inside `superadmin.settings`, after `legalCheck`)
- Modify: `messages/ru.json` (same location)

**Interfaces:**

- Produces: translation keys consumed by Task 6's card.

- [ ] **Step 1: Add English keys**

In `messages/en.json`, replace:

```json
        "minOrgSizeDescription": "Organizations with fewer members (tree-wide) cannot run AI legality checks. Set to 0 to disable."
      }
    },
```

with:

```json
        "minOrgSizeDescription": "Organizations with fewer members (tree-wide) cannot run AI legality checks. Set to 0 to disable."
      },
      "smsDelivery": {
        "title": "SMS / OTP delivery",
        "subtitle": "Effective SMS configuration the running server is enforcing.",
        "readOnlyTag": "Read-only · set via environment",
        "channelLabel": "SMS channel",
        "channelActive": "Active (sms.ru)",
        "channelStub": "Disabled — stub (no SMS sent)",
        "testModeLabel": "Test mode",
        "on": "On",
        "off": "Off",
        "maxCostLabel": "Max cost per SMS",
        "maxCostValue": "{value} ₽",
        "maxCostNoLimit": "No limit",
        "maxCostInvalid": "Invalid value — treated as no limit",
        "notApplicable": "—"
      }
    },
```

- [ ] **Step 2: Add Russian keys**

In `messages/ru.json`, replace:

```json
        "minOrgSizeDescription": "Организации с меньшим числом участников (по всему дереву) не могут запускать проверку законности ИИ. 0 — отключено."
      }
    },
```

with:

```json
        "minOrgSizeDescription": "Организации с меньшим числом участников (по всему дереву) не могут запускать проверку законности ИИ. 0 — отключено."
      },
      "smsDelivery": {
        "title": "Доставка SMS / OTP",
        "subtitle": "Действующая конфигурация SMS, которую применяет работающий сервер.",
        "readOnlyTag": "Только чтение · задаётся через окружение",
        "channelLabel": "Канал SMS",
        "channelActive": "Активен (sms.ru)",
        "channelStub": "Отключён — заглушка (SMS не отправляются)",
        "testModeLabel": "Тестовый режим",
        "on": "Вкл.",
        "off": "Выкл.",
        "maxCostLabel": "Макс. стоимость одного SMS",
        "maxCostValue": "{value} ₽",
        "maxCostNoLimit": "Без ограничения",
        "maxCostInvalid": "Некорректное значение — трактуется как без ограничения",
        "notApplicable": "—"
      }
    },
```

- [ ] **Step 3: Verify JSON is valid**

Run: `yarn test` (next-intl message loading / any i18n guard tests run here), or at minimum:
Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/ru.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`.

- [ ] **Step 4: Stage and checkpoint**

```bash
git add messages/en.json messages/ru.json
```

Mark complete, STOP for user review. Do NOT commit.

---

## Task 5: Pure display-key mapping `smsDeliveryDisplayKeys`

Keeps all display branching in a unit-testable pure function so the card (Task 6) is pure presentation.

**Files:**

- Modify: `src/infrastructure/auth/smsDeliveryConfig.ts` (append function + type)
- Modify: `src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts` (append describe block)

**Interfaces:**

- Consumes: `SmsDeliveryConfig` (Task 1).
- Produces:

  ```ts
  export interface SmsDeliveryDisplayKeys {
    channelKey: 'channelActive' | 'channelStub';
    testModeKey: 'on' | 'off' | 'notApplicable';
    maxCostKey:
      | 'maxCostValue'
      | 'maxCostNoLimit'
      | 'maxCostInvalid'
      | 'notApplicable';
  }
  export function smsDeliveryDisplayKeys(
    config: SmsDeliveryConfig
  ): SmsDeliveryDisplayKeys;
  ```

- [ ] **Step 1: Write the failing test**

Append to `src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`:

```ts
import { smsDeliveryDisplayKeys } from '../smsDeliveryConfig';

describe('smsDeliveryDisplayKeys', () => {
  const active = {
    channelActive: true,
    testMode: false,
    maxCostRubles: null as number | null,
    maxCostInvalid: false,
  };

  it('maps stub channel to channelStub and N/A rows', () => {
    expect(smsDeliveryDisplayKeys({ ...active, channelActive: false })).toEqual(
      {
        channelKey: 'channelStub',
        testModeKey: 'notApplicable',
        maxCostKey: 'notApplicable',
      }
    );
  });

  it('maps active + no cap to no-limit', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, maxCostRubles: null }).maxCostKey
    ).toBe('maxCostNoLimit');
  });

  it('maps active + numeric cap to value', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, maxCostRubles: 10 }).maxCostKey
    ).toBe('maxCostValue');
  });

  it('maps active + invalid to invalid', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, maxCostInvalid: true }).maxCostKey
    ).toBe('maxCostInvalid');
  });

  it('maps test mode on/off when active', () => {
    expect(
      smsDeliveryDisplayKeys({ ...active, testMode: true }).testModeKey
    ).toBe('on');
    expect(
      smsDeliveryDisplayKeys({ ...active, testMode: false }).testModeKey
    ).toBe('off');
  });

  it('maps active channel to channelActive', () => {
    expect(smsDeliveryDisplayKeys(active).channelKey).toBe('channelActive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`
Expected: FAIL — `smsDeliveryDisplayKeys` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/infrastructure/auth/smsDeliveryConfig.ts`:

```ts
export interface SmsDeliveryDisplayKeys {
  channelKey: 'channelActive' | 'channelStub';
  testModeKey: 'on' | 'off' | 'notApplicable';
  maxCostKey:
    | 'maxCostValue'
    | 'maxCostNoLimit'
    | 'maxCostInvalid'
    | 'notApplicable';
}

/**
 * Map an effective config to i18n message keys under
 * `superadmin.settings.smsDelivery`. When the channel is a stub, test mode and
 * max cost do not apply, so both render as "not applicable".
 */
export function smsDeliveryDisplayKeys(
  config: SmsDeliveryConfig
): SmsDeliveryDisplayKeys {
  if (!config.channelActive) {
    return {
      channelKey: 'channelStub',
      testModeKey: 'notApplicable',
      maxCostKey: 'notApplicable',
    };
  }

  let maxCostKey: SmsDeliveryDisplayKeys['maxCostKey'];
  if (config.maxCostInvalid) {
    maxCostKey = 'maxCostInvalid';
  } else if (config.maxCostRubles === null) {
    maxCostKey = 'maxCostNoLimit';
  } else {
    maxCostKey = 'maxCostValue';
  }

  return {
    channelKey: 'channelActive',
    testModeKey: config.testMode ? 'on' : 'off',
    maxCostKey,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts`
Expected: PASS (13 tests total).

- [ ] **Step 5: Typecheck**

Run: `yarn typecheck`
Expected: no errors.

- [ ] **Step 6: Stage and checkpoint**

```bash
git add src/infrastructure/auth/smsDeliveryConfig.ts \
        src/infrastructure/auth/__tests__/smsDeliveryConfig.test.ts
```

Mark complete, STOP for user review. Do NOT commit.

---

## Task 6: Render the read-only card on the Settings page

**Files:**

- Create: `src/app/[locale]/superadmin/settings/SmsDeliveryConfigCard.tsx`
- Modify: `src/app/[locale]/superadmin/settings/page.tsx`

**Interfaces:**

- Consumes: `SmsDeliveryConfig`, `resolveSmsDeliveryConfig`, `smsDeliveryDisplayKeys` from `@/infrastructure/auth/smsDeliveryConfig`; i18n keys from Task 4.
- Produces: nothing new.

- [ ] **Step 1: Create the presentational card (Server Component)**

Create `src/app/[locale]/superadmin/settings/SmsDeliveryConfigCard.tsx`:

```tsx
import { getTranslations } from 'next-intl/server';
import {
  smsDeliveryDisplayKeys,
  type SmsDeliveryConfig,
} from '@/infrastructure/auth/smsDeliveryConfig';

export async function SmsDeliveryConfigCard({
  config,
}: {
  config: SmsDeliveryConfig;
}) {
  const t = await getTranslations('superadmin.settings.smsDelivery');
  const keys = smsDeliveryDisplayKeys(config);

  const maxCostText =
    keys.maxCostKey === 'maxCostValue'
      ? t('maxCostValue', { value: config.maxCostRubles ?? 0 })
      : t(keys.maxCostKey);

  const rows: { label: string; value: string; emphasis?: boolean }[] = [
    { label: t('channelLabel'), value: t(keys.channelKey) },
    { label: t('testModeLabel'), value: t(keys.testModeKey) },
    { label: t('maxCostLabel'), value: maxCostText, emphasis: true },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('title')}
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {t('readOnlyTag')}
        </span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t('subtitle')}
      </p>

      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-3"
          >
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              {row.label}
            </dt>
            <dd
              className={
                row.emphasis
                  ? 'text-sm font-semibold text-zinc-900 dark:text-zinc-100'
                  : 'text-sm text-zinc-900 dark:text-zinc-100'
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Settings page**

In `src/app/[locale]/superadmin/settings/page.tsx`, replace the import line:

```tsx
import { SystemSettingsPanel } from './SystemSettingsPanel';
```

with:

```tsx
import { SystemSettingsPanel } from './SystemSettingsPanel';
import { SmsDeliveryConfigCard } from './SmsDeliveryConfigCard';
import { resolveSmsDeliveryConfig } from '@/infrastructure/auth/smsDeliveryConfig';
```

Then replace:

```tsx
      <SystemSettingsPanel />
    </div>
  );
}
```

with:

```tsx
      <SystemSettingsPanel />

      <SmsDeliveryConfigCard
        config={resolveSmsDeliveryConfig({
          apiId: process.env.SMS_RU_API_ID,
          testMode: process.env.SMS_RU_TEST_MODE,
          maxCost: process.env.SMS_RU_MAX_COST_RUBLES,
        })}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, lint, full suite**

Run: `yarn typecheck` → Expected: no errors.
Run: `yarn lint` → Expected: no errors.
Run: `yarn test` → Expected: PASS (baseline count + 15 new tests).

- [ ] **Step 4: Manual visual check**

Run the app (`yarn dev` or the project's run skill), log in as a superadmin, open `/<locale>/superadmin/settings`. Confirm the card shows below the editable settings and the three rows reflect the current env:

- With `SMS_RU_API_ID` unset → channel "Disabled — stub", test mode "—", max cost "—".
- With `SMS_RU_API_ID` set and `SMS_RU_MAX_COST_RUBLES=10` → channel "Active (sms.ru)", max cost "10 ₽".
- With `SMS_RU_MAX_COST_RUBLES` empty → max cost "No limit".
  Switch locale to `ru` and confirm Russian strings render.

- [ ] **Step 5: Stage and checkpoint**

```bash
git add src/app/[locale]/superadmin/settings/SmsDeliveryConfigCard.tsx \
        src/app/[locale]/superadmin/settings/page.tsx
```

Mark complete, STOP for user review. Do NOT commit.

---

## Self-Review

**1. Spec coverage**

- Effective-config display (channel / testMode / maxCost, incl. no-limit & invalid states) → Tasks 1, 5, 6. ✅
- Runtime value read in-process → Task 6 reads `process.env` server-side. ✅
- Shared resolver (single source of truth; removes duplication) → Tasks 1–3. ✅
- Superadmin-only + secret never serialized → layout guard (existing) + resolver exposes only `channelActive`; Task 6 passes a plain object. ✅
- Read-only on Settings page → Task 6. ✅
- i18n en+ru, numbers parameterized → Task 4 (`maxCostValue: "{value} ₽"`). ✅
- Testing (resolver + regression) → Tasks 1, 5 (unit), Task 2 (factory), Task 3 (regression baseline). ✅
- **Spec deviation:** the spec's standalone `getSmsDeliveryConfigAction` is intentionally dropped — the page is server-rendered and already superadmin-guarded by its layout, so an action would only add a per-view rate-limit hit. Same intent, fewer moving parts. Flagged to the user.

**2. Placeholder scan** — no TBD/TODO; every code step shows complete code; every command has an expected result. ✅

**3. Type consistency** — `SmsDeliveryConfig` fields (`channelActive`, `testMode`, `maxCostRubles`, `maxCostInvalid`) are used identically in Tasks 1, 2, 5, 6. `smsDeliveryDisplayKeys` key unions match the i18n keys added in Task 4 (`channelActive`, `channelStub`, `on`, `off`, `notApplicable`, `maxCostValue`, `maxCostNoLimit`, `maxCostInvalid`). Factory ctor arg `{ apiId, testMode, maxCost }` matches `SmsRuOtpDeliveryChannel`'s constructor. ✅
