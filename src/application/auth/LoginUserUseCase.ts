import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { UnauthorizedError } from '@/domain/shared/errors';
import { Result, success, failure } from '@/domain/shared/Result';

export interface PasswordVerifier {
  verify(password: string, hash: string): Promise<boolean>;
}

export interface LoginUserInput {
  phoneNumber: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export const SESSION_TTL_MS = 1 * 24 * 60 * 60 * 1000; // 1 day
export const SUPERADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface LoginResult {
  user: User;
  session: Session;
  expiresInSeconds: number;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordVerifier: PasswordVerifier
  ) {}

  async execute(input: LoginUserInput): Promise<Result<LoginResult, Error>> {
    try {
      // Create phone number value object
      const phoneNumber = PhoneNumber.create(input.phoneNumber);

      // Find user by phone number
      const user = await this.userRepository.findByPhoneNumber(phoneNumber);

      if (!user) {
        return failure(
          new UnauthorizedError('Invalid phone number or password')
        );
      }

      // Verify password
      const isPasswordValid = await this.passwordVerifier.verify(
        input.password,
        user.password
      );

      if (!isPasswordValid) {
        return failure(
          new UnauthorizedError('Invalid phone number or password')
        );
      }

      // Superadmins get shorter session TTL
      const isSuperAdmin = await this.userRepository.isSuperAdmin(user.id);
      const ttlMs = isSuperAdmin ? SUPERADMIN_SESSION_TTL_MS : SESSION_TTL_MS;
      const expiresAt = new Date(Date.now() + ttlMs);

      const session = await this.sessionRepository.create(
        user.id,
        expiresAt,
        input.ipAddress,
        input.userAgent
      );

      return success({
        user,
        session,
        expiresInSeconds: Math.floor(ttlMs / 1000),
      });
    } catch (error) {
      return failure(error as Error);
    }
  }
}
