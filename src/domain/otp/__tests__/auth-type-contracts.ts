/** Compiler fixtures prove credentials, identities, counts and duration units stay distinct. */
import { Session } from '../../user/Session';
import {
  OtpVerification,
  CreateOtpVerificationProps,
} from '../OtpVerification';
import { OtpAttempts, OtpCodeHash, OtpDigits, OtpCount } from '../OtpValues';
import { OtpVerificationId, SessionId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { Minutes, Seconds } from '../../auth/AuthValues';
import { OtpCodeHasher } from '../../../application/auth/OtpCodeHasher';
import { OtpDeliveryChannel } from '../../../application/auth/OtpDeliveryChannel';
import { OtpPurposes } from '../OtpVerification';
import { OtpDestination } from '../OtpValues';
import {
  ClientIp,
  CaptchaToken,
  CaptchaChallenge,
} from '../../auth/AuthValues';
import { EmailSender } from '../../../application/auth/EmailSender';
import { EmailAddress } from '../../user/EmailAddress';
import { CaptchaVerifier } from '../../../application/auth/CaptchaVerifier';
import { PasswordGenerator } from '../../../application/auth/PasswordGenerator';
import { ResetUserPasswordResult } from '../../../application/auth/ResetUserPasswordUseCase';

declare const userId: UserId;
declare const sessionId: SessionId;
declare const otpId: OtpVerificationId;
declare const now: Instant;
declare const input: CreateOtpVerificationProps;
declare const code: OtpDigits;
declare const hash: OtpCodeHash;
declare const hasher: OtpCodeHasher;
declare const minutes: Minutes;
declare const attempts: OtpAttempts;
declare const delivery: OtpDeliveryChannel<'sms'>;
declare const destination: Extract<OtpDestination, { channel: 'sms' }>;
declare const ip: ClientIp;

OtpVerification.create(input, { id: otpId, now });
Session.create(
  { userId, expiresAt: now, ipAddress: null, userAgent: null },
  { id: sessionId, now }
);
hasher.verify(code, hash);
delivery.send(
  destination.identifier,
  // @ts-expect-error Delivery requires a validated OTP, never an arbitrary string.
  '123456',
  'ru',
  ip,
  OtpPurposes.PHONE_CONFIRMATION
);

// @ts-expect-error Creation must receive explicit identity and time.
OtpVerification.create(input);
// @ts-expect-error A session credential cannot identify an OTP.
OtpVerification.create(input, { id: sessionId, now });
// @ts-expect-error A mutable Date is not an immutable domain instant.
OtpVerification.create(input, { id: otpId, now: new Date() });
// @ts-expect-error Raw digits must be validated before hashing.
hasher.hash('123456');
// @ts-expect-error A stored hash cannot be used as an entered code.
hasher.verify(hash, hash);
// @ts-expect-error Seconds and minutes are not interchangeable.
const seconds: Seconds = minutes;
// @ts-expect-error Attempts and requests count different events.
const count: OtpCount = attempts;
Session.create(
  { userId, expiresAt: now, ipAddress: null, userAgent: null },
  // @ts-expect-error User identity cannot be a session credential.
  { id: userId, now }
);
const session = Session.reconstitute({
  id: 'token',
  userId: 'user',
  expiresAt: now,
  createdAt: now,
  ipAddress: null,
  userAgent: null,
});
// @ts-expect-error Session timestamps cannot be mutated or reassigned.
session.expiresAt = now;

// @ts-expect-error Delivery recipients must be decoded destination values.
delivery.send('unchecked', code, 'ru', ip, OtpPurposes.PHONE_CONFIRMATION);
delivery.send(
  destination.identifier,
  code,
  'ru',
  // @ts-expect-error Delivery network addresses must be validated at the boundary.
  'unchecked',
  OtpPurposes.PHONE_CONFIRMATION
);
// @ts-expect-error A configured delivery channel cannot change its transport kind.
delivery.channel = 'email';

import { SmsRuOtpDeliveryChannel } from '../../../infrastructure/auth/SmsRuOtpDeliveryChannel';
import { EmailOtpDeliveryChannel } from '../../../infrastructure/auth/EmailOtpDeliveryChannel';
import { RequestPasswordResetUseCase } from '../../../application/auth/RequestPasswordResetUseCase';
declare const sms: SmsRuOtpDeliveryChannel;
declare const email: EmailOtpDeliveryChannel;
declare const smsDestination: Extract<OtpDestination, { channel: 'sms' }>;
declare const emailDestination: Extract<OtpDestination, { channel: 'email' }>;
declare const resetDependencies: ConstructorParameters<
  typeof RequestPasswordResetUseCase
>[0];
sms.send(
  // @ts-expect-error SMS delivery cannot accept an email destination.
  emailDestination.identifier,
  code,
  'ru',
  ip,
  OtpPurposes.PHONE_CONFIRMATION
);
email.send(
  // @ts-expect-error Email delivery cannot accept an SMS destination.
  smsDestination.identifier,
  code,
  'ru',
  ip,
  OtpPurposes.EMAIL_CONFIRMATION
);
// @ts-expect-error Password-reset delivery requires an email transport.
new RequestPasswordResetUseCase({ ...resetDependencies, deliveryChannel: sms });

declare const mail: EmailSender;
mail.send({
  to: EmailAddress.create('voter@example.org'),
  subject: 'Notice',
  text: 'Message',
});
mail.send({
  // @ts-expect-error General email delivery requires a validated email address.
  to: 'unvalidated@example.org',
  subject: 'Notice',
  text: 'Message',
});
mail.send({
  // @ts-expect-error A telephone destination cannot receive email.
  to: smsDestination.identifier,
  subject: 'Notice',
  text: 'Message',
});

declare const captchaVerifier: CaptchaVerifier;
// @ts-expect-error CAPTCHA verification requires a decoded challenge, not raw boundary text.
captchaVerifier.verify('raw-token', 'not-an-ip');
captchaVerifier.verify(
  CaptchaChallenge.parse({ token: 'opaque-token', clientIp: '127.0.0.1' })
);
// @ts-expect-error The challenge record must carry a validated token.
captchaVerifier.verify({ token: 'raw-token', clientIp: ip });
captchaVerifier.verify({
  token: CaptchaToken.parse('opaque-token'),
  // @ts-expect-error Challenge network addresses must be validated too.
  clientIp: 'raw-ip',
});

// @ts-expect-error Generated passwords must satisfy the generator contract before use.
const rawPassword: ReturnType<PasswordGenerator['generate']> = 'arbitrary';
// @ts-expect-error Reset results must preserve the validated generated password.
const rawResetPassword: ResetUserPasswordResult['password'] = 'arbitrary';
