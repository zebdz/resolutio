/** Complete private record reader and explicit boundary mapping into the seal context.
 * All queries share the caller's repeatable-read snapshot, including historical holdings. */
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { PollRecordSnapshotReader } from '@/application/seal/PollRecordSnapshotReader';
import { PollId, OrganizationId, UtcTimestamp } from '@/domain/seal/SealValues';
import { SealPersistenceFailureCode as Failure } from '@/domain/seal/SealPersistenceFailureCode';
import { pollSchema, dateSchema } from '@/domain/seal/RecordFormat';
import { failure, success } from '@/domain/shared/Result';

const holdingInclude = {
  asset: { include: { property: true } },
} satisfies Prisma.PropertyAssetOwnershipInclude;
type StoredHolding = Prisma.PropertyAssetOwnershipGetPayload<{
  include: typeof holdingInclude;
}>;

export class PrismaPollRecordSnapshotReader implements PollRecordSnapshotReader {
  constructor(private readonly tx: Prisma.TransactionClient) {}
  async read(
    pollId: PollId,
    capturedAt: UtcTimestamp
  ): ReturnType<PollRecordSnapshotReader['read']> {
    const row = await this.tx.poll.findUnique({
      where: { id: pollId },
      include: {
        organization: { select: { name: true } },
        board: { select: { name: true } },
        properties: { select: { propertyId: true } },
        attachments: {
          select: { id: true, fileName: true, sizeBytes: true, mimeType: true },
        },
        questions: { include: { answers: true, votes: true } },
        participants: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                middleName: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return success(null);
    }

    const poll = pollSchema
      .extend({ finishedAt: dateSchema.nullable() })
      .safeParse({
        id: row.id,
        title: row.title,
        description: row.description,
        pollType: row.pollType,
        anonymous: row.anonymous,
        organizationId: row.organizationId,
        organizationName: row.organization.name,
        boardId: row.boardId,
        boardName: row.board?.name ?? null,
        metadataCapturedAt: capturedAt,
        startDate: row.startDate.toISOString(),
        endDate: row.endDate.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        distributionType: row.distributionType,
        propertyAggregation: row.propertyAggregation,
        weightCriteria: row.weightCriteria,
        propertyIds: row.properties.map((p) => p.propertyId),
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        questions: row.questions.map((q) => ({
          id: q.id,
          order: q.order,
          text: q.text,
          details: q.details,
          questionType: q.questionType,
          archivedAt: q.archivedAt?.toISOString() ?? null,
          answers: q.answers.map((a) => ({
            id: a.id,
            order: a.order,
            text: a.text,
            archivedAt: a.archivedAt?.toISOString() ?? null,
          })),
        })),
        attachments: row.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          size: a.sizeBytes,
          mimeType: a.mimeType,
        })),
      });

    if (!poll.success) {
      return failure(Failure.parse('domain.seal.inconsistentRecord'));
    }

    // The named protocol includes descendant organizations. UNION bounds cycles.
    const rawOrgs = await this.tx.$queryRaw<unknown>`WITH RECURSIVE tree AS (
      SELECT id FROM organizations WHERE id = ${row.organizationId}
      UNION SELECT o.id FROM organizations o JOIN tree t ON o.parent_id = t.id
    ) SELECT id FROM tree`;
    const orgs = z
      .array(z.object({ id: OrganizationId.schema }))
      .safeParse(rawOrgs);

    if (!orgs.success) {
      return failure(Failure.parse('domain.seal.inconsistentRecord'));
    }

    // Most participants share one weight snapshot: query once per snapshot,
    // rather than holding the transaction open for one query per participant.
    const bySnapshot = new Map<string, string[]>();

    for (const p of row.participants) {
      const key = p.snapshotAt.toISOString();
      const users = bySnapshot.get(key) ?? [];
      users.push(p.userId);
      bySnapshot.set(key, users);
    }

    const byUser = new Map<string, StoredHolding[]>();

    for (const [snapshotAt, userIds] of bySnapshot) {
      const holdings = await this.tx.propertyAssetOwnership.findMany({
        where: {
          userId: { in: userIds },
          effectiveFrom: { lte: new Date(snapshotAt) },
          OR: [
            { effectiveUntil: null },
            { effectiveUntil: { gt: new Date(snapshotAt) } },
          ],
          asset: {
            archivedAt: null,
            property: {
              archivedAt: null,
              organizationId: { in: orgs.data.map((o) => o.id) },
              ...(row.properties.length
                ? { id: { in: row.properties.map((v) => v.propertyId) } }
                : {}),
            },
          },
        },
        include: holdingInclude,
      });

      for (const holding of holdings) {
        if (holding.userId === null) {
          continue;
        }

        const items = byUser.get(holding.userId) ?? [];
        items.push(holding);
        byUser.set(holding.userId, items);
      }
    }

    const participants = row.participants.map((p) => {
      const holdings = byUser.get(p.userId) ?? [];

      return {
        userId: p.userId,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        middleName: p.user.middleName,
        weight: p.userWeight.toFixed(6),
        snapshotAt: p.snapshotAt.toISOString(),
        receiptSecret: p.receiptSecret,
        willingToSignProtocol: p.willingToSignProtocol,
        phoneNumber:
          p.willingToSignProtocol === true ? p.user.phoneNumber : null,
        holdings: holdings.map((h) => ({
          propertyId: h.asset.propertyId,
          propertyName: h.asset.property.name,
          assetId: h.asset.id,
          assetName: h.asset.name,
          size: h.asset.size.toFixed(6),
          sizeUnit: h.asset.property.sizeUnit,
          share: h.share.toFixed(8),
        })),
      };
    });

    return success({
      state: row.state,
      poll: poll.data,
      participants,
      votes: row.questions.flatMap((q) =>
        q.votes.map((v) => ({
          pollId: row.id,
          questionId: v.questionId,
          answerId: v.answerId,
          userId: v.userId,
          weight: v.userWeight.toFixed(6),
          castAt: v.createdAt.toISOString(),
        }))
      ),
    });
  }
}
