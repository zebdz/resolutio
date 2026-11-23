# SmsRu OTP Delivery Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a real SMS OTP delivery channel via sms.ru API using Effect's HTTP client with typed errors, retries, and dedicated file logging.

**Architecture:** `SmsRuOtpDeliveryChannel` implements the existing `OtpDeliveryChannel` interface. Internally uses Effect's HTTP client pipeline (request → parse → retry → error handling), bridged to `Promise` at the boundary via `Effect.runPromise`. A dedicated `SmsRuLogger` writes JSON lines to `logs/sms-ru.log` and `logs/sms-ru.error.log`.

**Tech Stack:** effect + @effect/platform (HttpClient, typed errors, retry, scheduling), Node.js fs (logging), vitest (testing)

**Spec:** `readmes/2026-03-20-smsru-otp-delivery-channel-design.md`

---

## File Structure

| File                                                                | Responsibility                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/infrastructure/auth/SmsRuErrors.ts`                            | Effect TaggedError types for sms.ru API and network errors                     |
| `src/infrastructure/auth/SmsRuLogger.ts`                            | JSON-line file logger writing to `logs/sms-ru.log` and `logs/sms-ru.error.log` |
| `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`                | `OtpDeliveryChannel` implementation using Effect HTTP client                   |
| `src/infrastructure/auth/__tests__/SmsRuLogger.test.ts`             | Tests for the logger                                                           |
| `src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts` | Tests for the channel (mocked HTTP)                                            |
| `src/infrastructure/index.ts`                                       | Add export for new channel                                                     |
| `src/web/actions/auth.ts`                                           | Swap `StubSmsOtpDeliveryChannel` → conditional channel selection               |
| `src/web/actions/confirmPhone.ts`                                   | Same swap                                                                      |
| `.env.example`                                                      | Add `SMS_RU_API_ID`, `SMS_RU_TEST_MODE`                                        |
| `.gitignore`                                                        | Add `logs/`                                                                    |
| `package.json` / `yarn.lock`                                        | Add `effect`, `@effect/platform`                                               |

---

## Task 1: Install Effect dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install packages**

Run:

```bash
yarn add effect @effect/platform
```

- [ ] **Step 2: Verify installation**

Run:

```bash
node -e "require('effect'); console.log('effect OK')"
```

Expected: `effect OK`

- [ ] **Step 3: Stage files**

```bash
git add package.json yarn.lock
```

---

## Task 2: Add config and gitignore entries

**Files:**

- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add env vars to `.env.example`**

After the existing OTP section (line 25), add:

```
# SMS.RU
SMS_RU_API_ID=
# Set to "true" to simulate SMS without charge (backdoorCode returned). Do NOT use in production.
SMS_RU_TEST_MODE=
```

- [ ] **Step 2: Add `logs/` to `.gitignore`**

After the `deploy.tar.gz` line (line 53), add:

```
# Application logs
/logs
```

- [ ] **Step 3: Stage files**

```bash
git add .env.example .gitignore
```

---

## Task 3: Create SmsRuErrors

**Files:**

- Create: `src/infrastructure/auth/SmsRuErrors.ts`

No TDD for this file — it's pure type definitions (TaggedError classes + a const array). Nothing to test.

- [ ] **Step 1: Create the error types**

```typescript
import { Data } from 'effect';

export class SmsRuApiError extends Data.TaggedError('SmsRuApiError')<{
  readonly statusCode: number;
  readonly message: string;
}> {}

export class SmsRuNetworkError extends Data.TaggedError('SmsRuNetworkError')<{
  readonly cause: unknown;
}> {}

export const RETRYABLE_STATUS_CODES = [220, 500] as const;
```

- [ ] **Step 2: Verify it compiles**

Run:

```bash
npx tsc --noEmit src/infrastructure/auth/SmsRuErrors.ts 2>&1 | head -5
```

Expected: no errors (or only unrelated errors from other files). Alternatively run:

```bash
yarn tsc --noEmit
```

- [ ] **Step 3: Stage files**

```bash
git add src/infrastructure/auth/SmsRuErrors.ts
```

---

## Task 4: Create SmsRuLogger (TDD)

**Files:**

- Create: `src/infrastructure/auth/__tests__/SmsRuLogger.test.ts`
- Create: `src/infrastructure/auth/SmsRuLogger.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { SmsRuLogger } from '../SmsRuLogger';

