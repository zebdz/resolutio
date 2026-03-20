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

    const bodyStr = decodeFetchBody(options?.body);
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

    const bodyStr = decodeFetchBody(mockFetch.mock.calls[0][1]?.body);
    // UrlParams.toString uses application/x-www-form-urlencoded encoding
    // where spaces become '+'. Check the decoded body contains the message.
    expect(bodyStr).toContain('123456');
    // Verify Russian characters are present (URL-encoded)
    expect(bodyStr).toMatch(/%D0%/i);
  });

  it('should send English message for en locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockFetchResponse(smsRuSuccess(phone));
    globalThis.fetch = mockFetch;

    await channel.send(phone, '654321', 'en');

    const bodyStr = decodeFetchBody(mockFetch.mock.calls[0][1]?.body);
    expect(bodyStr).toContain('654321');
    expect(bodyStr).toMatch(/Your\+verification\+code/i);
  });

  it('should default to Russian for unknown locale', async () => {
    const phone = '79255070602';
    const mockFetch = mockFetchResponse(smsRuSuccess(phone));
    globalThis.fetch = mockFetch;

    await channel.send(phone, '111111', 'de');

    const bodyStr = decodeFetchBody(mockFetch.mock.calls[0][1]?.body);
    expect(bodyStr).toContain('111111');
    // Should use Russian template (URL-encoded Cyrillic)
    expect(bodyStr).toMatch(/%D0%/i);
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

      const bodyStr = decodeFetchBody(mockFetch.mock.calls[0][1]?.body);
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
