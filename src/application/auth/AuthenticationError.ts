/** Authentication failures are stable localized codes, never adapter error text. */
import { UserDomainCode } from '@/domain/user/UserDomainCodes';
import { SharedDomainCode } from '@/domain/shared/SharedDomainCodes';
import { AuthError } from './AuthErrors';
import { OtpError } from './OtpErrors';

export type AuthenticationError =
  | AuthError
  | OtpError
  | UserDomainCode
  | SharedDomainCode;