describe('SmsRuLogger', () => {
  const testLogsDir = path.join(process.cwd(), 'logs-test-' + Date.now());
  let logger: SmsRuLogger;

  beforeEach(() => {
    logger = new SmsRuLogger(testLogsDir);
  });

  afterEach(async () => {
    await fs.rm(testLogsDir, { recursive: true, force: true });
  });

  it('should create logs directory on first write', async () => {
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'ru',
      statusCode: 100,
      smsId: '000-100',
      balance: 4122.56,
      testMode: false,
    });

    const exists = await fs
      .access(testLogsDir)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('should write success entry to sms-ru.log as JSON line', async () => {
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'ru',
      statusCode: 100,
      smsId: '000-100',
      balance: 4122.56,
      testMode: false,
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    expect(entry.phone).toBe('79255070602');
    expect(entry.statusCode).toBe(100);
    expect(entry.smsId).toBe('000-100');
    expect(entry.balance).toBe(4122.56);
    expect(entry.testMode).toBe(false);
    expect(entry.timestamp).toBeDefined();
    expect(entry.timestamp_msk).toBeDefined();
  });

  it('should write error entry to both sms-ru.log and sms-ru.error.log', async () => {
    await logger.logError({
      phone: '79255070602',
      locale: 'ru',
      statusCode: 201,
      error: 'Insufficient balance',
      retryAttempt: 0,
      testMode: false,
    });

    const mainLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const errorLog = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.error.log'),
      'utf-8'
    );

    const mainEntry = JSON.parse(mainLog.trim());
    const errorEntry = JSON.parse(errorLog.trim());

    expect(mainEntry.statusCode).toBe(201);
    expect(mainEntry.error).toBe('Insufficient balance');
    expect(errorEntry.statusCode).toBe(201);
    expect(errorEntry.retryAttempt).toBe(0);
  });

  it('should include timestamp_msk in Moscow timezone (UTC+3)', async () => {
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'en',
      statusCode: 100,
      smsId: '000-200',
      balance: 100,
      testMode: true,
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const entry = JSON.parse(content.trim());
    // timestamp_msk should be a valid date string without Z suffix
    expect(entry.timestamp_msk).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/
    );
  });

  it('should append multiple entries', async () => {
    await logger.logSuccess({
      phone: '79255070601',
      locale: 'ru',
      statusCode: 100,
      smsId: '000-1',
      balance: 100,
      testMode: false,
    });
    await logger.logSuccess({
      phone: '79255070602',
      locale: 'en',
      statusCode: 100,
      smsId: '000-2',
      balance: 99,
      testMode: false,
    });

    const content = await fs.readFile(
      path.join(testLogsDir, 'sms-ru.log'),
      'utf-8'
    );
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).phone).toBe('79255070601');
    expect(JSON.parse(lines[1]).phone).toBe('79255070602');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
yarn vitest run src/infrastructure/auth/__tests__/SmsRuLogger.test.ts
```

Expected: FAIL — `SmsRuLogger` does not exist yet.

- [ ] **Step 3: Implement SmsRuLogger**

```typescript
import fs from 'fs/promises';
import path from 'path';

export interface SmsRuSuccessLogEntry {
  phone: string;
  locale: string;
  statusCode: number;
  smsId: string;
  balance: number;
  testMode: boolean;
}

export interface SmsRuErrorLogEntry {
  phone: string;
  locale: string;
  statusCode: number;
  error: string;
  retryAttempt: number;
  testMode: boolean;
}

export class SmsRuLogger {
  private readonly logFile: string;
  private readonly errorLogFile: string;
  private dirEnsured = false;

  constructor(logsDir?: string) {
    const dir = logsDir ?? path.join(process.cwd(), 'logs');
    this.logFile = path.join(dir, 'sms-ru.log');
    this.errorLogFile = path.join(dir, 'sms-ru.error.log');
  }

  async logSuccess(entry: SmsRuSuccessLogEntry): Promise<void> {
    const line = this.formatLine(entry);
    await this.append(this.logFile, line);
  }

  async logError(entry: SmsRuErrorLogEntry): Promise<void> {
    const line = this.formatLine(entry);
    await this.append(this.logFile, line);
    await this.append(this.errorLogFile, line);
  }

  private formatLine(entry: Record<string, unknown>): string {
    const now = new Date();
    const timestamp = now.toISOString();
    const timestamp_msk = this.toMoscowTime(now);
    return JSON.stringify({ timestamp, timestamp_msk, ...entry }) + '\n';
  }

  private toMoscowTime(date: Date): string {
    const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return msk.toISOString().replace('Z', '').replace(/Z$/, '');
  }

