import { User } from './User';
import { PhoneNumber } from './PhoneNumber';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null>;
  save(user: User): Promise<User>;
  exists(phoneNumber: PhoneNumber): Promise<boolean>;
}
