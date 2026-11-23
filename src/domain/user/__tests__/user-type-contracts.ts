/** Compile-only clients keep persisted identity, names, credentials and time distinct. */
import { User, UserProps } from '../User';
import { UserEmail } from '../UserEmail';
import { EmailAddress } from '../EmailAddress';

// @ts-expect-error Confirmation requires an address and confirmation instant together.
const incompleteEmail: UserEmail = { kind: 'confirmed' };
const absentWithAddress: UserEmail = {
  kind: 'absent',
  // @ts-expect-error An absent email cannot carry an address.
  address: EmailAddress.create('user@example.com'),
};
const unconfirmedWithTime: UserEmail = {
  kind: 'unconfirmed',
  address: EmailAddress.create('user@example.com'),
  // @ts-expect-error Unconfirmed state cannot carry a confirmation timestamp.
  confirmedAt: '2026-01-01T00:00:00.000Z',
};
import {
  FirstName,
  LastName,
  MiddleName,
  PasswordHash,
  PlaintextPassword,
  GeneratedPassword,
} from '../UserValues';
import { Instant } from '../../shared/Instant';
import { PollId, UserId } from '../../shared/EntityIds';
import { PhoneNumber } from '../PhoneNumber';
import { Nickname } from '../Nickname';

const creation = {
  id: UserId.parse('user-1'),
  now: Instant.parse('2026-10-26T10:30:00.123Z'),
};
const props = {
  firstName: FirstName.parse('John'),
  lastName: LastName.parse('Doe'),
  phoneNumber: PhoneNumber.create('+79161234567'),
  password: PasswordHash.parse('opaque-supported-hash'),
  nickname: Nickname.create('john_doe'),
};
const user = User.create(props, creation);
const id: UserId = user.id;
const createdAt: Instant = user.createdAt;
const firstName: FirstName = user.firstName;
const passwordHash: PasswordHash = user.password;

// @ts-expect-error A poll identity cannot identify a user.
User.create(props, { ...creation, id: PollId.parse('poll-1') });
// @ts-expect-error Aggregate creation must receive an identity and instant.
User.create(props);
// @ts-expect-error A raw name has not passed the existing name constraints.
User.create({ ...props, firstName: 'John' }, creation);
// @ts-expect-error Plaintext strings cannot replace a persisted credential.
user.changePassword('plaintext');
// @ts-expect-error Mutable Dates cannot enter aggregate state.
user.confirm(new Date());
// @ts-expect-error Confirmation requires supplied time, not a domain wall clock.
user.confirm();
// @ts-expect-error Name roles are not interchangeable.
user.updateMiddleName(FirstName.parse('John'));
// @ts-expect-error User props require a validated identity.
const rawId: UserProps['id'] = 'raw-user';

import { Address } from '../Address';
declare const address: Address;
// @ts-expect-error Country and city names have different domain meanings.
const swappedAddressPart: typeof address.city = address.country;
// @ts-expect-error Apartment values must pass the address constraint.
const uncheckedApartment: NonNullable<typeof address.apartment> = '12';
// @ts-expect-error House and flat registry identifiers are distinct.
const swappedFiasId: typeof address.flatFiasId = address.houseFiasId;
import {
  AddressSuggestion,
  FlatSuggestion,
} from '@/infrastructure/address/types';
import { HouseFiasId, FlatFiasId } from '../AddressValues';
declare const houseFiasId: HouseFiasId;
declare const flatFiasId: FlatFiasId;
// @ts-expect-error Provider house references must retain their validated identity type.
const rawHouseSuggestion: AddressSuggestion['houseFiasId'] = 'raw';
// @ts-expect-error A flat reference cannot identify a house suggestion.
const flatAsSuggestedHouse: AddressSuggestion['houseFiasId'] = flatFiasId;
// @ts-expect-error A house reference cannot identify a suggested flat.
const houseAsSuggestedFlat: FlatSuggestion['flatFiasId'] = houseFiasId;

// Hashing ports must never accept stored hashes as if they were entered credentials.
import { PasswordHasher } from '@/application/auth/RegisterUserUseCase';
import { PasswordVerifier } from '@/application/auth/LoginUserUseCase';
import { Argon2PasswordHasher } from '@/infrastructure/auth/Argon2PasswordHasher';
import { Argon2PasswordVerifier } from '@/infrastructure/auth/Argon2PasswordVerifier';
declare const hasher: PasswordHasher;
declare const verifier: PasswordVerifier;
declare const adapterHasher: Argon2PasswordHasher;
declare const adapterVerifier: Argon2PasswordVerifier;
// @ts-expect-error Rehashing a stored credential is not hashing a plaintext password.
hasher.hash(passwordHash);
// @ts-expect-error A stored hash is not an entered credential.
verifier.verify(passwordHash, passwordHash);
// @ts-expect-error The concrete adapter preserves the port's credential contract.
adapterHasher.hash(passwordHash);
// @ts-expect-error The concrete verifier preserves the port's credential contract.
adapterVerifier.verify(passwordHash, passwordHash);

declare const plaintext: PlaintextPassword;
declare const generated: GeneratedPassword;
hasher.hash(plaintext);
hasher.hash(generated);
verifier.verify(plaintext, passwordHash);
// @ts-expect-error Plaintext must not be persisted as a hash.
user.changePassword(plaintext);
// @ts-expect-error Entered passwords do not prove generated-password composition.
const enteredAsGenerated: GeneratedPassword = plaintext;
