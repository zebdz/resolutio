/** OTP identity, attempts and verification state are validated at the boundary.
 * Callers supply identity and time; no wall clock or randomness enters the domain. */
import { OtpVerificationId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { ClientIp } from '../auth/AuthValues';
import {
  OtpAttempts,
  OtpAttemptLimit,
  OtpCodeHash,
  OtpDestination,
  OtpChannel,
  OtpPurpose,
} from './OtpValues';
export { OtpChannel, OtpPurpose, OtpPurposes } from './OtpValues';

type VerificationState =
  | { readonly status: 'pending' }
  | { readonly status: 'verified'; readonly verifiedAt: Instant };

export type OtpVerificationProps = Readonly<
  OtpDestination & {
    id: OtpVerificationId;
    purpose: OtpPurpose;
    code: OtpCodeHash;
    clientIp: ClientIp;
    attempts: OtpAttempts;
    maxAttempts: OtpAttemptLimit;
    expiresAt: Instant;
    verification: VerificationState;
    createdAt: Instant;
    userId: UserId;
  }
>;

export type CreateOtpVerificationProps = OtpDestination & {
  readonly purpose: OtpPurpose;
  readonly code: OtpCodeHash;
  readonly clientIp: ClientIp;
  readonly expiresAt: Instant;
  readonly maxAttempts?: OtpAttemptLimit;
  readonly userId: UserId;
};

/** Untrusted persistence scalars are accepted only by validated reconstitution. */
export interface RawOtpVerificationProps {
  id: string;
  identifier: string;
  channel: string;
  purpose: string;
  code: string;
  clientIp: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string | Date;
  verifiedAt: string | Date | null;
  createdAt: string | Date;
  userId: string;
}

function storedInstant(value: string | Date): Instant {
  return value instanceof Date ? Instant.fromDate(value) : Instant.parse(value);
}

export class OtpVerification {
  private readonly props: OtpVerificationProps;

  private constructor(props: OtpVerificationProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(
    input: CreateOtpVerificationProps,
    creation: EntityCreation<OtpVerificationId>
  ): OtpVerification {
    return OtpVerification.reconstitute({
      ...input,
      id: creation.id,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      verifiedAt: null,
      createdAt: creation.now,
    });
  }

  static reconstitute(raw: RawOtpVerificationProps): OtpVerification {
    const destination = OtpDestination.parse({
      channel: raw.channel,
      identifier: raw.identifier,
    });

    return new OtpVerification({
      ...destination,
      id: OtpVerificationId.parse(raw.id),
      userId: UserId.parse(raw.userId),
      purpose: OtpPurpose.parse(raw.purpose),
      code: OtpCodeHash.parse(raw.code),
      clientIp: ClientIp.parse(raw.clientIp),
      attempts: OtpAttempts.parse(raw.attempts),
      maxAttempts: OtpAttemptLimit.parse(raw.maxAttempts),
      expiresAt: storedInstant(raw.expiresAt),
      createdAt: storedInstant(raw.createdAt),
      verification:
        raw.verifiedAt === null
          ? { status: 'pending' }
          : { status: 'verified', verifiedAt: storedInstant(raw.verifiedAt) },
    });
  }

  get id(): OtpVerificationId {
    return this.props.id;
  }
  get identifier(): OtpDestination['identifier'] {
    return this.props.identifier;
  }
  get destination(): OtpDestination {
    return OtpDestination.parse({
      channel: this.channel,
      identifier: this.identifier,
    });
  }
  get channel(): OtpChannel {
    return this.props.channel;
  }
  get purpose(): OtpPurpose {
    return this.props.purpose;
  }
  get code(): OtpCodeHash {
    return this.props.code;
  }
  get clientIp(): ClientIp {
    return this.props.clientIp;
  }
  get attempts(): OtpAttempts {
    return this.props.attempts;
  }
  get maxAttempts(): OtpAttemptLimit {
    return this.props.maxAttempts;
  }
  get expiresAt(): Instant {
    return this.props.expiresAt;
  }
  get verifiedAt(): Instant | null {
    return this.props.verification.status === 'verified'
      ? this.props.verification.verifiedAt
      : null;
  }
  get createdAt(): Instant {
    return this.props.createdAt;
  }
  get userId(): UserId {
    return this.props.userId;
  }

  isExpired(now: Instant): boolean {
    // Preserve the existing exact-expiry boundary: expiry starts strictly after it.
    return Instant.parse(now) > this.props.expiresAt;
  }

  isVerified(): boolean {
    return this.props.verification.status === 'verified';
  }

  /** Still awaiting a correct entry: unverified, unexpired and with attempts left. */
  isPending(now: Instant): boolean {
    return !this.isVerified() && !this.isExpired(now) && !this.hasMaxAttempts();
  }

  hasMaxAttempts(): boolean {
    // Existing historical rows may exceed their limit; they remain exhausted.
    return this.props.attempts >= this.props.maxAttempts;
  }

  incrementAttempts(): OtpVerification {
    return new OtpVerification({
      ...this.props,
      attempts: OtpAttempts.parse(this.props.attempts + 1),
    });
  }

  markVerified(now: Instant): OtpVerification {
    return new OtpVerification({
      ...this.props,
      verification: { status: 'verified', verifiedAt: Instant.parse(now) },
    });
  }
}
