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
}

export interface LoginResult {
  user: User;
  session: Session;
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

      // Create session (expires in 30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session = await this.sessionRepository.create(user.id, expiresAt);

      return success({ user, session });
    } catch (error) {
      return failure(error as Error);
    }
  }
}
