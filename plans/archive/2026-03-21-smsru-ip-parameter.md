# SMS.ru IP Parameter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client IP to SMS.ru API requests (`ip` param) for abuse protection, include IP in all SMS logs, abort sending if IP is missing.

**Architecture:** Thread `clientIp` through `OtpDeliveryChannel.send()` → SMS.ru API. Validate IP is non-empty in `SmsRuOtpDeliveryChannel` before any API call. Add `clientIp` to all `SmsRuLogger` entry interfaces.

**Tech Stack:** TypeScript, Effect, Vitest

---

## File Map

| File                                                                   | Action | Responsibility                                              |
| ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `src/infrastructure/auth/SmsRuLogger.ts`                               | Modify | Add `clientIp` to all log entry interfaces                  |
| `src/application/auth/OtpDeliveryChannel.ts`                           | Modify | Add `clientIp` param to `send()`                            |
| `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`                   | Modify | Validate IP, pass `ip` param to API, pass IP to logger      |
| `src/infrastructure/auth/StubSmsOtpDeliveryChannel.ts`                 | Modify | Update `send()` signature                                   |
| `src/application/auth/RegisterUserUseCase.ts:183`                      | Modify | Pass `input.clientIp` to `send()`                           |
| `src/application/auth/LoginUserUseCase.ts:119`                         | Modify | Pass `input.ipAddress \|\| '0.0.0.0'` to `send()`           |
| `src/application/auth/RequestConfirmationOtpUseCase.ts:96`             | Modify | Pass `input.clientIp` to `send()`                           |
| `src/infrastructure/auth/__tests__/SmsRuLogger.test.ts`                | Modify | Add `clientIp` to all test entries                          |
| `src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts`    | Modify | Add IP validation tests, update all existing `send()` calls |
| `src/application/auth/__tests__/RequestConfirmationOtpUseCase.test.ts` | Modify | Update mock `send()` signature                              |
| `src/application/auth/__tests__/RegisterUserUseCase.test.ts`           | Modify | Update mock `send()` signature                              |
| `src/application/auth/__tests__/LoginUserUseCase.test.ts`              | Modify | Update mock `send()` signature                              |

---

## Task 1: Add `clientIp` to SmsRuLogger entry interfaces

Logger interfaces must be updated first — both the delivery channel (Task 2) and its tests (Task 3) depend on them.

**Files:**

- Modify: `src/infrastructure/auth/SmsRuLogger.ts:4-37`
- Modify: `src/infrastructure/auth/__tests__/SmsRuLogger.test.ts`

- [ ] **Step 1: Update test entries to include `clientIp`**

Add `clientIp: '10.0.0.1'` to every `logger.logXxx({...})` call in the test file. There are 7 calls total:

- `logSuccess` at lines 19, 37, 90, 112, 121
- `logError` at line 62
- `logCostExceeded` at line 141
- `logUndeliverable` at line 169

Also add `clientIp` assertion to the "write success entry" test (line 52 area):

```typescript
expect(entry.clientIp).toBe('10.0.0.1');
```

**Note:** The second `logSuccess` call at line 121 is also missing the required `cost` field (pre-existing bug). Fix it by adding `cost: 1.5` alongside `clientIp`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/infrastructure/auth/__tests__/SmsRuLogger.test.ts`
Expected: FAIL — `clientIp` not in interfaces yet

- [ ] **Step 3: Add `clientIp: string` to all four log entry interfaces**

In `src/infrastructure/auth/SmsRuLogger.ts`, add `clientIp: string;` to:

- `SmsRuSuccessLogEntry`
- `SmsRuErrorLogEntry`
- `SmsRuCostExceededLogEntry`
- `SmsRuUndeliverableLogEntry`

- [ ] **Step 4: Run logger tests**

Run: `yarn vitest run src/infrastructure/auth/__tests__/SmsRuLogger.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```
feat: add clientIp to all SmsRuLogger entry interfaces
```

---

