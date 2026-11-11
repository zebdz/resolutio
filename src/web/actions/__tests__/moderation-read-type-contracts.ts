/** Admin read clients retain valid block alternatives and validated timestamps/reasons. */
import type {
  AdminUserResult,
  SuspiciousKeySummary,
  SerializedAdminUserResult,
} from '../superadmin/suspiciousActivity';
type Search = NonNullable<AdminUserResult['blockStatus']>;
type Summary = NonNullable<SuspiciousKeySummary['blockStatus']>;
type List = NonNullable<SerializedAdminUserResult['blockStatus']>;
// @ts-expect-error Active search blocks require their timestamp.
const undatedSearch: Search = { blocked: true };
// @ts-expect-error Active summary blocks require their timestamp.
const undatedSummary: Summary = { blocked: true };
// @ts-expect-error Active list blocks require their timestamp.
const undatedList: List = { blocked: true };
// @ts-expect-error List timestamps require validated instants.
const invalidTime: List = { blocked: true, blockedAt: 'yesterday' };
const uncheckedReason: Search = {
  blocked: true,
  blockedAt: new Date(),
  // @ts-expect-error Historical reasons must retain their snapshot type.
  reason: '',
};
