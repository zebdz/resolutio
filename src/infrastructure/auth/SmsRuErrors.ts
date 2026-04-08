import { Data } from 'effect';

export class SmsRuApiError extends Data.TaggedError('SmsRuApiError')<{
  readonly statusCode: number;
  readonly message: string;
  readonly rawResponse?: unknown;
}> {}

export class SmsRuNetworkError extends Data.TaggedError('SmsRuNetworkError')<{
  readonly cause: unknown;
}> {}

export class SmsRuCostExceededError extends Data.TaggedError(
  'SmsRuCostExceededError'
)<{
  readonly phone: string;
  readonly statusCode: number;
  readonly cost: number;
  readonly maxCost: number;
  readonly rawResponse?: unknown;
}> {}

export class SmsRuUndeliverableError extends Data.TaggedError(
  'SmsRuUndeliverableError'
)<{
  readonly phone: string;
  readonly statusCode: number;
  readonly statusText: string;
  readonly rawResponse?: unknown;
}> {}

export const RETRYABLE_STATUS_CODES = [220, 500] as const;
