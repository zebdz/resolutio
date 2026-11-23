/** Compile-only transport clients retain price, budget, status and recipient meanings. */
import { SmsDeliveryConfig } from '../smsDeliveryConfig';
import {
  SmsPriceRubles,
  SmsRuStatusCode,
  SmsRuPhone,
  SmsRuSendResponse,
} from '../SmsRuProtocol';
import { UserId } from '@/domain/shared/EntityIds';
declare const price: SmsPriceRubles;
declare const code: SmsRuStatusCode;
declare const limit: NonNullable<SmsDeliveryConfig['maxCostRubles']>;
declare const config: SmsDeliveryConfig;
// @ts-expect-error A status code cannot become a configured price ceiling.
const statusAsLimit: NonNullable<SmsDeliveryConfig['maxCostRubles']> = code;
// @ts-expect-error A quote and a configured ceiling have separate constraints.
const quoteAsLimit: NonNullable<SmsDeliveryConfig['maxCostRubles']> = price;
// @ts-expect-error Invalid configuration cannot simultaneously contain a valid ceiling.
const inconsistent: SmsDeliveryConfig = {
  channelActive: true,
  testMode: false,
  maxCostInvalid: true,
  maxCostRubles: limit,
};
// @ts-expect-error Configuration alternatives cannot be changed through independent field writes.
config.maxCostInvalid = false;
// @ts-expect-error Quotes require a nonnegative finite ruble value.
const uncheckedPrice: SmsPriceRubles = 1;
// @ts-expect-error Provider phones require explicit digits-only transport decoding.
const uncheckedPhone: SmsRuPhone = '+79161234567';

type MessageId = NonNullable<
  NonNullable<SmsRuSendResponse['sms']>[SmsRuPhone]['sms_id']
>;
declare const messageId: MessageId;
declare const userId: UserId;
declare const phone: SmsRuPhone;
// @ts-expect-error A provider message reference is not an application user identity.
const messageAsUser: UserId = messageId;
// @ts-expect-error An application identity cannot substitute for a provider message reference.
const userAsMessage: MessageId = userId;
// @ts-expect-error A recipient phone is not a message identity.
const phoneAsMessage: MessageId = phone;
// @ts-expect-error A message reference requires provider-specific decoding.
const rawMessage: MessageId = '000000-10000000';
