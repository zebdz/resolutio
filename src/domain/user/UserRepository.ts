/** User persistence retains validated identities and contact values.
 * Moderation belongs to its checked port; partial discovery queries retain raw search text. */
import { UserId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { Nickname } from './Nickname';
import { User } from './User';
import { PhoneNumber } from './PhoneNumber';
import { EmailAddress } from './EmailAddress';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByIds(ids: UserId[]): Promise<User[]>;
  findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null>;
  findByEmail(email: EmailAddress): Promise<User | null>;
  findByNickname(nickname: Nickname): Promise<User | null>;
  isNicknameAvailable(nickname: Nickname): Promise<boolean>;
  save(user: User): Promise<User>;
  confirmUser(userId: UserId, now: Instant): Promise<void>;
  updatePrivacySettings(user: User): Promise<void>;
  deleteAddress(userId: UserId): Promise<void>;
  exists(phoneNumber: PhoneNumber): Promise<boolean>;
  searchUsers(
    query: string,
    options?: { respectPrivacy?: boolean; city?: string; street?: string }
  ): Promise<User[]>;
  searchUserByPhone(phone: PhoneNumber): Promise<User | null>;
  isSuperAdmin(userId: UserId): Promise<boolean>;
}
