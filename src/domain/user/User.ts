/** User identity, credentials and privacy transitions remain deterministic.
 * Construction validates retained values for both rehydration and immutable updates. */
import { PhoneNumber } from './PhoneNumber';
import { z } from 'zod';
import { UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';
import { UserEmail, restoreUserEmail } from './UserEmail';
import {
  FirstName,
  LastName,
  MiddleName,
  PasswordHash,
  Language,
} from './UserValues';
import { Nickname } from './Nickname';
import { Address } from './Address';
import { EmailAddress } from './EmailAddress';
import { UserDomainCodes } from './UserDomainCodes';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';

export {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  NAME_REGEX,
  PASSWORD_MIN_LENGTH,
} from './UserValues';
export type { Language } from './UserValues';

export interface UserProps {
  readonly id: UserId;
  readonly firstName: FirstName;
  readonly lastName: LastName;
  readonly middleName?: MiddleName;
  readonly phoneNumber: PhoneNumber;
  readonly password: PasswordHash;
  readonly language: Language;
  readonly createdAt: Instant;
  readonly consentGivenAt?: Instant;
  readonly nickname: Nickname;
  readonly allowFindByName: boolean;
  readonly allowFindByPhone: boolean;
  readonly allowFindByAddress: boolean;
  readonly address?: Address;
  readonly privacySetupCompleted: boolean;
  readonly confirmedAt?: Instant;
  readonly emailState: UserEmail;
}

export interface CreateUserProps {
  readonly firstName: FirstName;
  readonly lastName: LastName;
  readonly middleName?: MiddleName;
  readonly phoneNumber: PhoneNumber;
  readonly password: PasswordHash;
  readonly language?: Language;
  readonly consentGivenAt?: Instant;
  readonly nickname: Nickname;
  readonly email?: EmailAddress;
}

/** Raw persistence boundary; only this input accepts unbranded stored scalars.
 * Existing databases require nickname, so absent nicknames are corrupt records. */
export interface RawUserProps {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: PhoneNumber;
  password: string;
  language: string;
  createdAt: string | Date;
  consentGivenAt?: string | Date;
  nickname: Nickname;
  allowFindByName?: boolean;
  allowFindByPhone?: boolean;
  allowFindByAddress?: boolean;
  address?: Address;
  privacySetupCompleted?: boolean;
  confirmedAt?: string | Date;
  email?: EmailAddress;
  emailConfirmedAt?: string | Date;
}

function storedInstant(value: string | Date): Instant {
  return value instanceof Date ? Instant.fromDate(value) : Instant.parse(value);
}

export interface PersonalInfoForPasswordCheck {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phoneNumber?: string;
  email?: string;
}

export function passwordMatchesPersonalInfo(
  password: string,
  info: PersonalInfoForPasswordCheck
): boolean {
  if (!password) {
    return false;
  }

  const lower = password.toLowerCase();
  const names = [info.firstName, info.lastName, info.middleName].filter(
    (n): n is string => !!n && n.trim().length > 0
  );

  for (const name of names) {
    if (lower === name.toLowerCase()) {
      return true;
    }
  }

  // The address and its local part, by equality — the same rule the names use.
  // The local part is the identity half: "ivan.petrov" is as bad a password as
  // the first name it is built from. The domain is deliberately NOT checked:
  // it is shared by millions and is nobody's personal information.
  if (info.email && info.email.trim().length > 0) {
    const email = info.email.trim().toLowerCase();

    if (lower === email) {
      return true;
    }

    const at = email.indexOf('@');

    if (at > 0 && lower === email.slice(0, at)) {
      return true;
    }
  }

  // Fuzzy phone match: users often copy-paste the phone number as password,
  // sometimes losing the "+" prefix. Reject if ≥90% of the phone's digits
  // appear as a consecutive substring in the password.
  // E.g. for "+79161234567" (11 digits), threshold = ceil(11*0.9) = 10,
  // so "7916123456" (10 consecutive digits) is rejected, "791612345" (9) is not.
  if (info.phoneNumber) {
    const phoneDigits = info.phoneNumber.replace(/\D/g, '');

    if (phoneDigits.length > 0) {
      const threshold = Math.ceil(phoneDigits.length * 0.9);

      // Check all consecutive substrings of length threshold..full
      for (let len = phoneDigits.length; len >= threshold; len--) {
        for (let start = 0; start <= phoneDigits.length - len; start++) {
          if (password.includes(phoneDigits.substring(start, start + len))) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export class User {
  private readonly props: Readonly<UserProps>;

  private constructor(props: UserProps) {
    if (!(props.phoneNumber instanceof PhoneNumber)) {
      throw new Error(UserDomainCodes.PHONE_NUMBER_INVALID);
    }

    if (!(props.nickname instanceof Nickname)) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    if (props.address !== undefined && !(props.address instanceof Address)) {
      throw new Error('common.errors.validationFailed');
    }

    this.props = Object.freeze({
      ...props,
      allowFindByName: z.boolean().parse(props.allowFindByName),
      allowFindByPhone: z.boolean().parse(props.allowFindByPhone),
      allowFindByAddress: z.boolean().parse(props.allowFindByAddress),
      privacySetupCompleted: z.boolean().parse(props.privacySetupCompleted),
      emailState: UserEmail.parse(props.emailState),
    });
  }

  static create(
    props: CreateUserProps,
    creation: EntityCreation<UserId>,
    profanityChecker?: ProfanityChecker
  ): User {
    User.checkNames(props, profanityChecker);

    return User.reconstitute({
      firstName: props.firstName,
      lastName: props.lastName,
      middleName: props.middleName,
      phoneNumber: props.phoneNumber,
      password: props.password,
      nickname: props.nickname,
      email: props.email,
      consentGivenAt: props.consentGivenAt,
      id: creation.id,
      createdAt: creation.now,
      // Russian remains the default registration language.
      language: props.language ?? 'ru',
      allowFindByName: false,
      allowFindByPhone: false,
      allowFindByAddress: false,
      privacySetupCompleted: false,
    });
  }

  static reconstitute(props: RawUserProps): User {
    if (!(props.nickname instanceof Nickname)) {
      throw new Error(UserDomainCodes.NICKNAME_INVALID);
    }

    return new User({
      id: UserId.parse(props.id),
      firstName: FirstName.parse(props.firstName),
      lastName: LastName.parse(props.lastName),
      // Old optional fields may contain an empty string; it represents absence.
      middleName: props.middleName
        ? MiddleName.parse(props.middleName)
        : undefined,
      password: PasswordHash.parse(props.password),
      phoneNumber: props.phoneNumber,
      nickname: props.nickname,
      address: props.address,
      language: Language.parse(props.language),
      createdAt: storedInstant(props.createdAt),
      consentGivenAt:
        props.consentGivenAt === undefined
          ? undefined
          : storedInstant(props.consentGivenAt),
      confirmedAt:
        props.confirmedAt === undefined
          ? undefined
          : storedInstant(props.confirmedAt),
      emailState: restoreUserEmail(
        props.email,
        props.emailConfirmedAt === undefined
          ? undefined
          : storedInstant(props.emailConfirmedAt)
      ),
      allowFindByName: props.allowFindByName ?? false,
      allowFindByPhone: props.allowFindByPhone ?? false,
      allowFindByAddress: props.allowFindByAddress ?? false,
      privacySetupCompleted: props.privacySetupCompleted ?? false,
    });
  }

  private static checkNames(
    props: Pick<UserProps, 'firstName' | 'lastName' | 'middleName'>,
    profanityChecker?: ProfanityChecker
  ): void {
    for (const name of [props.firstName, props.lastName, props.middleName]) {
      if (name && profanityChecker?.containsProfanity(name)) {
        throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    }
  }

  /** Update registration details without discarding independent privacy/address state. */
  updateRegistrationDetails(
    details: Omit<CreateUserProps, 'nickname' | 'consentGivenAt'>,
    now: Instant,
    profanityChecker?: ProfanityChecker
  ): User {
    User.checkNames(details, profanityChecker);

    return User.reconstitute({
      ...this.props,
      firstName: details.firstName,
      lastName: details.lastName,
      middleName: details.middleName,
      phoneNumber: details.phoneNumber,
      password: details.password,
      language: details.language ?? 'ru',
      consentGivenAt: now,
      // A supplied email starts unconfirmed; omission keeps the stored email.
      email: details.email ?? this.email,
      emailConfirmedAt: undefined,
    });
  }

  get id(): UserId {
    return this.props.id;
  }

  get firstName(): FirstName {
    return this.props.firstName;
  }

  get lastName(): LastName {
    return this.props.lastName;
  }

  get middleName(): MiddleName | undefined {
    return this.props.middleName;
  }

  get phoneNumber(): PhoneNumber {
    return this.props.phoneNumber;
  }

  get password(): PasswordHash {
    return this.props.password;
  }

  get language(): Language {
    return this.props.language;
  }

  get createdAt(): Instant {
    return this.props.createdAt;
  }

  get consentGivenAt(): Instant | undefined {
    return this.props.consentGivenAt;
  }

  get nickname(): Nickname {
    return this.props.nickname;
  }

  get allowFindByName(): boolean {
    return this.props.allowFindByName;
  }

  get allowFindByPhone(): boolean {
    return this.props.allowFindByPhone;
  }

  get allowFindByAddress(): boolean {
    return this.props.allowFindByAddress;
  }

  get address(): Address | undefined {
    return this.props.address;
  }

  get privacySetupCompleted(): boolean {
    return this.props.privacySetupCompleted;
  }

  get confirmedAt(): Instant | undefined {
    return this.props.confirmedAt;
  }

  isConfirmed(): boolean {
    return this.props.confirmedAt !== undefined;
  }

  confirm(now: Instant): User {
    return new User({
      ...this.props,
      confirmedAt: Instant.parse(now),
    });
  }

  get email(): EmailAddress | undefined {
    return this.props.emailState.kind === 'absent'
      ? undefined
      : this.props.emailState.address;
  }

  get emailConfirmedAt(): Instant | undefined {
    return this.props.emailState.kind === 'confirmed'
      ? this.props.emailState.confirmedAt
      : undefined;
  }

  get emailState(): UserEmail {
    return this.props.emailState;
  }

  hasConfirmedEmail(): boolean {
    return this.props.emailState.kind === 'confirmed';
  }

  /**
   * Set the address, always unconfirmed. Re-setting the same address also
   * clears confirmation: a new address must never inherit the previous one's
   * confirmed status, or changing to an attacker-controlled address would
   * yield an immediately reset-capable email.
   */
  changeEmail(email: EmailAddress): User {
    return new User({
      ...this.props,
      emailState: { kind: 'unconfirmed', address: email },
    });
  }

  confirmEmail(
    now: Instant
  ): Result<User, typeof UserDomainCodes.EMAIL_NOT_SET> {
    const current = this.props.emailState;

    if (current.kind === 'absent') {
      return failure(UserDomainCodes.EMAIL_NOT_SET);
    }

    return success(
      new User({
        ...this.props,
        emailState: {
          kind: 'confirmed',
          address: current.address,
          confirmedAt: Instant.parse(now),
        },
      })
    );
  }

  removeEmail(): User {
    return new User({
      ...this.props,
      emailState: { kind: 'absent' },
    });
  }

  getFullName(): string {
    return User.formatFullName(this.firstName, this.lastName, this.middleName);
  }

  /**
   * Format a full name in lastName firstName middleName order.
   * Usable without a User instance (e.g. from plain objects / DTOs).
   */
  static formatFullName(
    firstName: string,
    lastName: string,
    middleName?: string | null
  ): string {
    return [lastName, firstName, middleName].filter(Boolean).join(' ');
  }

  // Method to check if user can be authenticated
  canAuthenticate(): boolean {
    return !!this.password && !!this.phoneNumber;
  }

  // Update methods - return new instances to maintain immutability
  updateLanguage(language: Language): User {
    return new User({
      ...this.props,
      language: Language.parse(language),
    });
  }

  updateMiddleName(
    middleName: MiddleName | undefined,
    profanityChecker?: ProfanityChecker
  ): User {
    if (middleName && profanityChecker?.containsProfanity(middleName)) {
      throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return new User({
      ...this.props,
      middleName:
        middleName === undefined ? undefined : MiddleName.parse(middleName),
    });
  }

  updatePrivacySettings(settings: {
    allowFindByName?: boolean;
    allowFindByPhone?: boolean;
    allowFindByAddress?: boolean;
  }): User {
    return new User({
      ...this.props,
      allowFindByName: settings.allowFindByName ?? this.props.allowFindByName,
      allowFindByPhone:
        settings.allowFindByPhone ?? this.props.allowFindByPhone,
      allowFindByAddress:
        settings.allowFindByAddress ?? this.props.allowFindByAddress,
    });
  }

  /**
   * Replace the stored credential. Takes an already-hashed password —
   * hashing belongs to infrastructure, so the domain never sees the
   * plaintext.
   */
  changePassword(hashedPassword: PasswordHash): User {
    return new User({
      ...this.props,
      password: PasswordHash.parse(hashedPassword),
    });
  }

  updateNickname(nickname: Nickname): User {
    return new User({
      ...this.props,
      nickname,
    });
  }

  updateAddress(address: Address | undefined): User {
    return new User({
      ...this.props,
      address,
    });
  }

  completePrivacySetup(): User {
    return new User({
      ...this.props,
      privacySetupCompleted: true,
    });
  }
}