## Task 2: Add IP validation tests to SmsRuOtpDeliveryChannel

**Files:**

- Test: `src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts`

- [ ] **Step 1: Write failing tests for IP validation**

Add a new `describe('ip validation')` block after the existing `'should throw if apiId is empty'` test:

```typescript
describe('ip validation', () => {
  it('should abort and return failure when clientIp is empty string', async () => {
    const phone = '79255070602';
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const result = await channel.send(phone, '123456', 'ru', '');

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should abort and return failure when clientIp is null', async () => {
    const phone = '79255070602';
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const result = await channel.send(phone, '123456', 'ru', null as any);

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should abort and return failure when clientIp is undefined', async () => {
    const phone = '79255070602';
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const result = await channel.send(phone, '123456', 'ru', undefined as any);

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts -t "ip validation"`
Expected: FAIL — `send()` doesn't accept 4th param yet

- [ ] **Step 3: Commit**

```
test: add failing IP validation tests for SmsRu channel
```

---

## Task 3: Add `clientIp` to `OtpDeliveryChannel` interface and implementations

**Files:**

- Modify: `src/application/auth/OtpDeliveryChannel.ts:10-14`
- Modify: `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts:88-92`
- Modify: `src/infrastructure/auth/StubSmsOtpDeliveryChannel.ts:14-18`

- [ ] **Step 1: Update `OtpDeliveryChannel` interface**

In `src/application/auth/OtpDeliveryChannel.ts`, change `send()` to:

```typescript
send(
  recipient: string,
  code: string,
  locale: string,
  clientIp: string
): Promise<OtpDeliveryResult>;
```

- [ ] **Step 2: Update `StubSmsOtpDeliveryChannel.send()` signature**

In `src/infrastructure/auth/StubSmsOtpDeliveryChannel.ts`:

```typescript
async send(
  _recipient: string,
  code: string,
  _locale: string,
  _clientIp: string
): Promise<OtpDeliveryResult> {
  return { success: true, backdoorCode: code };
}
```

- [ ] **Step 3: Update `SmsRuOtpDeliveryChannel.send()` — add IP validation, pass to API and logger**

In `src/infrastructure/auth/SmsRuOtpDeliveryChannel.ts`, update the `send()` method:

a) Change signature to accept `clientIp`:

```typescript
async send(
  recipient: string,
  code: string,
  locale: string,
  clientIp: string
): Promise<OtpDeliveryResult> {
```

b) Add IP validation at the top of `send()`, before building params — early return `{ success: false }` and log:

```typescript
if (!clientIp) {
  this.logger.logError({
    phone: recipient,
    locale,
    clientIp: '',
    statusCode: 0,
    error: 'Missing client IP — aborting SMS send',
    retryAttempt: 0,
    testMode: this.testMode,
  });
  return { success: false };
}
```

c) Add `ip` to the `params` object (after the existing params):

```typescript
params['ip'] = clientIp;
```

d) Add `clientIp` to all `this.logger.logXxx()` calls in `send()`'s `catchAll` handler (lines 122-157). There are 3 calls: `logCostExceeded`, `logUndeliverable`, `logError`.

e) Update `buildSendSms` signature to accept `clientIp: string`. Add `clientIp` to the `logSuccess` call (line 228) and `logError` call (line 256) inside it. Update the call site in `send()` to pass `clientIp`.

- [ ] **Step 4: Run IP validation tests**

Run: `yarn vitest run src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts -t "ip validation"`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```
feat: add clientIp to OtpDeliveryChannel.send() with validation
```

---

## Task 4: Update existing SmsRuOtpDeliveryChannel tests to pass `clientIp`

**Files:**

- Modify: `src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts`

- [ ] **Step 1: Add a test-level constant and update all `send()` calls**

Add near the top of the describe block:

```typescript
const TEST_IP = '192.168.1.100';
```

Update every `channel.send(phone, '...', '...')` → `channel.send(phone, '...', '...', TEST_IP)` and same for `guardedChannel.send(...)`. There are ~23 call sites across the file.

