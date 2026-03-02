import { describe, it, expect, beforeEach } from 'vitest';
import { OtpVerification, OtpChannel } from '../OtpVerification';

describe('OtpVerification', () => {
  const baseProps = {
    id: 'otp-1',
    identifier: '+79161234567',
    channel: 'sms' as OtpChannel,
    code: 'hashed-code',
    clientIp: '127.0.0.1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    verifiedAt: null,
    createdAt: new Date(),
  };

  describe('create', () => {
    it('should create a new OtpVerification', () => {
      const otp = OtpVerification.create({
        identifier: '+79161234567',
        channel: 'sms',
        code: 'hashed-code',
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      expect(otp.identifier).toBe('+79161234567');
      expect(otp.channel).toBe('sms');
      expect(otp.code).toBe('hashed-code');
      expect(otp.clientIp).toBe('127.0.0.1');
      expect(otp.attempts).toBe(0);
      expect(otp.maxAttempts).toBe(5);
      expect(otp.verifiedAt).toBeNull();
      expect(otp.id).toBe('');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persisted props', () => {
      const otp = OtpVerification.reconstitute(baseProps);

      expect(otp.id).toBe('otp-1');
      expect(otp.identifier).toBe('+79161234567');
      expect(otp.attempts).toBe(0);
    });
  });

  describe('isExpired', () => {
    it('should return false when not expired', () => {
      const otp = OtpVerification.reconstitute(baseProps);
      expect(otp.isExpired()).toBe(false);
    });

    it('should return true when expired', () => {
      const otp = OtpVerification.reconstitute({
        ...baseProps,
        expiresAt: new Date(Date.now() - 1000), // 1 sec ago
      });
      expect(otp.isExpired()).toBe(true);
    });
  });

  describe('isVerified', () => {
    it('should return false when not verified', () => {
      const otp = OtpVerification.reconstitute(baseProps);
      expect(otp.isVerified()).toBe(false);
    });

    it('should return true when verified', () => {
      const otp = OtpVerification.reconstitute({
        ...baseProps,
        verifiedAt: new Date(),
      });
      expect(otp.isVerified()).toBe(true);
    });
  });

  describe('hasMaxAttempts', () => {
    it('should return false when under max', () => {
      const otp = OtpVerification.reconstitute({
        ...baseProps,
        attempts: 4,
        maxAttempts: 5,
      });
      expect(otp.hasMaxAttempts()).toBe(false);
    });

    it('should return true when at max', () => {
      const otp = OtpVerification.reconstitute({
        ...baseProps,
        attempts: 5,
        maxAttempts: 5,
      });
      expect(otp.hasMaxAttempts()).toBe(true);
    });

    it('should return true when over max', () => {
      const otp = OtpVerification.reconstitute({
        ...baseProps,
        attempts: 6,
        maxAttempts: 5,
      });
      expect(otp.hasMaxAttempts()).toBe(true);
    });
  });

  describe('incrementAttempts', () => {
    it('should return new instance with incremented attempts', () => {
      const otp = OtpVerification.reconstitute(baseProps);
      const incremented = otp.incrementAttempts();

      expect(incremented.attempts).toBe(1);
      // Original unchanged
      expect(otp.attempts).toBe(0);
    });
  });

  describe('markVerified', () => {
    it('should return new instance with verifiedAt set', () => {
      const otp = OtpVerification.reconstitute(baseProps);
      const verified = otp.markVerified();

      expect(verified.isVerified()).toBe(true);
      expect(verified.verifiedAt).toBeInstanceOf(Date);
      // Original unchanged
      expect(otp.isVerified()).toBe(false);
    });
  });
});
