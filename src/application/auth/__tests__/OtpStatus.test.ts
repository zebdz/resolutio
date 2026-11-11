import { Seconds } from '@/domain/auth/AuthValues';
import { describe, it, expect } from 'vitest';
import { shouldIssueCode } from '../OtpStatus';

// Login and registration send a code on the user's behalf only under the
// same conditions the confirm-phone page would enable "Send code".
describe('shouldIssueCode', () => {
  it('issues when nothing is pending and the throttle allows', () => {
    expect(
      shouldIssueCode({
        hasPendingCode: false,
        retryAfterSeconds: Seconds.parse(0),
      })
    ).toBe(true);
  });

  it('holds while a code can still be entered', () => {
    expect(
      shouldIssueCode({
        hasPendingCode: true,
        retryAfterSeconds: Seconds.parse(0),
      })
    ).toBe(false);
  });

  it('holds while the throttle runs', () => {
    expect(
      shouldIssueCode({
        hasPendingCode: false,
        retryAfterSeconds: Seconds.parse(300),
      })
    ).toBe(false);
  });
});
