/** SMS.RU transport values and response codecs. Decode provider JSON before
 * interpreting outcomes; provider IDs/statuses stay separate from domain identity. */
import { z } from 'zod';

export const SmsRuPhone = z
  .string()
  .regex(/^[1-9]\d{1,14}$/)
  .brand<'SmsRuPhone'>();
export type SmsRuPhone = z.infer<typeof SmsRuPhone>;
export const SmsRuStatusCode = z
  .number()
  .int()
  .nonnegative()
  .safe()
  .brand<'SmsRuStatusCode'>();
export type SmsRuStatusCode = z.infer<typeof SmsRuStatusCode>;
// SMS.RU uses two decimal components; retain leading zeros and allow variable widths.
// https://sms.ru/docs/api/api_group_sms/send
const SmsRuMessageId = z
  .string()
  .regex(/^[0-9]+-[0-9]+$/)
  .brand<'SmsRuMessageId'>();
export const SmsPriceRubles = z
  .number()
  .nonnegative()
  .brand<'SmsPriceRubles'>();
export type SmsPriceRubles = z.infer<typeof SmsPriceRubles>;
/** Existing configuration permits any finite ceiling; a negative ceiling blocks all paid/free sends. */
export const SmsCostLimitRubles = z.number().brand<'SmsCostLimitRubles'>();
export type SmsCostLimitRubles = z.infer<typeof SmsCostLimitRubles>;

/** Missing/malformed quotes are explicit absence; partial numeric strings never become prices. */
export function parseSmsPrice(value: unknown): SmsPriceRubles | null {
  let candidate = value;

  if (typeof value === 'string') {
    const text = value.trim();

    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      return null;
    }

    candidate = Number(text);
  }

  const parsed = SmsPriceRubles.safeParse(candidate);

  return parsed.success ? parsed.data : null;
}

const statusFields = {
  status: z.enum(['OK', 'ERROR']),
  status_code: SmsRuStatusCode,
  status_text: z.string().optional(),
};
const agrees = (value: z.infer<typeof statusSchema>) =>
  (value.status === 'OK') === (value.status_code === 100);
const statusSchema = z.object(statusFields);
const sendEntry = statusSchema
  .extend({ sms_id: SmsRuMessageId.optional() })
  .refine(agrees);
const costEntry = statusSchema
  .extend({ cost: z.union([z.string(), z.number()]).optional() })
  .refine(agrees);

/** https://sms.ru/api/send — 100 at the top level does not imply every recipient succeeded. */
export const SmsRuSendResponse = statusSchema
  .extend({
    sms: z.record(SmsRuPhone, sendEntry).optional(),
    balance: z.number().optional(),
  })
  .refine(agrees);
export type SmsRuSendResponse = z.infer<typeof SmsRuSendResponse>;
/** https://sms.ru/api/cost — providers may return cost as numeric zero or a decimal string. */
export const SmsRuCostResponse = statusSchema
  .extend({
    sms: z.record(SmsRuPhone, costEntry).optional(),
    total_cost: z.number().optional(),
  })
  .refine(agrees);
