import { Effect, Schedule, pipe } from 'effect';
import {
  HttpClient,
  HttpClientRequest,
  FetchHttpClient,
} from '@effect/platform';
import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { OtpChannel } from '@/domain/otp/OtpVerification';
import {
  SmsRuApiError,
  SmsRuNetworkError,
  SmsRuCostExceededError,
  SmsRuUndeliverableError,
  RETRYABLE_STATUS_CODES,
} from './SmsRuErrors';
import { SmsRuLogger } from './SmsRuLogger';

const SMS_RU_API_URL = 'https://sms.ru/sms/send';
const SMS_RU_COST_URL = 'https://sms.ru/sms/cost';

const MESSAGE_TEMPLATES: Record<string, string> = {
  ru: 'Ваш код подтверждения: {code}',
  en: 'Your verification code: {code}',
};

function buildMessage(code: string, locale: string): string {
  const template = MESSAGE_TEMPLATES[locale] ?? MESSAGE_TEMPLATES['ru'];

  return template.replace('{code}', code);
}

function isRetryableStatusCode(code: number): boolean {
  return (RETRYABLE_STATUS_CODES as readonly number[]).includes(code);
}

interface SmsRuResponse {
  status: string;
  status_code: number;
  status_text?: string;
  sms?: Record<
    string,
    {
      status: string;
      status_code: number;
      sms_id?: string;
      status_text?: string;
    }
  >;
  balance?: number;
}

interface SmsRuCostResponse {
  status: string;
  status_code: number;
  status_text?: string;
  sms?: Record<
    string,
    {
      status: string;
      status_code: number;
      cost?: string | number;
      status_text?: string;
    }
  >;
  total_cost?: number;
}

interface CostCheckResult {
  cost: number;
}

export class SmsRuOtpDeliveryChannel implements OtpDeliveryChannel {
  readonly channel: OtpChannel = 'sms';
  private readonly apiId: string;
  private readonly testMode: boolean;
  private readonly maxCost?: number;
  private readonly logger: SmsRuLogger;

  constructor(config: { apiId: string; testMode?: boolean; maxCost?: number }) {
    if (!config.apiId) {
      throw new Error('SmsRuOtpDeliveryChannel: apiId is required');
    }

    this.apiId = config.apiId;
    this.testMode = config.testMode ?? false;
    this.maxCost = config.maxCost;
    this.logger = new SmsRuLogger();
  }

  async send(
    recipient: string,
    code: string,
    locale: string,
    clientIp: string
  ): Promise<OtpDeliveryResult> {
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

    const message = buildMessage(code, locale);

    const params: Record<string, string> = {
      api_id: this.apiId,
      to: recipient,
      msg: message,
      json: '1',
      ip: clientIp,
    };

    if (this.testMode) {
      params['test'] = '1';
    }

    // Cost check — always runs before sending
    const costCheck = this.buildCostCheck(params, recipient);

    const program = pipe(
      costCheck,
      Effect.flatMap((costResult) =>
        this.buildSendSms(params, recipient, locale, code, costResult, clientIp)
      ),
      Effect.catchAll(
        (
          error:
            | SmsRuApiError
            | SmsRuNetworkError
            | SmsRuCostExceededError
            | SmsRuUndeliverableError
        ): Effect.Effect<OtpDeliveryResult> => {
          if (error._tag === 'SmsRuCostExceededError') {
            this.logger.logCostExceeded({
              phone: error.phone,
              locale,
              statusCode: error.statusCode,
              cost: error.cost,
              maxCost: error.maxCost,
              testMode: this.testMode,
              clientIp,
              error: `SMS cost ${error.cost} exceeds max allowed ${error.maxCost}`,
              rawResponse: error.rawResponse,
            });
          } else if (error._tag === 'SmsRuUndeliverableError') {
            this.logger.logUndeliverable({
              phone: error.phone,
              locale,
              statusCode: error.statusCode,
              statusText: error.statusText,
              testMode: this.testMode,
              clientIp,
              rawResponse: error.rawResponse,
            });
          } else {
            const statusCode =
              error._tag === 'SmsRuApiError' ? error.statusCode : 0;
            const errorMessage =
              error._tag === 'SmsRuApiError'
                ? error.message
                : String(
                    error.cause instanceof Error
                      ? error.cause.message
                      : error.cause
                  );
            const rawResponse =
              error._tag === 'SmsRuApiError' ? error.rawResponse : undefined;
            this.logger.logError({
              phone: recipient,
              locale,
              statusCode,
              error: `Cost check failed: ${errorMessage}`,
              retryAttempt: 0,
              testMode: this.testMode,
              clientIp,
              rawResponse,
            });
          }

          return Effect.succeed({ success: false });
        }
      ),
      Effect.provide(FetchHttpClient.layer)
    );

    return Effect.runPromise(program);
  }

