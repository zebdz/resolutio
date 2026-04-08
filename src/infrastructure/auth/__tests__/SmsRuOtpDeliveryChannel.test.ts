import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SmsRuOtpDeliveryChannel } from '../SmsRuOtpDeliveryChannel';
import { SmsRuLogger } from '../SmsRuLogger';

// Mock the logger
vi.mock('../SmsRuLogger');

// Effect's FetchHttpClient sends bodyUrlParams as a Uint8Array.
// This helper decodes the fetch body back to a URL-encoded string.
function decodeFetchBody(body: unknown): string {
  if (body instanceof globalThis.Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  return String(body ?? '');
}

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

// sms.ru cost check success response
function smsRuCostSuccess(phone: string, cost: number) {
  return {
    status: 'OK',
    status_code: 100,
    sms: {
      [phone]: { status: 'OK', status_code: 100, cost: String(cost), sms: 1 },
    },
    total_cost: cost,
    total_sms: 1,
  };
}

// sms.ru cost check success response without cost field
function smsRuCostMissingCost(phone: string) {
  return {
    status: 'OK',
    status_code: 100,
    sms: {
      [phone]: { status: 'OK', status_code: 100, sms: 1 },
    },
    total_cost: 0,
    total_sms: 1,
  };
}

// sms.ru cost check per-number error response
function smsRuCostUndeliverable(phone: string) {
  return {
    status: 'OK',
    status_code: 100,
    sms: {
      [phone]: {
        status: 'ERROR',
        status_code: 207,
        status_text: 'No delivery route for this number',
      },
    },
    total_cost: 0,
    total_sms: 0,
  };
}

// sms.ru send response where top-level is OK but per-number failed
function smsRuSendPerNumberError(phone: string) {
  return {
    status: 'OK',
    status_code: 100,
    sms: {
      [phone]: {
        status: 'ERROR',
        status_code: 207,
        status_text: 'No delivery route for this number',
      },
    },
    balance: 4122.56,
  };
}

// Helper: mock two sequential fetch calls (cost check then send)
function mockCostThenSend(costBody: object, sendBody: object) {
  return vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(costBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(sendBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
}

describe('SmsRuOtpDeliveryChannel', () => {
  let channel: SmsRuOtpDeliveryChannel;
  const originalFetch = globalThis.fetch;
  const TEST_IP = '192.168.1.100';

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

      const result = await channel.send(
        phone,
        '123456',
        'ru',
        undefined as any
      );

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it('should return success when sms.ru returns status_code 100', async () => {
    const phone = '79255070602';
    globalThis.fetch = mockCostThenSend(
      smsRuCostSuccess(phone, 1.77),
      smsRuSuccess(phone)
    );

    const result = await channel.send(phone, '123456', 'ru', TEST_IP);

    expect(result.success).toBe(true);
    expect(result.backdoorCode).toBeUndefined();
  });

  it('should send correct params to sms.ru', async () => {
    const phone = '79255070602';
    const mockFetch = mockCostThenSend(
      smsRuCostSuccess(phone, 1.77),
      smsRuSuccess(phone)
    );
    globalThis.fetch = mockFetch;

    await channel.send(phone, '123456', 'ru', TEST_IP);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Send call is the second one (after cost check)
    const [url, options] = mockFetch.mock.calls[1];

    // Should be POST to sms.ru
    expect(url.toString()).toContain('sms.ru/sms/send');
    expect(options?.method).toBe('POST');

    const bodyStr = decodeFetchBody(options?.body);
    expect(bodyStr).toContain('api_id=test-api-id');
    expect(bodyStr).toContain(`to=${phone}`);
    expect(bodyStr).toContain('json=1');
    expect(bodyStr).toContain('123456');
  });

  it('should send Russian message for ru locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockCostThenSend(
      smsRuCostSuccess(phone, 1.77),
      smsRuSuccess(phone)
    );
    globalThis.fetch = mockFetch;

    await channel.send(phone, '123456', 'ru', TEST_IP);

    // Send call is the second one (after cost check)
    const bodyStr = decodeFetchBody(mockFetch.mock.calls[1][1]?.body);
    // UrlParams.toString uses application/x-www-form-urlencoded encoding
    // where spaces become '+'. Check the decoded body contains the message.
    expect(bodyStr).toContain('123456');
    // Verify Russian characters are present (URL-encoded)
    expect(bodyStr).toMatch(/%D0%/i);
  });

  it('should send English message for en locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockCostThenSend(
      smsRuCostSuccess(phone, 1.77),
      smsRuSuccess(phone)
    );
    globalThis.fetch = mockFetch;

    await channel.send(phone, '654321', 'en', TEST_IP);

    // Send call is the second one (after cost check)
    const bodyStr = decodeFetchBody(mockFetch.mock.calls[1][1]?.body);
    expect(bodyStr).toContain('654321');
    expect(bodyStr).toMatch(/Your\+verification\+code/i);
  });

  it('should default to Russian for unknown locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockCostThenSend(
      smsRuCostSuccess(phone, 1.77),
      smsRuSuccess(phone)
    );
    globalThis.fetch = mockFetch;

    await channel.send(phone, '111111', 'de', TEST_IP);

    // Send call is the second one (after cost check)
    const bodyStr = decodeFetchBody(mockFetch.mock.calls[1][1]?.body);
    expect(bodyStr).toContain('111111');
    // Should use Russian template (URL-encoded Cyrillic)
    expect(bodyStr).toMatch(/%D0%/i);
  });

  it.each([
    [200, 'Invalid api_id'],
    [201, 'Insufficient balance'],
    [202, 'Invalid phone number'],
    [209, 'Phone in stop-list'],
  ])(
    'should NOT retry on non-retryable send error (%i)',
    async (statusCode, statusText) => {
      const phone = '79255070602';
      const mockFetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuError(statusCode, statusText)
      );
      globalThis.fetch = mockFetch;

      const result = await channel.send(phone, '123456', 'ru', TEST_IP);

      expect(result.success).toBe(false);
      // cost check + one send attempt
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }
  );

  it('should return failure on send network error after retries', async () => {
    const phone = '79255070602';
    const mockFetch = vi
      .fn()
      // Cost check succeeds
      .mockResolvedValueOnce(
        new Response(JSON.stringify(smsRuCostSuccess(phone, 1.77)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      // Send fails with network error
      .mockRejectedValue(new Error('Network error'));
    globalThis.fetch = mockFetch;

    const result = await channel.send(phone, '123456', 'ru', TEST_IP);

    expect(result.success).toBe(false);
  });

  it.each([220, 500])(
    'should retry on retryable sms.ru send error (%i)',
    async (retryableCode) => {
      const phone = '79255070602';
      const mockFetch = vi
        .fn()
        // Cost check succeeds
        .mockResolvedValueOnce(
          new Response(JSON.stringify(smsRuCostSuccess(phone, 1.77)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // First send attempt fails with retryable error
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify(smsRuError(retryableCode, 'Retryable error')),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
        // Second send attempt succeeds
        .mockResolvedValueOnce(
          new Response(JSON.stringify(smsRuSuccess(phone)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      globalThis.fetch = mockFetch;

      const result = await channel.send(phone, '123456', 'ru', TEST_IP);

      expect(result.success).toBe(true);
      // cost check + failed send + retry send
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }
  );

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

  describe('test mode', () => {
    beforeEach(() => {
      channel = new SmsRuOtpDeliveryChannel({
        apiId: 'test-api-id',
        testMode: true,
      });
    });

    it('should pass test=1 param when testMode is true', async () => {
      const phone = '79255070602';
      const mockFetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );
      globalThis.fetch = mockFetch;

      await channel.send(phone, '123456', 'ru', TEST_IP);

      // Send call is the second one (after cost check)
      const bodyStr = decodeFetchBody(mockFetch.mock.calls[1][1]?.body);
      expect(bodyStr).toContain('test=1');
    });

    it('should return backdoorCode when testMode is true', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );

      const result = await channel.send(phone, '123456', 'ru', TEST_IP);

      expect(result.success).toBe(true);
      expect(result.backdoorCode).toBe('123456');
    });
  });

  describe('logging', () => {
    it('should log success via SmsRuLogger', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );

      await channel.send(phone, '123456', 'ru', TEST_IP);

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          locale: 'ru',
          clientIp: TEST_IP,
          statusCode: 100,
          smsId: '000-123',
          balance: 4122.56,
          cost: 1.77,
          testMode: false,
          message: 'SMS sent successfully',
        })
      );
    });

    it('should log error via SmsRuLogger on send failure', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuError(201, 'Insufficient balance')
      );

      await channel.send(phone, '123456', 'ru', TEST_IP);

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          locale: 'ru',
          clientIp: TEST_IP,
          statusCode: 201,
          error: 'Insufficient balance',
        })
      );
    });

    it('should fail and log undeliverable when send returns per-number ERROR with top-level 100', async () => {
      const phone = '44712345678';
      const mockFetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSendPerNumberError(phone)
      );
      globalThis.fetch = mockFetch;

      const result = await channel.send(phone, '123456', 'en', TEST_IP);

      expect(result.success).toBe(false);

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logUndeliverable).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          locale: 'en',
          clientIp: TEST_IP,
          statusCode: 207,
          statusText: 'No delivery route for this number',
          testMode: false,
        })
      );
    });
  });

  describe('cost guard', () => {
    let guardedChannel: SmsRuOtpDeliveryChannel;

    beforeEach(() => {
      guardedChannel = new SmsRuOtpDeliveryChannel({
        apiId: 'test-api-id',
        testMode: false,
        maxCost: 2.5,
      });
    });

    it('should call cost API before sending when maxCost is set', async () => {
      const phone = '79255070602';
      const mockFetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );
      globalThis.fetch = mockFetch;

      await guardedChannel.send(phone, '123456', 'ru', TEST_IP);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // First call should be to /sms/cost
      expect(mockFetch.mock.calls[0][0].toString()).toContain(
        'sms.ru/sms/cost'
      );
      // Second call should be to /sms/send
      expect(mockFetch.mock.calls[1][0].toString()).toContain(
        'sms.ru/sms/send'
      );
    });

    it('should proceed and return success when cost <= maxCost', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );

      const result = await guardedChannel.send(phone, '123456', 'ru', TEST_IP);

      expect(result.success).toBe(true);
    });

    it('should abort and return failure when cost > maxCost', async () => {
      const phone = '44712345678';
      const mockFetch = mockFetchResponse(smsRuCostSuccess(phone, 8.5));
      globalThis.fetch = mockFetch;

      const result = await guardedChannel.send(phone, '123456', 'en', TEST_IP);

      expect(result.success).toBe(false);
      // Should only call cost API, not send
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should abort when cost check returns per-number error', async () => {
      const phone = '44712345678';
      const mockFetch = mockFetchResponse(smsRuCostUndeliverable(phone));
      globalThis.fetch = mockFetch;

      const result = await guardedChannel.send(phone, '123456', 'en', TEST_IP);

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should abort when cost check fails with network error', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'));
      globalThis.fetch = mockFetch;

      const result = await guardedChannel.send(
        '79255070602',
        '123456',
        'ru',
        TEST_IP
      );

      expect(result.success).toBe(false);
      // Only cost check attempted, no send
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should log cost exceeded via SmsRuLogger', async () => {
      const phone = '44712345678';
      globalThis.fetch = mockFetchResponse(smsRuCostSuccess(phone, 8.5));

      await guardedChannel.send(phone, '123456', 'en', TEST_IP);

      // guardedChannel is instances[1] (parent beforeEach creates channel at [0])
      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[1];
      expect(loggerInstance.logCostExceeded).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          locale: 'en',
          clientIp: TEST_IP,
          statusCode: 100,
          cost: 8.5,
          maxCost: 2.5,
          testMode: false,
          error: 'SMS cost 8.5 exceeds max allowed 2.5',
        })
      );
    });

    it('should log undeliverable via SmsRuLogger', async () => {
      const phone = '44712345678';
      globalThis.fetch = mockFetchResponse(smsRuCostUndeliverable(phone));

      await guardedChannel.send(phone, '123456', 'en', TEST_IP);

      // guardedChannel is instances[1] (parent beforeEach creates channel at [0])
      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[1];
      expect(loggerInstance.logUndeliverable).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          locale: 'en',
          clientIp: TEST_IP,
          statusCode: 207,
          statusText: 'No delivery route for this number',
          testMode: false,
        })
      );
    });

    it('should log cost in success entry when send proceeds', async () => {
      const phone = '79255070602';
      globalThis.fetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );

      await guardedChannel.send(phone, '123456', 'ru', TEST_IP);

      // guardedChannel is instances[1] (parent beforeEach creates channel at [0])
      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[1];
      expect(loggerInstance.logSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          phone,
          clientIp: TEST_IP,
          cost: 1.77,
        })
      );
    });

    it('should block send when cost API returns no cost field', async () => {
      const phone = '79255070602';
      const mockFetch = mockFetchResponse(smsRuCostMissingCost(phone));
      globalThis.fetch = mockFetch;

      const result = await guardedChannel.send(phone, '123456', 'ru', TEST_IP);

      expect(result.success).toBe(false);
      // Only cost check, no send
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should still call cost API and log cost when maxCost is not set', async () => {
      const phone = '79255070602';
      const mockFetch = mockCostThenSend(
        smsRuCostSuccess(phone, 1.77),
        smsRuSuccess(phone)
      );
      globalThis.fetch = mockFetch;

      // Use the channel without maxCost
      await channel.send(phone, '123456', 'ru', TEST_IP);

      // Cost check + send = 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0].toString()).toContain(
        'sms.ru/sms/cost'
      );
      expect(mockFetch.mock.calls[1][0].toString()).toContain(
        'sms.ru/sms/send'
      );

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ phone, cost: 1.77 })
      );
    });

    it('should abort on undeliverable even when maxCost is not set', async () => {
      const phone = '44712345678';
      const mockFetch = mockFetchResponse(smsRuCostUndeliverable(phone));
      globalThis.fetch = mockFetch;

      // Use the channel without maxCost
      await channel.send(phone, '123456', 'en', TEST_IP);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const loggerInstance = vi.mocked(SmsRuLogger).mock.instances[0];
      expect(loggerInstance.logUndeliverable).toHaveBeenCalled();
    });
  });
});
