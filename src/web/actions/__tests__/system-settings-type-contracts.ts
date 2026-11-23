/** Settings action clients distinguish configuration units without changing JSON numbers. */
import { getSystemSettingsAction } from '../superadmin/systemSettings';
import {
  ChecksPerHour,
  DailyTokenCap,
  MinimumOrganizationSize,
} from '@/domain/systemSetting/SystemSetting';
type Data = Extract<
  Awaited<ReturnType<typeof getSystemSettingsAction>>,
  { success: true }
>['data'];
// @ts-expect-error A token cap cannot substitute for checks per hour.
const tokensAsChecks: Data['legalCheckMaxPerAdminPerHour'] =
  DailyTokenCap.parse(100);
// @ts-expect-error Organization size cannot substitute for a daily token cap.
const membersAsTokens: Data['legalCheckDailyTokenCap'] =
  MinimumOrganizationSize.parse(3);
// @ts-expect-error Checks per hour cannot substitute for organization size.
const checksAsMembers: Data['legalCheckMinOrgSize'] = ChecksPerHour.parse(10);
