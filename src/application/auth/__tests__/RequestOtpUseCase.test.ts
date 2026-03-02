import { describe, it, expect, beforeEach } from 'vitest';
import { RequestOtpUseCase } from '../RequestOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { CaptchaVerifier } from '../CaptchaVerifier';
import { OtpCodeHasher } from '../OtpCodeHasher';
import { OtpDeliveryChannel, OtpDeliveryResult } from '../OtpDeliveryChannel';

// Mock OtpRepository
class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();
  private nextId = 1;

  async save(otp: OtpVerification): Promise<OtpVerification> {
    const id = `otp-${this.nextId++}`;
    (otp as any).props.id = id;
    this.otps.set(id, otp);

    return otp;
  }

  async findById(id: string): Promise<OtpVerification | null> {
    return this.otps.get(id) || null;
  }

  async findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel
  ): Promise<OtpVerification | null> {
    const all = Array.from(this.otps.values()).filter(
      (o) => o.identifier === identifier && o.channel === channel
    );

    if (all.length === 0) {return null;}

    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async countRecentByClientIp(ip: string, sinceHours: number): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return Array.from(this.otps.values()).filter(
      (o) => o.clientIp === ip && o.createdAt >= since
    ).length;
  }

  async countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    sinceHours: number
  ): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return Array.from(this.otps.values()).filter(
      (o) =>
        o.identifier === identifier &&
        o.channel === channel &&
        o.createdAt >= since
    ).length;
  }

  async deleteExpired(): Promise<void> {}
}

// Mock CaptchaVerifier
class MockCaptchaVerifier implements CaptchaVerifier {
  shouldPass = true;

  async verify(): Promise<boolean> {
    return this.shouldPass;
  }
}

// Mock OtpCodeHasher
class MockOtpCodeHasher implements OtpCodeHasher {
  hash(code: string): string {
    return `hashed-${code}`;
  }

  verify(code: string, hash: string): boolean {
    return `hashed-${code}` === hash;
  }
}

// Mock OtpDeliveryChannel
class MockOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'sms';
  shouldSucceed = true;
  lastSentCode: string | null = null;

  async send(
    _recipient: string,
    code: string,
    _locale: string
  ): Promise<OtpDeliveryResult> {
    this.lastSentCode = code;

    if (!this.shouldSucceed) {
      return { success: false };
    }

    return { success: true, backdoorCode: code };
  }
}

describe('RequestOtpUseCase', () => {
  let useCase: RequestOtpUseCase;
  let otpRepository: MockOtpRepository;
  let captchaVerifier: MockCaptchaVerifier;
  let otpCodeHasher: MockOtpCodeHasher;
  let deliveryChannel: MockOtpDeliveryChannel;

  beforeEach(() => {
    otpRepository = new MockOtpRepository();
    captchaVerifier = new MockCaptchaVerifier();
    otpCodeHasher = new MockOtpCodeHasher();
    deliveryChannel = new MockOtpDeliveryChannel();

    useCase = new RequestOtpUseCase({
      otpRepository,
      captchaVerifier,
      otpCodeHasher,
      deliveryChannel,
    });
  });

  const validInput = {
    phoneNumber: '+79161234567',
    captchaToken: 'valid-token',
    clientIp: '127.0.0.1',
    locale: 'ru',
  };

  it('should fail when CAPTCHA verification fails', async () => {
    captchaVerifier.shouldPass = false;

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.CAPTCHA_FAILED);
    }
  });

  it('should fail with invalid phone number', async () => {
    const result = await useCase.execute({
      ...validInput,
      phoneNumber: 'not-a-phone',
    });

    expect(result.success).toBe(false);
  });

  it('should succeed and return otpId, expiresAt, backdoorCode', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.otpId).toBeTruthy();
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      expect(result.value.backdoorCode).toBeTruthy();
    }
  });

  it('should hash the code before saving', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      const saved = await otpRepository.findById(result.value.otpId);
      expect(saved).not.toBeNull();
      // Code in DB should be hashed
      expect(saved!.code).toMatch(/^hashed-/);
    }
  });

  it('should fail when delivery channel fails', async () => {
    deliveryChannel.shouldSucceed = false;

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.SEND_FAILED);
    }
  });

  it('should throttle when too many recent OTPs from same IP', async () => {
    // Fill up recent OTPs for this IP so the next request is throttled
    for (let i = 0; i < 1; i++) {
      await useCase.execute(validInput);
    }

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.THROTTLED);
    }
  });
});
