export type OtpChannel = 'sms' | 'email';

/**
 * What a code was minted for. Without this, two codes issued to the same
 * address on the same channel are indistinguishable rows, and a code sent to
 * confirm an email address could be redeemed at the password-reset endpoint.
 */
export const OtpPurposes = {
  PHONE_CONFIRMATION: 'phone_confirmation',
  EMAIL_CONFIRMATION: 'email_confirmation',
  PASSWORD_RESET: 'password_reset',
} as const;

export type OtpPurpose = (typeof OtpPurposes)[keyof typeof OtpPurposes];

export interface OtpVerificationProps {
  id: string;
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  code: string; // hashed
  clientIp: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
  userId: string;
}

export class OtpVerification {
  private constructor(private readonly props: OtpVerificationProps) {}

  static create(input: {
    identifier: string;
    channel: OtpChannel;
    purpose: OtpPurpose;
    code: string;
    clientIp: string;
    expiresAt: Date;
    maxAttempts?: number;
    userId: string;
  }): OtpVerification {
    return new OtpVerification({
      id: '',
      identifier: input.identifier,
      channel: input.channel,
      purpose: input.purpose,
      code: input.code,
      clientIp: input.clientIp,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      expiresAt: input.expiresAt,
      verifiedAt: null,
      createdAt: new Date(),
      userId: input.userId,
    });
  }

  static reconstitute(props: OtpVerificationProps): OtpVerification {
    return new OtpVerification(props);
  }

  get id(): string {
    return this.props.id;
  }
  get identifier(): string {
    return this.props.identifier;
  }
  get channel(): OtpChannel {
    return this.props.channel;
  }
  get purpose(): OtpPurpose {
    return this.props.purpose;
  }
  get code(): string {
    return this.props.code;
  }
  get clientIp(): string {
    return this.props.clientIp;
  }
  get attempts(): number {
    return this.props.attempts;
  }
  get maxAttempts(): number {
    return this.props.maxAttempts;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get verifiedAt(): Date | null {
    return this.props.verifiedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get userId(): string {
    return this.props.userId;
  }

  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  isVerified(): boolean {
    return this.props.verifiedAt !== null;
  }

  hasMaxAttempts(): boolean {
    return this.props.attempts >= this.props.maxAttempts;
  }

  incrementAttempts(): OtpVerification {
    return new OtpVerification({
      ...this.props,
      attempts: this.props.attempts + 1,
    });
  }

  markVerified(): OtpVerification {
    return new OtpVerification({
      ...this.props,
      verifiedAt: new Date(),
    });
  }
}
