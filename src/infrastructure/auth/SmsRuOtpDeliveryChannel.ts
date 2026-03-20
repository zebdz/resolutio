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
  RETRYABLE_STATUS_CODES,
} from './SmsRuErrors';
import { SmsRuLogger } from './SmsRuLogger';

const SMS_RU_API_URL = 'https://sms.ru/sms/send';

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
    { status: string; status_code: number; sms_id?: string }
  >;
  balance?: number;
}

export class SmsRuOtpDeliveryChannel implements OtpDeliveryChannel {
  readonly channel: OtpChannel = 'sms';
  private readonly apiId: string;
  private readonly testMode: boolean;
  private readonly logger: SmsRuLogger;

  constructor(config: { apiId: string; testMode?: boolean }) {
    if (!config.apiId) {
      throw new Error('SmsRuOtpDeliveryChannel: apiId is required');
    }

    this.apiId = config.apiId;
    this.testMode = config.testMode ?? false;
    this.logger = new SmsRuLogger();
  }

  async send(
    recipient: string,
    code: string,
    locale: string
  ): Promise<OtpDeliveryResult> {
    const message = buildMessage(code, locale);

    const params: Record<string, string> = {
      api_id: this.apiId,
      to: recipient,
      msg: message,
      json: '1',
    };

    if (this.testMode) {
      params['test'] = '1';
    }

    const sendSms = pipe(
      HttpClient.HttpClient,
      Effect.flatMap((client) => {
        const request = pipe(
          HttpClientRequest.post(SMS_RU_API_URL),
          HttpClientRequest.bodyUrlParams(params)
        );

        return client.execute(request);
      }),
      Effect.scoped,
      Effect.flatMap((response) => response.json),
      Effect.mapError(
        (error) =>
          new SmsRuNetworkError({
            cause: error,
          })
      ),
      Effect.flatMap((json) => {
        const data = json as SmsRuResponse;

        if (data.status_code === 100) {
          return Effect.succeed(data);
        }

        return Effect.fail(
          new SmsRuApiError({
            statusCode: data.status_code,
            message: data.status_text ?? `SMS.ru error: ${data.status_code}`,
          })
        );
      }),
      Effect.retry({
        times: 2,
        schedule: Schedule.exponential('500 millis'),
        while: (error) => {
          if (error._tag === 'SmsRuNetworkError') {return true;}

          if (error._tag === 'SmsRuApiError')
            {return isRetryableStatusCode(error.statusCode);}

          return false;
        },
      })
    );

    const program = pipe(
      sendSms,
      Effect.map((data: SmsRuResponse): OtpDeliveryResult => {
        const smsEntry = data.sms?.[recipient];
        this.logger.logSuccess({
          phone: recipient,
          locale,
          statusCode: data.status_code,
          smsId: smsEntry?.sms_id ?? '',
          balance: data.balance ?? 0,
          testMode: this.testMode,
        });

        return this.testMode
          ? { success: true, backdoorCode: code }
          : { success: true };
      }),
      Effect.catchAll(
        (
          error: SmsRuApiError | SmsRuNetworkError
        ): Effect.Effect<OtpDeliveryResult> => {
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
          this.logger.logError({
            phone: recipient,
            locale,
            statusCode,
            error: errorMessage,
            retryAttempt: 0,
            testMode: this.testMode,
          });

          return Effect.succeed({ success: false });
        }
      ),
      Effect.provide(FetchHttpClient.layer)
    );

    return Effect.runPromise(program);
  }
}