- [ ] **Step 2: Add test: IP is sent to sms.ru API**

In the main describe block, add:

```typescript
it('should include ip param in sms.ru API requests', async () => {
  const phone = '79255070602';
  const mockFetch = mockCostThenSend(
    smsRuCostSuccess(phone, 1.77),
    smsRuSuccess(phone)
  );
  globalThis.fetch = mockFetch;

  await channel.send(phone, '123456', 'ru', '203.0.113.42');

  // Cost check should include ip
  const costBody = decodeFetchBody(mockFetch.mock.calls[0][1]?.body);
  expect(costBody).toContain('ip=203.0.113.42');

  // Send should include ip
  const sendBody = decodeFetchBody(mockFetch.mock.calls[1][1]?.body);
  expect(sendBody).toContain('ip=203.0.113.42');
});
```

- [ ] **Step 3: Update log assertion tests to include `clientIp`**

In the `logging` describe block, update `logSuccess` and `logError` assertions to include `clientIp: TEST_IP`.

Same for `logCostExceeded`, `logUndeliverable`, and `logSuccess` assertions in the `cost guard` block.

- [ ] **Step 4: Run all SmsRuOtpDeliveryChannel tests**

Run: `yarn vitest run src/infrastructure/auth/__tests__/SmsRuOtpDeliveryChannel.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```
test: update SmsRu channel tests to pass clientIp
```

---

## Task 5: Thread `clientIp` through use cases

**Files:**

- Modify: `src/application/auth/RegisterUserUseCase.ts:183-186`
- Modify: `src/application/auth/LoginUserUseCase.ts:119-122`
- Modify: `src/application/auth/RequestConfirmationOtpUseCase.ts:96-99`
- Modify: `src/application/auth/__tests__/RequestConfirmationOtpUseCase.test.ts`
- Modify: `src/application/auth/__tests__/RegisterUserUseCase.test.ts`
- Modify: `src/application/auth/__tests__/LoginUserUseCase.test.ts`

- [ ] **Step 1: Update mock `OtpDeliveryChannel` in all 3 use case test files**

Each test file has a `MockOtpDeliveryChannel` class. Update the `send()` signature to accept the 4th param:

```typescript
async send(
  _recipient: string,
  code: string,
  _locale: string,
  _clientIp: string
): Promise<OtpDeliveryResult> {
```

- [ ] **Step 2: Update `RegisterUserUseCase` to pass `clientIp`**

In `src/application/auth/RegisterUserUseCase.ts:183-186`, change:

```typescript
const deliveryResult = await this.deliveryChannel.send(
  phoneNumber.getValue(),
  code.getValue(),
  savedUser.language,
  input.clientIp
);
```

- [ ] **Step 3: Update `LoginUserUseCase` to pass `clientIp`**

In `src/application/auth/LoginUserUseCase.ts:119-122`, change:

```typescript
const deliveryResult = await this.deliveryChannel.send(
  phoneNumber.getValue(),
  code.getValue(),
  user.language,
  input.ipAddress || '0.0.0.0'
);
```

- [ ] **Step 4: Update `RequestConfirmationOtpUseCase` to pass `clientIp`**

In `src/application/auth/RequestConfirmationOtpUseCase.ts:96-99`, change:

```typescript
const deliveryResult = await this.deliveryChannel.send(
  phone,
  code.getValue(),
  user.language,
  input.clientIp
);
```

- [ ] **Step 5: Run all use case tests**

Run: `yarn vitest run src/application/auth/__tests__/`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite**

Run: `yarn vitest run`
Expected: ALL PASS — no other callers of `send()` were missed

- [ ] **Step 7: Commit**

```
feat: thread clientIp through use cases to delivery channel
```

---

## Unresolved Questions

1. `'0.0.0.0'` fallback in `LoginUserUseCase` — keep, or abort on missing IP? (`ipAddress` is optional in `LoginUserInput`)