  private async append(filePath: string, data: string): Promise<void> {
    if (!this.dirEnsured) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      this.dirEnsured = true;
    }
    await fs.appendFile(filePath, data, 'utf-8');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
yarn vitest run src/infrastructure/auth/__tests__/SmsRuLogger.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Stage files**

```bash
git add src/infrastructure/auth/SmsRuLogger.ts src/infrastructure/auth/__tests__/SmsRuLogger.test.ts
```

---

## Task 5: Create SmsRuOtpDeliveryChannel (TDD)

**Files:**

- Create: `src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts`
- Create: `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`

**Key references:**

- Interface: `src/application/auth/OtpDeliveryChannel.ts` — must implement `OtpDeliveryChannel`
- Stub for pattern: `src/infrastructure/auth/StubSmsOtpDeliveryChannel.ts`
- Errors: `src/infrastructure/auth/SmsRuErrors.ts` (created in Task 3)
- Logger: `src/infrastructure/auth/SmsRuLogger.ts` (created in Task 4)

### Step 1: Write failing tests

- [ ] **Step 1a: Create test file with all test cases**

The tests mock `globalThis.fetch` to simulate sms.ru API responses. `FetchHttpClient.layer` delegates to `globalThis.fetch`, so mocking it is the documented testing approach.

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SmsRuOtpDeliveryChannel } from '../SmsRuOtpDeliveryChannel';
import { SmsRuLogger } from '../SmsRuLogger';

// Mock the logger
vi.mock('../SmsRuLogger');

// Helper to create a mock fetch response
function mockFetchResponse(body: object, ok = true) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// Standard sms.ru success response
function smsRuSuccess(phone: string) {
  return {
    status: 'OK',
    status_code: 100,
    sms: {
      [phone]: { status: 'OK', status_code: 100, sms_id: '000-123' },
    },
    balance: 4122.56,
  };
}

// Standard sms.ru error response
function smsRuError(statusCode: number, statusText: string) {
  return {
    status: 'ERROR',
    status_code: statusCode,
    status_text: statusText,
  };
}