  private buildSendSms(
    params: Record<string, string>,
    recipient: string,
    locale: string,
    code: string,
    costResult: CostCheckResult,
    clientIp: string
  ): Effect.Effect<OtpDeliveryResult, never, HttpClient.HttpClient> {
    const logger = this.logger;
    const testMode = this.testMode;

    const attempt = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const request = pipe(
        HttpClientRequest.post(SMS_RU_API_URL),
        HttpClientRequest.bodyUrlParams(params)
      );

      const response = yield* pipe(
        client.execute(request),
        Effect.scoped,
        Effect.mapError((error) => new SmsRuNetworkError({ cause: error }))
      );

      const json = yield* pipe(
        response.json,
        Effect.mapError((error) => new SmsRuNetworkError({ cause: error }))
      );

      const data = json as SmsRuResponse;

      if (data.status_code !== 100) {
        return yield* Effect.fail(
          new SmsRuApiError({
            statusCode: data.status_code,
            message: data.status_text ?? `SMS.ru error: ${data.status_code}`,
            rawResponse: data,
          })
        );
      }

      // Top-level OK, but check per-number status — sms.ru can return
      // top-level 100 with a per-number ERROR (e.g. undeliverable number).
      const smsEntry = data.sms?.[recipient];

      if (smsEntry && smsEntry.status === 'ERROR') {
        return yield* Effect.fail(
          new SmsRuUndeliverableError({
            phone: recipient,
            statusCode: smsEntry.status_code,
            statusText: smsEntry.status_text ?? 'Undeliverable',
            rawResponse: data,
          })
        );
      }

      return data;
    });

    const retried = pipe(
      attempt,
      Effect.retry({
        times: 2,
        schedule: Schedule.exponential('500 millis'),
        while: (
          error: SmsRuNetworkError | SmsRuApiError | SmsRuUndeliverableError
        ) => {
          if (error._tag === 'SmsRuNetworkError') {
            return true;
          }

          if (error._tag === 'SmsRuApiError') {
            return isRetryableStatusCode(error.statusCode);
          }

          return false;
        },
      })
    );

    return pipe(
      retried,
      Effect.map((data: SmsRuResponse): OtpDeliveryResult => {
        const smsEntry = data.sms?.[recipient];
        logger.logSuccess({
          phone: recipient,
          locale,
          statusCode: smsEntry?.status_code ?? data.status_code,
          smsId: smsEntry?.sms_id ?? '',
          balance: data.balance ?? 0,
          cost: costResult.cost,
          testMode,
          clientIp,
          message: 'SMS sent successfully',
        });

        return testMode
          ? { success: true, backdoorCode: code }
          : { success: true };
      }),
      Effect.catchAll(
        (
          error: SmsRuApiError | SmsRuNetworkError | SmsRuUndeliverableError
        ): Effect.Effect<OtpDeliveryResult> => {
          if (error._tag === 'SmsRuUndeliverableError') {
            logger.logUndeliverable({
              phone: error.phone,
              locale,
              statusCode: error.statusCode,
              statusText: error.statusText,
              testMode,
              clientIp,
              rawResponse: error.rawResponse,
            });

            return Effect.succeed({ success: false });
          }

          const statusCode =
            error._tag === 'SmsRuApiError' ? error.statusCode : 0;
          const errorMessage =
            error._tag === 'SmsRuApiError'
              ? error.message
              : String(
                  error.cause instanceof Error
                    ? error.cause.message
                    : error.cause
                );
          const rawResponse =
            error._tag === 'SmsRuApiError' ? error.rawResponse : undefined;
          logger.logError({
            phone: recipient,
            locale,
            statusCode,
            error: errorMessage,
            retryAttempt: 0,
            testMode,
            clientIp,
            rawResponse,
          });

          return Effect.succeed({ success: false });
        }
      )
    );
  }

  private buildCostCheck(
    params: Record<string, string>,
    recipient: string
  ): Effect.Effect<
    CostCheckResult,
    | SmsRuApiError
    | SmsRuNetworkError
    | SmsRuCostExceededError
    | SmsRuUndeliverableError,
    HttpClient.HttpClient
  > {
    const maxCost = this.maxCost;

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const request = pipe(
        HttpClientRequest.post(SMS_RU_COST_URL),
        HttpClientRequest.bodyUrlParams(params)
      );

      const response = yield* pipe(
        client.execute(request),
        Effect.scoped,
        Effect.mapError((error) => new SmsRuNetworkError({ cause: error }))
      );

      const json = yield* pipe(
        response.json,
        Effect.mapError((error) => new SmsRuNetworkError({ cause: error }))
      );

      const data = json as SmsRuCostResponse;

      // Check top-level API error
      if (data.status_code !== 100) {
        return yield* Effect.fail(
          new SmsRuApiError({
            statusCode: data.status_code,
            message:
              data.status_text ?? `SMS.ru cost error: ${data.status_code}`,
            rawResponse: data,
          })
        );
      }

      // Check per-number status
      const smsEntry = data.sms?.[recipient];

      if (smsEntry && smsEntry.status === 'ERROR') {
        return yield* Effect.fail(
          new SmsRuUndeliverableError({
            phone: recipient,
            statusCode: smsEntry.status_code,
            statusText: smsEntry.status_text ?? 'Undeliverable',
            rawResponse: data,
          })
        );
      }

      // If cost is missing or invalid, assume the worst to avoid silent overspend.
      // Parse defensively: sms.ru may return cost as string or number (observed
      // numeric 0 for free SMS in prod). A truthy check would misclassify
      // numeric 0 as "missing" and block legitimate free SMS.
      const parsedCost = parseFloat(String(smsEntry?.cost ?? ''));
      const cost = Number.isFinite(parsedCost) ? parsedCost : Infinity;

      // Check cost against maxCost
      if (maxCost !== undefined && cost > maxCost) {
        return yield* Effect.fail(
          new SmsRuCostExceededError({
            phone: recipient,
            statusCode: smsEntry?.status_code ?? data.status_code,
            cost,
            maxCost,
            rawResponse: data,
          })
        );
      }

      return { cost };
    });
  }
}
