import { describe, it, expect, beforeEach } from 'vitest';
import { OtpVerification, OtpChannel, OtpPurposes } from '../OtpVerification';

describe('OtpVerification', () => {
  const baseProps = {
    id: 'otp-1',
    identifier: '+79161234567',
    channel: 'sms' as OtpChannel,
    purpose: OtpPurposes.PHONE_CONFIRMATION,
    code: 'hashed-code',
    clientIp: '127.0.0.1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    verifiedAt: null,
    createdAt: new Date(),
    userId: 'user-1',
  };

  describe('create', () => {
    it('should create a new OtpVerification', () => {
      const otp = OtpVerification.create({
        identifier: '+79161234567',
        channel: 'sms',
        purpose: OtpPurposes.PHONE_CONFIRMATION,
        code: 'hashed-code',
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        userId: 'user-1',
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

describe('OtpVerification purpose', () => {
  it('carries the purpose it was created for', () => {
    const otp = OtpVerification.create({
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: OtpPurposes.PASSWORD_RESET,
      code: 'hashed',
      clientIp: '127.0.0.1',
      expiresAt: new Date(Date.now() + 600_000),
      userId: 'user-1',
    });

    expect(otp.purpose).toBe('password_reset');
  });

  it('keeps the purpose across incrementAttempts and markVerified', () => {
    const otp = OtpVerification.create({
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: OtpPurposes.EMAIL_CONFIRMATION,
      code: 'hashed',
      clientIp: '127.0.0.1',
      expiresAt: new Date(Date.now() + 600_000),
      userId: 'user-1',
    });

    expect(otp.incrementAttempts().purpose).toBe('email_confirmation');
    expect(otp.markVerified().purpose).toBe('email_confirmation');
  });

  it('exposes exactly the three known purposes', () => {
    expect(Object.values(OtpPurposes)).toEqual([
      'phone_confirmation',
      'email_confirmation',
      'password_reset',
    ]);
  });
});

describe('OtpVerification isPending', () => {
  const live = {
    id: 'otp-1',
    identifier: '+79161234567',
    channel: 'sms' as OtpChannel,
    purpose: OtpPurposes.PHONE_CONFIRMATION,
    code: 'hashed-code',
    clientIp: '127.0.0.1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    verifiedAt: null,
    createdAt: new Date(),
    userId: 'user-1',
  };

  it('is pending while unverified, unexpired and with attempts left', () => {
    expect(OtpVerification.reconstitute(live).isPending()).toBe(true);
  });

  it('stops being pending once verified', () => {
    const otp = OtpVerification.reconstitute({
      ...live,
      verifiedAt: new Date(),
    });

    expect(otp.isPending()).toBe(false);
  });

  it('stops being pending once expired', () => {
    const otp = OtpVerification.reconstitute({
      ...live,
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(otp.isPending()).toBe(false);
  });

  it('stops being pending once out of attempts', () => {
    const otp = OtpVerification.reconstitute({ ...live, attempts: 5 });

    expect(otp.isPending()).toBe(false);
  });
});