describe('SmsRuOtpDeliveryChannel', () => {
  let channel: SmsRuOtpDeliveryChannel;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new SmsRuOtpDeliveryChannel({
      apiId: 'test-api-id',
      testMode: false,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should have channel type "sms"', () => {
    expect(channel.channel).toBe('sms');
  });

  it('should throw if apiId is empty', () => {
    expect(() => new SmsRuOtpDeliveryChannel({ apiId: '' })).toThrow();
  });

  it('should return success when sms.ru returns status_code 100', async () => {
    const phone = '79255070602';
    globalThis.fetch = mockFetchResponse(smsRuSuccess(phone));

    const result = await channel.send(phone, '123456', 'ru');

    expect(result.success).toBe(true);
    expect(result.backdoorCode).toBeUndefined();
  });

  it('should send correct params to sms.ru', async () => {
    const phone = '79255070602';
    const mockFetch = mockFetchResponse(smsRuSuccess(phone));
    globalThis.fetch = mockFetch;

    await channel.send(phone, '123456', 'ru');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    // Should be POST to sms.ru
    expect(url.toString()).toContain('sms.ru/sms/send');
    expect(options?.method).toBe('POST');

    // Body might be URLSearchParams or a string depending on how
    // HttpClientRequest.bodyUrlParams serializes. Check both.
    const bodyStr =
      options?.body instanceof URLSearchParams
        ? options.body.toString()
        : String(options?.body ?? '');
    expect(bodyStr).toContain('api_id=test-api-id');
    expect(bodyStr).toContain(`to=${phone}`);
    expect(bodyStr).toContain('json=1');
    expect(bodyStr).toContain('123456');
  });

  it('should send Russian message for ru locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockFetchResponse(smsRuSuccess(phone));
    globalThis.fetch = mockFetch;

    await channel.send(phone, '123456', 'ru');

    const bodyStr = String(mockFetch.mock.calls[0][1]?.body ?? '');
    expect(bodyStr).toContain(
      encodeURIComponent('Ваш код подтверждения: 123456')
    );
  });

  it('should send English message for en locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockFetchResponse(smsRuSuccess(phone));
    globalThis.fetch = mockFetch;

    await channel.send(phone, '654321', 'en');

    const bodyStr = String(mockFetch.mock.calls[0][1]?.body ?? '');
    expect(bodyStr).toContain(
      encodeURIComponent('Your verification code: 654321')
    );
  });

  it('should default to Russian for unknown locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockFetchResponse(smsRuSuccess(phone));
    globalThis.fetch = mockFetch;

    await channel.send(phone, '111111', 'de');

    const bodyStr = String(mockFetch.mock.calls[0][1]?.body ?? '');
    expect(bodyStr).toContain(
      encodeURIComponent('Ваш код подтверждения: 111111')
    );
  });

  it('should return failure on non-retryable sms.ru error', async () => {
    globalThis.fetch = mockFetchResponse(
      smsRuError(201, 'Insufficient balance')
    );

    const result = await channel.send('79255070602', '123456', 'ru');

    expect(result.success).toBe(false);
  });

  it('should NOT retry on non-retryable error (201)', async () => {
    const mockFetch = mockFetchResponse(
      smsRuError(201, 'Insufficient balance')
    );
    globalThis.fetch = mockFetch;

    await channel.send('79255070602', '123456', 'ru');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should return failure on network error after retries', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await channel.send('79255070602', '123456', 'ru');

    expect(result.success).toBe(false);
  });

  it('should retry on retryable sms.ru error (220)', async () => {
    const phone = '79255070602';
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(smsRuError(220, 'Service unavailable')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(smsRuSuccess(phone)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    globalThis.fetch = mockFetch;

    const result = await channel.send(phone, '123456', 'ru');

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  describe('test mode', () => {
    beforeEach(() => {
      channel = new SmsRuOtpDeliveryChannel({
        apiId: 'test-api-id',
        testMode: true,
      });
    });

    it('should pass test=1 param when testMode is true', async () => {
      const phone = '79255070602';
      const mockFetch = mockFetchResponse(smsRuSuccess(phone));
      globalThis.fetch = mockFetch;

      await channel.send(phone, '123456', 'ru');

      const bodyStr = String(mockFetch.mock.calls[0][1]?.body ?? '');
      expect(bodyStr).toContain('test=1');
    });

    it('should return backdoorCode when testMode is true', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockFetchResponse(smsRuSuccess(phone));

      const result = await channel.send(phone, '123456', 'ru');

      expect(result.success).toBe(true);
      expect(result.backdoorCode).toBe('123456');
    });
  });

  describe('logging', () => {
    it('should log success via SmsRuLogger', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockFetchResponse(smsRuSuccess(phone));

      await channel.send(phone, '123456', 'ru');

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          locale: 'ru',
          statusCode: 100,
          smsId: '000-123',
          balance: 4122.56,
          testMode: false,
        })
      );
    });

    it('should log error via SmsRuLogger on failure', async () => {
      globalThis.fetch = mockFetchResponse(
        smsRuError(201, 'Insufficient balance')
      );

      await channel.send('79255070602', '123456', 'ru');

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '79255070602',
          locale: 'ru',
          statusCode: 201,
          error: 'Insufficient balance',
        })
      );
    });
  });
});
```

- [ ] **Step 1b: Run tests to verify they fail**

Run:

```bash
yarn vitest run src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts
```

Expected: FAIL — `SmsRuOtpDeliveryChannel` does not exist yet.

### Step 2: Implement SmsRuOtpDeliveryChannel

- [ ] **Step 2a: Create the implementation**

```typescript
import { Effect, Schedule, pipe } from 'effect';
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from '@effect/platform';
import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { OtpChannel } from '@/domain/otp/OtpVerification';
import {
  SmsRuApiError,
  SmsRuNetworkError,
  RETRYABLE_STATUS_CODES,
} from './SmsRuErrors';
import { SmsRuLogger } from './SmsRuLogger';

const SMS_RU_SEND_URL = 'https://sms.ru/sms/send';

const MESSAGE_TEMPLATES: Record<string, string> = {
  ru: 'Ваш код подтверждения: {code}',
  en: 'Your verification code: {code}',
};

interface SmsRuOtpDeliveryChannelConfig {
  apiId: string;
  testMode?: boolean;
}

interface SmsRuSendResponse {
  status: string;
  status_code: number;
  status_text?: string;
  sms?: Record<
    string,
    {
      status: string;
      status_code: number;
      sms_id?: string;
      status_text?: string;
    }
  >;
  balance?: number;
}

function isRetryable(error: SmsRuApiError | SmsRuNetworkError): boolean {
  if (error._tag === 'SmsRuNetworkError') return true;
  if (error._tag === 'SmsRuApiError') {
    return RETRYABLE_STATUS_CODES.includes(
      error.statusCode as (typeof RETRYABLE_STATUS_CODES)[number]
    );
  }
  return false;
}

