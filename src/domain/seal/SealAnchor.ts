/** Anchor state variants and pure transitions owned by PollSeal. Boundary decoding
 * rejects impossible persisted combinations; transitions enforce timing and identity. */
import {
  AnchorProviderName,
  BitcoinAnchorEvidence,
  PendingAnchorEvidence,
} from './AnchorProvider';
import { z } from 'zod';
import { requireSeal, SealDomainCodes } from './SealDomainCodes';
import { exactKeys } from './Validation';
import {
  AnchorId,
  AnchorProof,
  AttemptCount,
  AnchorFailureCode,
  BitcoinHeight,
  Digest,
  UtcTimestamp,
} from './SealValues';

const baseFields = {
  id: AnchorId.schema,
  provider: z.enum(['opentimestamps', 'stub']),
  attempts: AttemptCount.schema,
  createdAt: UtcTimestamp.schema,
};
const unconfirmedFields = {
  confirmedProof: z.null(),
  bitcoinHeight: z.null(),
  bitcoinTime: z.null(),
  confirmedAt: z.null(),
};
const submittedFields = {
  pendingProof: AnchorProof.schema,
  submittedAt: UtcTimestamp.schema,
};
const failedFields = {
  ...baseFields,
  ...unconfirmedFields,
  status: z.literal('FAILED'),
  lastError: AnchorFailureCode.schema,
  nextAttemptAt: UtcTimestamp.schema,
};
const submittedSchema = z.strictObject({
  ...baseFields,
  ...unconfirmedFields,
  ...submittedFields,
  status: z.literal('SUBMITTED'),
  lastError: AnchorFailureCode.schema.nullable(),
  nextAttemptAt: UtcTimestamp.schema,
});
const confirmedSchema = z.strictObject({
  ...baseFields,
  ...submittedFields,
  provider: z.literal('opentimestamps'),
  status: z.literal('CONFIRMED'),
  confirmedProof: AnchorProof.schema,
  bitcoinHeight: BitcoinHeight.schema,
  bitcoinTime: UtcTimestamp.schema,
  confirmedAt: UtcTimestamp.schema,
  lastError: z.null(),
  nextAttemptAt: z.null(),
});
const supersededSchema = z.strictObject({
  ...baseFields,
  ...unconfirmedFields,
  ...submittedFields,
  status: z.literal('SUPERSEDED'),
  lastError: AnchorFailureCode.schema.nullable(),
  nextAttemptAt: z.null(),
});
const failedSchema = z.union([
  z.strictObject({
    ...failedFields,
    pendingProof: z.null(),
    submittedAt: z.null(),
  }),
  z.strictObject({ ...failedFields, ...submittedFields }),
]);
const anchorSchema = z
  .union([submittedSchema, confirmedSchema, supersededSchema, failedSchema])
  .readonly();
export type SealAnchor = z.output<typeof anchorSchema>;
export type SubmittedAnchor = Extract<SealAnchor, { status: 'SUBMITTED' }>;
export type FailedAnchor = Extract<SealAnchor, { status: 'FAILED' }>;
export type ConfirmedAnchor = Extract<SealAnchor, { status: 'CONFIRMED' }>;
export type SupersededAnchor = Extract<SealAnchor, { status: 'SUPERSEDED' }>;
export type SealAnchorData = z.input<typeof anchorSchema>;

export interface AnchorAttempt {
  readonly id: AnchorId;
  readonly provider: AnchorProviderName;
  readonly at: UtcTimestamp;
}
export interface AnchorSubmission extends AnchorAttempt {
  readonly evidence: PendingAnchorEvidence;
}
export interface AnchorFailure extends AnchorAttempt {
  readonly error: AnchorFailureCode;
}
const illegal = SealDomainCodes.SEAL_ANCHOR_ILLEGAL_TRANSITION;
const unconfirmed = {
  confirmedProof: null,
  bitcoinHeight: null,
  bitcoinTime: null,
  confirmedAt: null,
};

function afterMinutes(at: UtcTimestamp, minutes: number): UtcTimestamp {
  return UtcTimestamp.fromDate(new Date(Date.parse(at) + minutes * 60000));
}

function attempt(previous: SealAnchor | null, command: AnchorAttempt) {
  if (previous) {
    requireSeal(
      previous.id === command.id &&
        previous.provider === command.provider &&
        previous.status === 'FAILED',
      illegal
    );
    requireSeal(command.at >= previous.nextAttemptAt, illegal);

    return {
      id: previous.id,
      provider: previous.provider,
      createdAt: previous.createdAt,
      attempts: AttemptCount.parse(previous.attempts + 1),
    };
  }

  return {
    id: command.id,
    provider: command.provider,
    createdAt: command.at,
    attempts: AttemptCount.parse(1),
  };
}

