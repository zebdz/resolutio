/** Decodes raw environment settings into the effective SMS configuration.
 * A flagged invalid ceiling cannot also carry a value; display and channel creation share it. */
import { SmsCostLimitRubles } from './SmsRuProtocol';

interface SmsDeliveryFlags {
  /** true = real sms.ru channel; false = stub (SMS effectively disabled). */
  readonly channelActive: boolean;
  /** sms.ru test mode — messages are validated but not actually sent/charged. */
  readonly testMode: boolean;
}

export type SmsDeliveryConfig = SmsDeliveryFlags &
  (
    | {
        /** Effective per-SMS cost cap in rubles; null means no cap. */
        readonly maxCostRubles: SmsCostLimitRubles | null;
        /** True when SMS_RU_MAX_COST_RUBLES is set but not a finite number. */
        readonly maxCostInvalid: false;
      }
    | { readonly maxCostRubles: null; readonly maxCostInvalid: true }
  );

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

  if (!raw.maxCost) {
    return {
      channelActive,
      testMode,
      maxCostRubles: null,
      maxCostInvalid: false,
    };
  }

  const parsed = SmsCostLimitRubles.safeParse(Number(raw.maxCost));

  return parsed.success
    ? {
        channelActive,
        testMode,
        maxCostRubles: parsed.data,
        maxCostInvalid: false,
      }
    : { channelActive, testMode, maxCostRubles: null, maxCostInvalid: true };
}

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
