/** Provider failures keep transport, protocol, price and recipient outcomes distinct. */
import { Data } from 'effect';
import {
  SmsRuPhone,
  SmsRuStatusCode,
  SmsPriceRubles,
  SmsCostLimitRubles,
} from './SmsRuProtocol';

export class SmsRuApiError extends Data.TaggedError('SmsRuApiError')<{
  readonly statusCode: SmsRuStatusCode;
  readonly message: string;
  readonly rawResponse?: unknown;
}> {}

export class SmsRuNetworkError extends Data.TaggedError('SmsRuNetworkError')<{
  readonly cause: unknown;
}> {}

export class SmsRuInvalidResponseError extends Data.TaggedError(
  'SmsRuInvalidResponseError'
)<{
  readonly message: string;
  readonly rawResponse: unknown;
}> {}

export class SmsRuCostExceededError extends Data.TaggedError(
  'SmsRuCostExceededError'
)<{
  readonly phone: SmsRuPhone;
  readonly statusCode: SmsRuStatusCode;
  readonly cost: SmsPriceRubles | null;
  readonly maxCost: SmsCostLimitRubles;
  readonly rawResponse?: unknown;
}> {}

export class SmsRuUndeliverableError extends Data.TaggedError(
  'SmsRuUndeliverableError'
)<{
  readonly phone: SmsRuPhone;
  readonly statusCode: SmsRuStatusCode;
  readonly statusText: string;
  readonly rawResponse?: unknown;
}> {}

export const RETRYABLE_STATUS_CODES = [220, 500] as const;
