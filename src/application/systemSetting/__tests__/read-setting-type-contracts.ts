/** Application clients handle failures before accessing key-specific setting units. */
import type { readSystemSetting } from '../readSystemSetting';
import {
  DailyTokenCap,
  MinimumOrganizationSize,
  ChecksPerHour,
} from '@/domain/systemSetting/SystemSetting';
type Hourly = Awaited<
  ReturnType<typeof readSystemSetting<'legal_check_max_per_admin_per_hour'>>
>;
type Daily = Awaited<
  ReturnType<typeof readSystemSetting<'legal_check_daily_token_cap'>>
>;
type Minimum = Awaited<
  ReturnType<typeof readSystemSetting<'legal_check_min_org_size'>>
>;
type Value<R> =
  Extract<R, { success: true }> extends { value: infer S } ? S : never;
// @ts-expect-error Hourly settings cannot contain a token-cap value.
const tokensAsChecks: Value<Hourly>['value'] = DailyTokenCap.parse(10);
// @ts-expect-error Daily settings cannot contain a member threshold.
const membersAsTokens: Value<Daily>['value'] = MinimumOrganizationSize.parse(3);
// @ts-expect-error Organization thresholds cannot contain hourly check counts.
const checksAsMembers: Value<Minimum>['value'] = ChecksPerHour.parse(10);
declare const unresolved: Hourly;
// @ts-expect-error Expected failures must be handled before reading settings.
const unchecked = unresolved.value;
