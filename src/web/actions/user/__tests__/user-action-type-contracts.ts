/** Action clients retain validated identities, OTP units and generated-credential meaning.
 * Negative assignments fail if an explicit response annotation erases those distinctions. */
import { searchUserByPhoneAction } from '../user';
import { updateEmailAction, requestEmailConfirmationAction } from '../email';
import { resetUserPasswordAction } from '../../superadmin/userPassword';
import { resetUserOtpAction } from '../../superadmin/userOtp';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { Minutes } from '@/domain/auth/AuthValues';
import { PasswordHash } from '@/domain/user/UserValues';
import { ResultCount } from '@/domain/shared/Pagination';

type Data<Result> =
  Extract<Awaited<Result>, { success: true }> extends { data: infer View }
    ? View
    : never;
type PhoneMatch = NonNullable<Data<ReturnType<typeof searchUserByPhoneAction>>>;
type UpdatedEmail = Data<ReturnType<typeof updateEmailAction>>;
type RequestedEmail = Data<ReturnType<typeof requestEmailConfirmationAction>>;
type ResetPassword = Data<ReturnType<typeof resetUserPasswordAction>>;
type ResetOtp = Data<ReturnType<typeof resetUserOtpAction>>;

// @ts-expect-error A phone match identifies a user, not an organization.
const orgAsPhoneMatch: PhoneMatch['id'] = OrganizationId.parse('org-1');
// @ts-expect-error Entered plaintext and stored hashes must not become generated credentials.
const hashAsGenerated: ResetPassword['password'] =
  PasswordHash.parse('stored-hash');
// @ts-expect-error A generic result count is not a count of removed OTPs.
const resultCountAsOtp: ResetOtp['deleted'] = ResultCount.parse(3);
// @ts-expect-error Email retry intervals are seconds, not minutes.
const minutesAsUpdatedRetry: UpdatedEmail['retryAfterSeconds'] =
  Minutes.parse(2);
// @ts-expect-error Confirmation requests retain the same seconds unit.
const minutesAsRequestedRetry: RequestedEmail['retryAfterSeconds'] =
  Minutes.parse(2);
