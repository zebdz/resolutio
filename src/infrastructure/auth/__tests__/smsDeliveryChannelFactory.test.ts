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