export class SmsRuOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'sms';

  private readonly apiId: string;
  private readonly testMode: boolean;
  private readonly logger: SmsRuLogger;

  constructor(config: SmsRuOtpDeliveryChannelConfig) {
    if (!config.apiId || config.apiId.trim() === '') {
      throw new Error('SMS_RU_API_ID must be a non-empty string');
    }
    this.apiId = config.apiId;
    this.testMode = config.testMode ?? false;
    this.logger = new SmsRuLogger();
  }

  async send(
    recipient: string,
    code: string,
    locale: string
  ): Promise<OtpDeliveryResult> {
    const program = pipe(
      this.buildSendEffect(recipient, code, locale),
      Effect.retry({
        until: (error) => !isRetryable(error),
        schedule: Schedule.intersect(
          Schedule.recurs(2),
          Schedule.exponential('500 millis')
        ),
      }),
      Effect.catchAll((error) =>
        Effect.succeed({
          success: false as const,
          error,
        })
      ),
      Effect.scoped,
      Effect.provide(FetchHttpClient.layer)
    );

    const result = await Effect.runPromise(program);

    if ('error' in result) {
      const error = result.error as SmsRuApiError | SmsRuNetworkError;
      const statusCode = error._tag === 'SmsRuApiError' ? error.statusCode : 0;
      const errorMessage =
        error._tag === 'SmsRuApiError' ? error.message : 'Network error';

      await this.logger.logError({
        phone: recipient,
        locale,
        statusCode,
        error: errorMessage,
        retryAttempt: 0,
        testMode: this.testMode,
      });

      return { success: false };
    }

    return result;
  }

  private buildSendEffect(recipient: string, code: string, locale: string) {
    return Effect.gen(this, function* () {
      const client = yield* HttpClient.HttpClient;
      const msg = this.formatMessage(code, locale);

      const params: Record<string, string> = {
        api_id: this.apiId,
        to: recipient,
        msg,
        json: '1',
      };
      if (this.testMode) {
        params['test'] = '1';
      }

      // Build request using Effect's HttpClient API
      const request = HttpClientRequest.post(SMS_RU_SEND_URL).pipe(
        HttpClientRequest.bodyUrlParams(params)
      );

      // Execute and parse response
      const response = yield* client
        .execute(request)
        .pipe(Effect.mapError((cause) => new SmsRuNetworkError({ cause })));

      const json = yield* HttpClientResponse.json(response).pipe(
        Effect.mapError((cause) => new SmsRuNetworkError({ cause }))
      ) as Effect.Effect<SmsRuSendResponse, SmsRuNetworkError>;

      // Check top-level status
      if (json.status_code !== 100) {
        return yield* Effect.fail(
          new SmsRuApiError({
            statusCode: json.status_code,
            message: json.status_text ?? `sms.ru error ${json.status_code}`,
          })
        );
      }

      // Check per-phone status
      const phoneStatus = json.sms?.[recipient];
      if (phoneStatus && phoneStatus.status_code !== 100) {
        return yield* Effect.fail(
          new SmsRuApiError({
            statusCode: phoneStatus.status_code,
            message:
              phoneStatus.status_text ??
              `sms.ru phone error ${phoneStatus.status_code}`,
          })
        );
      }

      // Log success
      await this.logger.logSuccess({
        phone: recipient,
        locale,
        statusCode: 100,
        smsId: phoneStatus?.sms_id ?? '',
        balance: json.balance ?? 0,
        testMode: this.testMode,
      });

      return {
        success: true,
        backdoorCode: this.testMode ? code : undefined,
      } as OtpDeliveryResult;
    });
  }

  private formatMessage(code: string, locale: string): string {
    const template = MESSAGE_TEMPLATES[locale] ?? MESSAGE_TEMPLATES['ru'];
    return template.replace('{code}', code);
  }
}
```

**Implementation notes:**

- Uses Effect's `HttpClient` service — `yield* HttpClient.HttpClient` gets the client, `client.execute(request)` sends it. The client is provided by `FetchHttpClient.layer` which delegates to `globalThis.fetch`.
- `HttpClientRequest.post(url).pipe(HttpClientRequest.bodyUrlParams(params))` builds a POST with URL-encoded form body.
- `Effect.scoped` is needed because `HttpClient.execute` returns a scoped effect (manages response lifecycle).
- `Effect.retry({ until: (error) => !isRetryable(error) })` stops retrying immediately on non-retryable errors (200, 201, 202, 209). Only `SmsRuNetworkError` and retryable status codes (220, 500) trigger retries.
- **Note for implementer**: The exact API for `bodyUrlParams` and `HttpClientResponse.json` may differ slightly between Effect versions. If `bodyUrlParams` expects `UrlParams` instead of a plain record, use `UrlParams.fromInput(params)`. If `HttpClientResponse.json` is a property (`.json`) instead of a function, adjust accordingly. Check the installed version's types.

- [ ] **Step 2b: Run tests to verify they pass**

Run:

```bash
yarn vitest run src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2c: Stage files**