export function failedAnchor(
  previous: SealAnchor | null,
  command: AnchorFailure
): FailedAnchor {
  const base = attempt(previous, command);
  const minutes = [5, 15, 60, 360, 1440][Math.min(base.attempts - 1, 4)];
  // Preserve a previously accepted submission when rehydrating a failed attempt.
  const submission =
    previous?.pendingProof != null
      ? {
          pendingProof: previous.pendingProof,
          submittedAt: previous.submittedAt,
        }
      : { pendingProof: null, submittedAt: null };

  return {
    ...base,
    ...unconfirmed,
    ...submission,
    status: 'FAILED',
    lastError: command.error,
    nextAttemptAt: afterMinutes(command.at, minutes),
  };
}

function pendingProof(
  evidence: PendingAnchorEvidence,
  provider: AnchorProviderName,
  rootDigest: Digest
): AnchorProof {
  requireSeal(
    evidence.rootDigest === rootDigest &&
      evidence.kind ===
        (provider === 'opentimestamps' ? 'pending' : 'simulated'),
    SealDomainCodes.SEAL_INVALID_PROOF
  );
  requireSeal(
    evidence.proof instanceof Uint8Array && evidence.proof.length > 0,
    SealDomainCodes.SEAL_INVALID_PROOF
  );

  return AnchorProof.parse(evidence.proof);
}

export function submittedAnchor(
  previous: SealAnchor | null,
  command: AnchorSubmission,
  rootDigest: Digest
): SubmittedAnchor {
  const base = attempt(previous, command);

  return {
    ...base,
    ...unconfirmed,
    status: 'SUBMITTED',
    pendingProof: pendingProof(command.evidence, command.provider, rootDigest),
    submittedAt: command.at,
    lastError: null,
    nextAttemptAt: afterMinutes(command.at, 10),
  };
}

export function confirmedAnchor(
  previous: SealAnchor | null,
  evidence: BitcoinAnchorEvidence,
  at: UtcTimestamp,
  rootDigest: Digest
): ConfirmedAnchor {
  requireSeal(
    previous?.status === 'SUBMITTED' && previous.provider === 'opentimestamps',
    illegal
  );
  exactKeys(evidence, [
    'kind',
    'rootDigest',
    'proof',
    'bitcoinHeight',
    'bitcoinTime',
  ]);
  requireSeal(
    evidence.kind === 'bitcoin' && evidence.rootDigest === rootDigest,
    SealDomainCodes.SEAL_INVALID_PROOF
  );
  requireSeal(
    evidence.proof instanceof Uint8Array && evidence.proof.length > 0,
    SealDomainCodes.SEAL_INVALID_PROOF
  );
  requireSeal(
    Number.isSafeInteger(evidence.bitcoinHeight) && evidence.bitcoinHeight > 0,
    SealDomainCodes.SEAL_INVALID_PROOF
  );
  requireSeal(at >= previous.submittedAt, illegal);

  return {
    ...previous,
    status: 'CONFIRMED',
    provider: 'opentimestamps',
    confirmedProof: AnchorProof.parse(evidence.proof),
    bitcoinHeight: evidence.bitcoinHeight,
    bitcoinTime: UtcTimestamp.parse(evidence.bitcoinTime),
    confirmedAt: at,
    nextAttemptAt: null,
    lastError: null,
  };
}

export function supersededAnchor(
  previous: SealAnchor | null,
  at: UtcTimestamp
): SupersededAnchor {
  requireSeal(previous?.status === 'SUBMITTED', illegal);
  requireSeal(
    Date.parse(at) - Date.parse(previous.submittedAt) > 3 * 24 * 60 * 60000,
    illegal
  );

  return { ...previous, status: 'SUPERSEDED', nextAttemptAt: null };
}

/** Persisted data is untrusted even when produced by an earlier domain version. */
export function parseAnchor(
  value: unknown,
  sealedAt: UtcTimestamp
): SealAnchor {
  const parsed = anchorSchema.safeParse(value);
  requireSeal(parsed.success);
  validateAnchor(parsed.data, sealedAt);

  return parsed.data;
}

/** Cross-field time relationships remain runtime invariants on valid state variants. */
export function validateAnchor(
  anchor: SealAnchor,
  sealedAt: UtcTimestamp
): void {
  requireSeal(anchor.createdAt >= sealedAt);

  if (anchor.submittedAt !== null) {
    requireSeal(anchor.submittedAt >= anchor.createdAt);
  }

  switch (anchor.status) {
    case 'CONFIRMED':
      requireSeal(anchor.confirmedAt >= anchor.submittedAt);
      break;
    case 'SUBMITTED':
    case 'FAILED':
      requireSeal(
        anchor.nextAttemptAt > (anchor.submittedAt ?? anchor.createdAt)
      );
      break;
    case 'SUPERSEDED':
      break;

    default: {
      const exhaustive: never = anchor;

      return exhaustive;
    }
  }
}

export function refreshedAnchor(
  previous: SealAnchor | null,
  evidence: PendingAnchorEvidence,
  at: UtcTimestamp,
  rootDigest: Digest
): SubmittedAnchor {
  requireSeal(
    previous?.status === 'SUBMITTED' && at >= previous.nextAttemptAt,
    illegal
  );

  return {
    ...previous,
    pendingProof: pendingProof(evidence, previous.provider, rootDigest),
    lastError: null,
    nextAttemptAt: afterMinutes(at, 10),
  };
}
