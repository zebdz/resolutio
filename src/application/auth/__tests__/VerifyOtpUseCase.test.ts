import { describe, it, expect, beforeEach } from 'vitest';
import { VerifyOtpUseCase } from '../VerifyOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { OtpCodeHasher } from '../OtpCodeHasher';

// Mock OtpRepository
class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();

  async save(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async findById(id: string): Promise<OtpVerification | null> {
    return this.otps.get(id) || null;
  }

  async findLatestByIdentifier(): Promise<OtpVerification | null> {
    return null;
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async countRecentByClientIp(): Promise<number> {
    return 0;
  }

  async countRecentByIdentifier(): Promise<number> {
    return 0;
  }

  async deleteExpired(): Promise<void> {}

  // Test helpers
  addOtp(otp: OtpVerification): void {
    this.otps.set(otp.id, otp);
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

function createOtp(
  overrides: Partial<{
    id: string;
    identifier: string;
    code: string;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    verifiedAt: Date | null;
  }> = {}
): OtpVerification {
  return OtpVerification.reconstitute({
    id: overrides.id ?? 'otp-1',
    identifier: overrides.identifier ?? '+79161234567',
    channel: 'sms',
    code: overrides.code ?? 'hashed-123456',
    clientIp: '127.0.0.1',
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 5,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    verifiedAt: overrides.verifiedAt ?? null,
    createdAt: new Date(),
  });
}

describe('VerifyOtpUseCase', () => {
  let useCase: VerifyOtpUseCase;
  let otpRepository: MockOtpRepository;
  let otpCodeHasher: MockOtpCodeHasher;

  beforeEach(() => {
    otpRepository = new MockOtpRepository();
    otpCodeHasher = new MockOtpCodeHasher();

    useCase = new VerifyOtpUseCase({
      otpRepository,
      otpCodeHasher,
    });
  });

  it('should fail when OTP not found', async () => {
    const result = await useCase.execute({
      otpId: 'non-existent',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.NOT_FOUND);
    }
  });

  it('should fail when OTP is expired', async () => {
    const otp = createOtp({
      expiresAt: new Date(Date.now() - 1000),
    });
    otpRepository.addOtp(otp);

    const result = await useCase.execute({
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.EXPIRED);
    }
  });

  it('should fail when OTP is already verified', async () => {
    const otp = createOtp({
      verifiedAt: new Date(),
    });
    otpRepository.addOtp(otp);

    const result = await useCase.execute({
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.ALREADY_VERIFIED);
    }
  });

  it('should fail when max attempts reached', async () => {
    const otp = createOtp({
      attempts: 5,
      maxAttempts: 5,
    });
    otpRepository.addOtp(otp);

    const result = await useCase.execute({
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.MAX_ATTEMPTS);
    }
  });

  it('should fail with wrong code and increment attempts', async () => {
    const otp = createOtp({ code: 'hashed-123456' });
    otpRepository.addOtp(otp);

    const result = await useCase.execute({
      otpId: 'otp-1',
      code: '999999', // wrong code
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }

    // Verify attempts incremented
    const updated = await otpRepository.findById('otp-1');
    expect(updated!.attempts).toBe(1);
  });

  it('should succeed with correct code', async () => {
    const otp = createOtp({ code: 'hashed-123456' });
    otpRepository.addOtp(otp);

    const result = await useCase.execute({
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(true);

    // Verify marked as verified
    const updated = await otpRepository.findById('otp-1');
    expect(updated!.isVerified()).toBe(true);
  });
});
