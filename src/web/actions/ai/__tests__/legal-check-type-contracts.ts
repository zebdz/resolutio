/** Compile-only analysis clients preserve validated snapshot references, units and time.
 * The complete production/test compiler checks these independently of provider or web I/O. */
import type { SerializedLegalCheck } from '../getLegalCheck';
import { OrganizationId, PollId } from '@/domain/shared/EntityIds';

// @ts-expect-error A legal analysis has its own identity, distinct from its poll.
const wrongCheckId: SerializedLegalCheck['id'] = PollId.parse('poll');
// @ts-expect-error The analysis's poll reference cannot become an organization reference.
const wrongCheckPoll: SerializedLegalCheck['pollId'] =
  OrganizationId.parse('org');
// @ts-expect-error The checking actor retains its user identity.
const wrongCheckActor: SerializedLegalCheck['checkedBy'] = PollId.parse('poll');
// @ts-expect-error Issue totals retain the validated legal issue unit.
const rawCheckIssues: SerializedLegalCheck['totalIssues'] = -1;
// @ts-expect-error Serialized checking times retain the validated canonical instant.
const invalidCheckTime: SerializedLegalCheck['checkedAt'] = 'yesterday';
