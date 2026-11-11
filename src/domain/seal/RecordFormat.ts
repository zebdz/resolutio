/** Version 1 codecs: raw DTOs are schema inputs; parsed outputs carry domain values.
 * Explicit serializers preserve committed field names, decimal strings and nulls. */
import { z } from 'zod';
import { rowWeightSchema, VotePreimageData } from './VoteLeaf';
import {
  AnswerId,
  QuestionId,
  PollId,
  UserId,
  OrganizationId,
  BoardId,
  PropertyId,
  AssetId,
  AttachmentId,
  Digest,
  UtcTimestamp,
  HoldingSize,
  OwnershipShare,
  RecordOrder,
  RecordByteCount,
  VoteCount,
  ParticipantCount,
  LeafCount,
  TotalWeight,
} from './SealValues';

export const hashSchema = Digest.schema;
export const dateSchema = UtcTimestamp.schema;
const answerSchema = z.strictObject({
  id: AnswerId.schema,
  order: RecordOrder.schema,
  text: z.string(),
  archivedAt: dateSchema.nullable(),
});
const questionSchema = z.strictObject({
  id: QuestionId.schema,
  order: RecordOrder.schema,
  text: z.string(),
  details: z.string().nullable(),
  questionType: z.enum(['single-choice', 'multiple-choice']),
  archivedAt: dateSchema.nullable(),
  answers: z.array(answerSchema),
});
export const pollSchema = z.strictObject({
  id: PollId.schema,
  title: z.string(),
  description: z.string(),
  pollType: z.enum(['ORGANIZATION', 'OPEN']),
  anonymous: z.boolean(),
  organizationId: OrganizationId.schema,
  organizationName: z.string(),
  boardId: BoardId.schema.nullable(),
  boardName: z.string().nullable(),
  metadataCapturedAt: dateSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  finishedAt: dateSchema,
  distributionType: z.enum([
    'EQUAL',
    'OWNERSHIP_UNIT_COUNT',
    'OWNERSHIP_SIZE_WEIGHTED',
  ]),
  propertyAggregation: z.enum(['RAW_SUM', 'NORMALIZE_PER_PROPERTY']),
  weightCriteria: z.string().nullable(),
  propertyIds: z.array(PropertyId.schema),
  createdBy: UserId.schema,
  createdAt: dateSchema,
  questions: z.array(questionSchema),
  attachments: z.array(
    z.strictObject({
      id: AttachmentId.schema,
      fileName: z.string(),
      size: RecordByteCount.schema,
      mimeType: z.string(),
    })
  ),
});
export const holdingSchema = z.strictObject({
  propertyId: PropertyId.schema,
  propertyName: z.string(),
  assetId: AssetId.schema,
  assetName: z.string(),
  size: HoldingSize.schema,
  sizeUnit: z.string(),
  share: OwnershipShare.schema,
});
const personFields = {
  userId: UserId.schema,
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
};
export const registerEntrySchema = z.strictObject({
  ...personFields,
  weight: rowWeightSchema,
  snapshotAt: dateSchema,
  voted: z.boolean(),
  holdings: z.array(holdingSchema),
});
export const signerSchema = z
  .discriminatedUnion('willingToSignProtocol', [
    z.strictObject({
      ...personFields,
      willingToSignProtocol: z.literal(false),
      phoneNumber: z.null(),
    }),
    // Historical willing voters may have no phone; preserve that explicit absence.
    z.strictObject({
      ...personFields,
      willingToSignProtocol: z.literal(true),
      phoneNumber: z.string().nullable(),
    }),
  ])
  .readonly();
export const talliesSchema = z.strictObject({
  questions: z.array(
    z.strictObject({
      questionId: QuestionId.schema,
      answers: z.array(
        z.strictObject({
          answerId: AnswerId.schema,
          voteCount: VoteCount.schema,
          totalWeight: TotalWeight.schema,
        })
      ),
      totalVotes: VoteCount.schema,
      totalWeight: TotalWeight.schema,
      participantWeight: TotalWeight.schema,
    })
  ),
  totalParticipants: ParticipantCount.schema,
  totalParticipantWeight: TotalWeight.schema,
});
export const manifestSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('sha256'),
  pollId: PollId.schema,
  sealedAt: dateSchema,
  sections: z.strictObject({
    poll: z.strictObject({ hash: hashSchema }),
    tallies: z.strictObject({ hash: hashSchema }),
    register: z.strictObject({ hash: hashSchema }),
    signers: z.strictObject({ hash: hashSchema }),
    votes: z.strictObject({ root: hashSchema, leafCount: LeafCount.schema }),
  }),
});
export type PollSection = z.infer<typeof pollSchema>;
export type PollSectionData = z.input<typeof pollSchema>;
export type RegisterEntry = z.infer<typeof registerEntrySchema>;
export type RegisterEntryData = z.input<typeof registerEntrySchema>;
export type SignerEntry = z.infer<typeof signerSchema>;
export type TalliesSection = z.infer<typeof talliesSchema>;
export type SealManifest = z.infer<typeof manifestSchema>;
export interface SealedVote {
  preimage: VotePreimageData;
  hash: string;
}

export function registerEntryData(entry: RegisterEntry): RegisterEntryData {
  return {
    userId: entry.userId,
    lastName: entry.lastName,
    firstName: entry.firstName,
    middleName: entry.middleName,
    weight: entry.weight.toDecimalString(),
    snapshotAt: entry.snapshotAt,
    voted: entry.voted,
    holdings: entry.holdings.map((holding) => ({
      propertyId: holding.propertyId,
      propertyName: holding.propertyName,
      assetId: holding.assetId,
      assetName: holding.assetName,
      size: holding.size,
      sizeUnit: holding.sizeUnit,
      share: holding.share,
    })),
  };
}

export interface SealedRecord {
  manifest: string;
  rootDigest: string;
  sections: {
    poll: string;
    tallies: string;
    register: string;
    signers: string;
  };
  votes: SealedVote[];
}
