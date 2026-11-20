/** Project published commitments and anchor status without reading private sections, proof bytes or operational data. */
import type { Prisma } from '@/generated/prisma/client';
import type { PollId } from '@/domain/shared/EntityIds';
import { BitcoinHeight, Digest, UtcTimestamp } from '@/domain/seal/SealValues';
import {
  publicAnchorStatus,
  type SealSummary,
} from '@/application/seal/SealSummary';
import { failure, success } from '@/domain/shared/Result';
import { z } from 'zod';
import { readManifest } from '@/domain/seal/RecordValidation';
import { hashText } from '@/domain/seal/Hash';
import { requireSeal, sealResult } from '@/domain/seal/SealDomainCodes';
import type { PollId as SealPollId } from '@/domain/seal/SealValues';

const provider = z.enum(['opentimestamps', 'stub']);
const summaryAnchor = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('CONFIRMED'),
    provider: z.literal('opentimestamps'),
    bitcoinHeight: BitcoinHeight.schema,
    bitcoinTime: z.date().transform(UtcTimestamp.fromDate),
  }),
  z.object({
    status: z.literal('SUBMITTED'),
    provider,
    bitcoinHeight: z.null(),
    bitcoinTime: z.null(),
  }),
  z.object({
    status: z.literal('FAILED'),
    provider,
    bitcoinHeight: z.null(),
    bitcoinTime: z.null(),
  }),
]);
const publicAnchorFields = {
  where: { status: { not: 'SUPERSEDED' } },
  take: 1,
  select: {
    status: true,
    provider: true,
    bitcoinHeight: true,
    bitcoinTime: true,
  },
} as const;

export async function readSealSummaries(
  seals: Pick<Prisma.TransactionClient['pollSeal'], 'findMany'>,
  pollIds: PollId[]
) {
  const summaries = new Map<string, SealSummary>();

  if (!pollIds.length) {
    return success(summaries);
  }

  const rows = await seals
    .findMany({
      where: { pollId: { in: pollIds } },
      select: {
        pollId: true,
        rootDigest: true,
        anchors: publicAnchorFields,
      },
    })
    .then(success, () => failure('common.errors.unexpected' as const));

  if (!rows.success) {
    return rows;
  }

  for (const row of rows.value) {
    const root = Digest.schema.safeParse(row.rootDigest);
    const anchor = summaryAnchor.nullable().safeParse(row.anchors[0] ?? null);

    if (!root.success || !anchor.success) {
      return failure('domain.seal.inconsistentRecord' as const);
    }

    summaries.set(row.pollId, {
      rootDigest: root.data,
      status: publicAnchorStatus(anchor.data),
    });
  }

  return success(summaries);
}

export async function readPublicSeal(
  seals: Pick<Prisma.TransactionClient['pollSeal'], 'findUnique'>,
  pollId: SealPollId
) {
  const loaded = await seals
    .findUnique({
      where: { pollId },
      select: {
        manifest: true,
        rootDigest: true,
        sealedAt: true,
        anchors: publicAnchorFields,
        _count: {
          select: {
            anchors: {
              where: {
                status: { not: 'SUPERSEDED' },
                pendingProof: { not: null },
              },
            },
          },
        },
      },
    })
    .then(success, () => failure('common.errors.unexpected' as const));

  if (!loaded.success) {
    return loaded;
  }

  const row = loaded.value;

  if (!row) {
    return failure('seal.errors.notFound' as const);
  }

  return sealResult(() => {
    const manifest = readManifest(row.manifest);
    const rootDigest = hashText(row.manifest);
    const anchor = summaryAnchor.nullable().safeParse(row.anchors[0] ?? null);
    requireSeal(
      anchor.success &&
        manifest.pollId === pollId &&
        rootDigest === row.rootDigest &&
        manifest.sealedAt === row.sealedAt.toISOString()
    );

    return {
      manifest: row.manifest,
      rootDigest,
      status: publicAnchorStatus(anchor.data),
      proofAvailable: row._count.anchors > 0,
    };
  });
}
