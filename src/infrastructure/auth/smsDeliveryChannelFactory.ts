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
