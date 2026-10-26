/** Validated scalar values owned by the seal context. Brands distinguish meanings
 * without changing serialized bytes; factories reject untrusted inputs. */
import { z } from 'zod';
import { requireSeal } from './SealDomainCodes';
import { isoDate } from './Canonical';

function valueType<S extends z.ZodType>(schema: S) {
  return {
    schema,
    parse(input: unknown): z.output<S> {
      const parsed = schema.safeParse(input);
      requireSeal(parsed.success);

      return parsed.data;
    },
  };
}

// IDs are opaque ASCII tokens; ':' is reserved by the HMAC message format.
const id = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/);
const hex32 = z.string().regex(/^[0-9a-f]{64}$/);

export const QuestionId = valueType(id.brand<'QuestionId'>());
export type QuestionId = z.output<typeof QuestionId.schema>;
export const AnswerId = valueType(id.brand<'AnswerId'>());
export type AnswerId = z.output<typeof AnswerId.schema>;
export const ReceiptSecret = valueType(hex32.brand<'ReceiptSecret'>());
export type ReceiptSecret = z.output<typeof ReceiptSecret.schema>;
export const VoteSalt = valueType(hex32.brand<'VoteSalt'>());
export type VoteSalt = z.output<typeof VoteSalt.schema>;
export const PollId = valueType(id.brand<'PollId'>());
export type PollId = z.output<typeof PollId.schema>;
export const UserId = valueType(id.brand<'UserId'>());
export type UserId = z.output<typeof UserId.schema>;
export const OrganizationId = valueType(id.brand<'OrganizationId'>());
export type OrganizationId = z.output<typeof OrganizationId.schema>;
export const BoardId = valueType(id.brand<'BoardId'>());
export type BoardId = z.output<typeof BoardId.schema>;
export const PropertyId = valueType(id.brand<'PropertyId'>());
export type PropertyId = z.output<typeof PropertyId.schema>;
export const AssetId = valueType(id.brand<'AssetId'>());
export type AssetId = z.output<typeof AssetId.schema>;
export const AttachmentId = valueType(id.brand<'AttachmentId'>());
export type AttachmentId = z.output<typeof AttachmentId.schema>;
export const AnchorId = valueType(id.brand<'AnchorId'>());
export type AnchorId = z.output<typeof AnchorId.schema>;
export const HoldingSize = valueType(
  z
    .string()
    .regex(/^(0|[1-9][0-9]{0,8})\.[0-9]{6}$/)
    .brand<'HoldingSize'>()
);
export type HoldingSize = z.output<typeof HoldingSize.schema>;
export const OwnershipShare = valueType(
  z
    .string()
    .regex(/^(0\.[0-9]{8}|1\.00000000)$/)
    .refine((s) => s !== '0.00000000')
    .brand<'OwnershipShare'>()
);
export type OwnershipShare = z.output<typeof OwnershipShare.schema>;
export const BitcoinHeight = valueType(
  z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .brand<'BitcoinHeight'>()
);
export type BitcoinHeight = z.output<typeof BitcoinHeight.schema>;
export const AttemptCount = valueType(
  z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .brand<'AttemptCount'>()
);
export type AttemptCount = z.output<typeof AttemptCount.schema>;
export const AnchorFailureCode = valueType(
  z.string().min(1).brand<'AnchorFailureCode'>()
);
export type AnchorFailureCode = z.output<typeof AnchorFailureCode.schema>;
export const FencingToken = valueType(
  z.bigint().nonnegative().brand<'FencingToken'>()
);
export type FencingToken = z.output<typeof FencingToken.schema>;
// This establishes nonempty, owned bytes, not cryptographic authenticity.
export const AnchorProof = valueType(
  z
    .instanceof(Uint8Array)
    .refine((bytes) => bytes.length > 0)
    .transform((bytes) => Uint8Array.from(bytes))
    .brand<'AnchorProof'>()
);
export type AnchorProof = z.output<typeof AnchorProof.schema>;
export const Digest = valueType(hex32.brand<'Digest'>());
export type Digest = z.output<typeof Digest.schema>;
const timestamp = valueType(
  z
    .string()
    .refine((value) => {
      try {
        return isoDate(value) === value;
      } catch {
        return false;
      }
    })
    .brand<'UtcTimestamp'>()
);
export const UtcTimestamp = {
  ...timestamp,
  fromDate(value: Date) {
    return timestamp.parse(isoDate(value));
  },
};
export type UtcTimestamp = z.output<typeof UtcTimestamp.schema>;
