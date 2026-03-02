import { describe, it, expect } from 'vitest';
import {
  calculateThrottleDelay,
  getRetryAfter,
} from '../OtpThrottleCalculator';

describe('OtpThrottleCalculator', () => {
  describe('calculateThrottleDelay', () => {
    it('should return 0 for first request', () => {
      expect(calculateThrottleDelay(0)).toBe(0);
    });

    it('should return 60s for second request', () => {
      expect(calculateThrottleDelay(1)).toBe(60);
    });

    it('should return 300s for third request', () => {
      expect(calculateThrottleDelay(2)).toBe(300);
    });

    it('should return 1800s for fourth request', () => {
      expect(calculateThrottleDelay(3)).toBe(1800);
    });

    it('should return 3600s for fifth request', () => {
      expect(calculateThrottleDelay(4)).toBe(3600);
    });

    it('should return 7200s for sixth request', () => {
      expect(calculateThrottleDelay(5)).toBe(7200);
    });

    it('should double to 14400s for seventh request', () => {
      expect(calculateThrottleDelay(6)).toBe(14400);
    });

    it('should double to 28800s for eighth request', () => {
      expect(calculateThrottleDelay(7)).toBe(28800);
    });

    it('should cap at 86400s (24h) for ninth request', () => {
      expect(calculateThrottleDelay(8)).toBe(57600);
    });

    it('should cap at 86400s for very high counts', () => {
      expect(calculateThrottleDelay(20)).toBe(86400);
    });
  });

  describe('getRetryAfter', () => {
    it('should return 0 when no recent OTPs', () => {
      expect(getRetryAfter(0, null)).toBe(0);
    });

    it('should return 0 when no lastOtpCreatedAt', () => {
      expect(getRetryAfter(3, null)).toBe(0);
    });

    it('should return remaining seconds when throttled', () => {
      // 1 recent OTP → 60s delay, created 10s ago → 50s remaining
      const tenSecsAgo = new Date(Date.now() - 10 * 1000);
      const result = getRetryAfter(1, tenSecsAgo);
      expect(result).toBe(50);
    });

    it('should return 0 when enough time has passed', () => {
      // 1 recent OTP → 60s delay, created 120s ago → 0 remaining
      const twoMinsAgo = new Date(Date.now() - 120 * 1000);
      expect(getRetryAfter(1, twoMinsAgo)).toBe(0);
    });

    it('should handle exact boundary', () => {
      // 1 recent OTP → 60s delay, created exactly 60s ago → 0
      const exactlyOneMinAgo = new Date(Date.now() - 60 * 1000);
      expect(getRetryAfter(1, exactlyOneMinAgo)).toBe(0);
    });
  });
});
