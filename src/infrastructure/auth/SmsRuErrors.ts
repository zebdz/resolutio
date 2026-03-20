import { Data } from 'effect';

export class SmsRuApiError extends Data.TaggedError('SmsRuApiError')<{
  readonly statusCode: number;
  readonly message: string;
}> {}

export class SmsRuNetworkError extends Data.TaggedError('SmsRuNetworkError')<{
  readonly cause: unknown;
}> {}

export const RETRYABLE_STATUS_CODES = [220, 500] as const;
