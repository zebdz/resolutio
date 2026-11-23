/** Provider message IDs are decoded using SMS.RU's numeric-pair representation.
 * Transport input keeps leading zeros and rejects malformed values without coercion. */
import { expect, it } from 'vitest';
import { SmsRuPhone, SmsRuSendResponse } from '../SmsRuProtocol';

const recipient = SmsRuPhone.parse('79161234567');

function response(smsId: unknown) {
  return {
    status: 'OK',
    status_code: 100,
    sms: { [recipient]: { status: 'OK', status_code: 100, sms_id: smsId } },
  };
}

it.each(['000000-10000000', '000000-000001', '000-123'])(
  'preserves provider message ID %s',
  (id) => {
    expect(SmsRuSendResponse.parse(response(id)).sms?.[recipient].sms_id).toBe(
      id
    );
  }
);

it.each(['', ' ', 'not-an-id', '000-123\n', '000-123-456', '123', 123, null])(
  'rejects malformed provider message ID %j',
  (id) => {
    expect(SmsRuSendResponse.safeParse(response(id)).success).toBe(false);
  }
);
