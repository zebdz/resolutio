import { authTestNow } from '@/application/auth/__tests__/authTestValues';
import { describe, it, expect } from 'vitest';
import { Instant } from '@/domain/shared/Instant';
import { OtpCount } from '@/domain/otp/OtpValues';
import {
  calculateThrottleDelay,
  getRetryAfter,
} from '../OtpThrottleCalculator';

describe('OtpThrottleCalculator', () => {
  it('evaluates retry delay at the supplied instant', () => {
    const createdAt = Instant.parse('2026-10-26T10:00:00.000Z');
    const now = Instant.parse('2026-10-26T10:00:10.000Z');

    expect(getRetryAfter(OtpCount.parse(1), createdAt, now)).toBe(50);
  });

  describe('calculateThrottleDelay', () => {
    it('should return 0 for first request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(0))).toBe(0);
    });

    it('should return 60s for second request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(1))).toBe(60);
    });

    it('should return 300s for third request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(2))).toBe(300);
    });

    it('should return 1800s for fourth request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(3))).toBe(1800);
    });

    it('should return 3600s for fifth request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(4))).toBe(3600);
    });

    it('should return 7200s for sixth request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(5))).toBe(7200);
    });

    it('should double to 14400s for seventh request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(6))).toBe(14400);
    });

    it('should double to 28800s for eighth request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(7))).toBe(28800);
    });

    it('should cap at 86400s (24h) for ninth request', () => {
      expect(calculateThrottleDelay(OtpCount.parse(8))).toBe(57600);
    });

    it('should cap at 86400s for very high counts', () => {
      expect(calculateThrottleDelay(OtpCount.parse(20))).toBe(86400);
    });
  });

  describe('getRetryAfter', () => {
    it('should return 0 when no recent OTPs', () => {
      expect(getRetryAfter(OtpCount.parse(0), null, authTestNow())).toBe(0);
    });

    it('should return 0 when no lastOtpCreatedAt', () => {
      expect(getRetryAfter(OtpCount.parse(3), null, authTestNow())).toBe(0);
    });

    it('should return remaining seconds when throttled', () => {
      // 1 recent OTP → 60s delay, created 10s ago → 50s remaining
      const tenSecsAgo = new Date(Date.now() - 10 * 1000);
      const result = getRetryAfter(
        OtpCount.parse(1),
        Instant.fromDate(tenSecsAgo),
        authTestNow()
      );
      expect(result).toBe(50);
    });

    it('should return 0 when enough time has passed', () => {
      // 1 recent OTP → 60s delay, created 120s ago → 0 remaining
      const twoMinsAgo = new Date(Date.now() - 120 * 1000);
      expect(
        getRetryAfter(
          OtpCount.parse(1),
          Instant.fromDate(twoMinsAgo),
          authTestNow()
        )
      ).toBe(0);
    });

    it('should handle exact boundary', () => {
      // 1 recent OTP → 60s delay, created exactly 60s ago → 0
      const exactlyOneMinAgo = new Date(Date.now() - 60 * 1000);
      expect(
        getRetryAfter(
          OtpCount.parse(1),
          Instant.fromDate(exactlyOneMinAgo),
          authTestNow()
        )
      ).toBe(0);
    });
  });
});
