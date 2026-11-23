/** Validate organization membership voting changes and audit-history queries.
 * The store checks the acting administrator and commits each change with its reason. */
import { z } from 'zod';
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { failure, type Result } from '@/domain/shared/Result';

const member = z.object({
  organizationId: OrganizationId,
  memberId: UserId,
  eligible: z.boolean(),
});
const reason = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<'VotingEligibilityReason'>();
export const EligibilityChangeId = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((v) => v.length < 19 || v <= '9223372036854775807')
  .brand<'EligibilityChangeId'>();
type EligibilityChangeId = z.infer<typeof EligibilityChangeId>;
const historyQuery = z.object({
  organizationId: OrganizationId,
  before: EligibilityChangeId.optional(),
});
export type EligibilityChange = z.output<typeof member> & {
  reason: z.output<typeof reason>;
};
export type EligibilityHistoryQuery = z.output<typeof historyQuery>;
export type ChangeFailure =
  | 'organization.errors.notAdmin'
  | 'organization.errors.notMember'
  | 'organization.errors.archived';
export type HistoryEntry = {
  id: EligibilityChangeId;
  memberName: string;
  memberNickname: string;
  actorName: string;
  actorNickname: string;
  wasEligible: boolean;
  eligible: boolean;
  reason: string;
  changedAt: string;
};
export interface VotingEligibilityStore {
  change(
    actor: UserId,
    change: EligibilityChange
  ): Promise<Result<void, ChangeFailure>>;
  history(
    actor: UserId,
    query: EligibilityHistoryQuery
  ): Promise<
    Result<
      { entries: HistoryEntry[]; next: EligibilityChangeId | null },
      ChangeFailure
    >
  >;
}

export class VotingEligibility {
  constructor(private readonly store: VotingEligibilityStore) {}

  async change(
    actor: UserId,
    input: {
      organizationId: string;
      memberId: string;
      eligible: boolean;
      reason: string;
    }
  ) {
    const target = member.safeParse(input);

    if (!target.success) {
      return failure('common.errors.validationFailed' as const);
    }

    const note = reason.safeParse(input.reason);

    if (!note.success) {
      return failure('organization.eligibility.invalidReason' as const);
    }

    return this.store.change(actor, { ...target.data, reason: note.data });
  }

  async history(
    actor: UserId,
    input: { organizationId: string; before?: string }
  ) {
    const query = historyQuery.safeParse(input);

    if (!query.success) {
      return failure('common.errors.validationFailed' as const);
    }

    return this.store.history(actor, query.data);
  }
}