```bash
git add src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts
```

---

## Task 6: Export and wire up

**Files:**

- Modify: `src/infrastructure/index.ts`
- Modify: `src/web/actions/auth.ts:95`
- Modify: `src/web/actions/confirmPhone.ts:27`

- [ ] **Step 1: Add export to infrastructure/index.ts**

After the `StubSmsOtpDeliveryChannel` export (line 25), add:

```typescript
export { SmsRuOtpDeliveryChannel } from './auth/SmsRuOtpDeliveryChannel';
```

- [ ] **Step 2: Update auth.ts channel selection**

In `src/web/actions/auth.ts`, replace line 95:

```typescript
const deliveryChannel = new StubSmsOtpDeliveryChannel();
```

With:

```typescript
const deliveryChannel = process.env.SMS_RU_API_ID
  ? new SmsRuOtpDeliveryChannel({
      apiId: process.env.SMS_RU_API_ID,
      testMode: process.env.SMS_RU_TEST_MODE === 'true',
    })
  : new StubSmsOtpDeliveryChannel();
```

Also add `SmsRuOtpDeliveryChannel` to the existing infrastructure import block at the top of the file (lines 16–25 in auth.ts). Do NOT add a separate import statement inline.

- [ ] **Step 3: Update confirmPhone.ts channel selection**

In `src/web/actions/confirmPhone.ts`, replace line 27:

```typescript
const deliveryChannel = new StubSmsOtpDeliveryChannel();
```

With:

```typescript
const deliveryChannel = process.env.SMS_RU_API_ID
  ? new SmsRuOtpDeliveryChannel({
      apiId: process.env.SMS_RU_API_ID,
      testMode: process.env.SMS_RU_TEST_MODE === 'true',
    })
  : new StubSmsOtpDeliveryChannel();
```

Also add `SmsRuOtpDeliveryChannel` to the existing infrastructure import at the top of the file (lines 8–15 in confirmPhone.ts).

- [ ] **Step 4: Verify full test suite still passes**

Run:

```bash
yarn vitest run
```

Expected: all existing tests still pass + new tests pass.

- [ ] **Step 5: Verify TypeScript compiles**

Run:

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Stage files**

```bash
git add src/infrastructure/index.ts src/web/actions/auth.ts src/web/actions/confirmPhone.ts
```

---

## Task 7: Add SMS_RU secrets to GitHub Actions

**Files:**

- Modify: `.github/workflows/deploy.yml` (or `deploy-prod.yml`)

This is a manual step. The following secrets need to be added in GitHub repo settings → Secrets:

- `SMS_RU_API_ID` — the production sms.ru API key

And the deployment workflow env section needs:

```yaml
SMS_RU_API_ID: ${{ secrets.SMS_RU_API_ID }}
```

- [ ] **Step 1: Identify where env vars are passed in the deploy workflow**

Check the `.env` creation step in the workflow and add the new variable alongside existing secrets like `TURNSTILE_SECRET_KEY` and `OTP_CODE_SECRET`.

- [ ] **Step 2: Add to deployment workflow**

This varies by workflow structure — add `SMS_RU_API_ID` wherever the `.env` file is assembled during deployment.

- [ ] **Step 3: Do NOT commit secrets — add them via GitHub UI**

Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret

---

## Summary

| Task | What                                        | Depends on    |
| ---- | ------------------------------------------- | ------------- |
| 1    | Install `effect` + `@effect/platform`       | —             |
| 2    | Config: `.env.example`, `.gitignore`        | —             |
| 3    | `SmsRuErrors.ts` — TaggedError types        | Task 1        |
| 4    | `SmsRuLogger` — file logger (TDD)           | —             |
| 5    | `SmsRuOtpDeliveryChannel` — main impl (TDD) | Tasks 1, 3, 4 |
| 6    | Wire up in actions + export                 | Task 5        |
| 7    | GitHub Actions secrets (manual)             | Task 6        |
