import { User } from './User';
import { PhoneNumber } from './PhoneNumber';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null>;
  findByNickname(nickname: string): Promise<User | null>;
  isNicknameAvailable(nickname: string): Promise<boolean>;
  save(user: User): Promise<User>;
  confirmUser(userId: string): Promise<void>;
  updatePrivacySettings(user: User): Promise<void>;
  exists(phoneNumber: PhoneNumber): Promise<boolean>;
  searchUsers(
    query: string,
    options?: { respectPrivacy?: boolean }
  ): Promise<User[]>;
  searchUserByPhone(phone: string): Promise<User | null>;
  isSuperAdmin(userId: string): Promise<boolean>;
  isUserBlocked(userId: string): Promise<boolean>;
  blockUser(
    userId: string,
    superadminId: string,
    reason: string
  ): Promise<void>;
  unblockUser(
    userId: string,
    superadminId: string,
    reason: string
  ): Promise<void>;
  getBlockStatus(
    userId: string
  ): Promise<{ blocked: boolean; reason?: string; blockedAt?: Date } | null>;
  getBlockedUserIds(): Promise<string[]>;
}
