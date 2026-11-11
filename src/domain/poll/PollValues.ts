/** Validated poll values and shared entity-reference identities. Legacy/database
 * inputs are parsed at boundaries; seal-format identity types remain separate. */
import { z } from 'zod';

export {
  PollId,
  UserId,
  QuestionId,
  AnswerId,
  ParticipantId,
} from '../shared/EntityIds';

export const PollInstant = z.iso
  .datetime({ precision: 3 })
  .refine((value) => {
    const date = new Date(value);

    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  })
  .brand<'PollInstant'>();
export type PollInstant = z.infer<typeof PollInstant>;

export const BallotWeight = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,8})\.[0-9]{6}$/)
  .brand<'BallotWeight'>();
export type BallotWeight = z.infer<typeof BallotWeight>;
export const EQUAL_BALLOT_WEIGHT = BallotWeight.parse('1.000000');
