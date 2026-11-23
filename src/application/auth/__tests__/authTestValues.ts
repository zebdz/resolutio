/** Auth clients inject explicit deterministic entropy and a controllable clock.
 * Existing fake-timer tests keep controlling time through the injected clock. */
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';
import { SessionId } from '@/domain/shared/EntityIds';
import { OtpCode } from '@/domain/otp/OtpCode';
import { Nickname } from '@/domain/user/Nickname';
import { OtpCodeGenerator } from '../OtpCodeGenerator';
import { SessionTokenGenerator } from '../SessionTokenGenerator';
import { NicknameGenerator } from '../NicknameGenerator';

export function authTestNow(): Instant {
  return Instant.fromDate(new Date());
}

export function authTestDependencies() {
  let nextId = 1;
  let nextSession = 1;
  let nextNickname = 1;
  const clock: Clock = { now: authTestNow };
  const ids: IdGenerator = {
    generate: (identity) => identity.parse(`otp-${nextId++}`),
  };
  const otpCodeGenerator: OtpCodeGenerator = {
    generate: () => OtpCode.fromString('123456'),
  };
  const sessionTokenGenerator: SessionTokenGenerator = {
    generate: () =>
      SessionId.parse((nextSession++).toString(16).padStart(64, '0')),
  };
  const nicknameGenerator: NicknameGenerator = {
    generate: () =>
      Nickname.create(`user_${(nextNickname++).toString(16).padStart(8, '0')}`),
  };

  return {
    clock,
    ids,
    otpCodeGenerator,
    sessionTokenGenerator,
    nicknameGenerator,
  };
}
