import { User } from './User';
import { PhoneNumber } from './PhoneNumber';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null>;
  save(user: User): Promise<User>;
  exists(phoneNumber: PhoneNumber): Promise<boolean>;
  searchUsers(query: string): Promise<User[]>;
  isSuperAdmin(userId: string): Promise<boolean>;
}
