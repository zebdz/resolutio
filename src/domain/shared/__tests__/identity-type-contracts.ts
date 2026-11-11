/** Compile-only clients prove brands and complete creation inputs cannot be bypassed.
 * Unused @ts-expect-error directives fail when the public contract becomes weaker. */
import { z } from 'zod';
import { UserId, PollId } from '../EntityIds';
import * as applicationIdentities from '../EntityIds';
import * as sealValues from '../../seal/SealValues';
import { AIModelKey, ProviderModelId } from '../../ai/LegalAnalysis';
import { HouseFiasId, FlatFiasId } from '../../user/AddressValues';
import { UserBlockEntryId } from '../../user/UserModeration';
import { Instant } from '../Instant';
import {
  Clock,
  EntityCreation,
  IdGenerator,
  entityCreation,
} from '../../../application/shared/EntityCreation';

// Check every pair, including same-named identities across bounded contexts.
type ApplicationIdentities = {
  [Key in keyof typeof applicationIdentities as `application.${Key}`]: z.output<
    (typeof applicationIdentities)[Key]
  >;
};
type SealIdentityName =
  | 'QuestionId'
  | 'AnswerId'
  | 'PollId'
  | 'UserId'
  | 'OrganizationId'
  | 'BoardId'
  | 'PropertyId'
  | 'AssetId'
  | 'AttachmentId'
  | 'AnchorId';
type SealIdentities = {
  [Key in SealIdentityName as `seal.${Key}`]: z.output<
    (typeof sealValues)[Key]['schema']
  >;
};
type Identities = ApplicationIdentities &
  SealIdentities & {
    'ai.modelKey': AIModelKey;
    'ai.providerModelId': ProviderModelId;
    'address.houseFiasId': HouseFiasId;
    'address.flatFiasId': FlatFiasId;
    'user.blockEntryId': UserBlockEntryId;
  };
type InterchangeablePairs = {
  [Target in keyof Identities]: {
    [Source in Exclude<
      keyof Identities,
      Target
    >]: Identities[Source] extends Identities[Target]
      ? `${Source} -> ${Target}`
      : never;
  }[Exclude<keyof Identities, Target>];
}[keyof Identities];
type UnvalidatedIdentities = {
  [Key in keyof Identities]: string extends Identities[Key] ? Key : never;
}[keyof Identities];
type AssertNever<Value extends never> = Value;
type DistinctIdentityContracts = AssertNever<InterchangeablePairs>;
type ValidatedIdentityContracts = AssertNever<UnvalidatedIdentities>;

declare const ids: IdGenerator;
declare const clock: Clock;
const userId: UserId = ids.generate(UserId);
const pollId: PollId = ids.generate(PollId);
const creation: EntityCreation<UserId> = entityCreation(UserId, ids, clock);
Instant.toDate(creation.now);

// @ts-expect-error Raw strings have not been validated as entity identities.
const rawUserId: UserId = 'raw_user';
// @ts-expect-error A poll identity cannot replace a user identity.
const mixedId: UserId = pollId;
// @ts-expect-error The generator preserves the requested brand.
const generatedWrongId: PollId = ids.generate(UserId);
// @ts-expect-error Explicit identity is required before aggregate creation.
const missingId: EntityCreation<UserId> = { now: clock.now() };
// @ts-expect-error Explicit time is required before aggregate creation.
const missingTime: EntityCreation<UserId> = { id: userId };
const rawTime: EntityCreation<UserId> = {
  id: userId,
  // @ts-expect-error A raw timestamp has not been validated as an instant.
  now: '2026-10-26T10:00:00.123Z',
};
// @ts-expect-error Application clocks supply validated immutable instants, not mutable Dates.
const badClock: Clock = { now: () => new Date() };
// @ts-expect-error A raw string must be parsed before Date conversion.
Instant.toDate('2026-10-26T10:00:00.123Z');
// @ts-expect-error A creation identity remains immutable.
creation.id = userId;
// @ts-expect-error A creation timestamp remains immutable.
creation.now = clock.now();

// Search totals must not accept a page size merely because both are numbers.
import { PollRepository } from '../../poll/PollRepository';
import { OrganizationRepository } from '../../organization/OrganizationRepository';
import { JoinTokenRepository } from '../../organization/JoinTokenRepository';
import { PageSize, ResultCount } from '../Pagination';
type PollSearch = Extract<
  Awaited<ReturnType<PollRepository['searchPolls']>>,
  { success: true }
>['value'];
type OrganizationSearch = Awaited<
  ReturnType<OrganizationRepository['searchOrganizationsWithStats']>
>;
type JoinTokenSearch = Awaited<
  ReturnType<JoinTokenRepository['findByOrganizationId']>
>;
declare const pollSearch: PollSearch;
declare const organizationSearch: OrganizationSearch;
declare const joinTokenSearch: JoinTokenSearch;
const pollTotal: ResultCount = pollSearch.totalCount;
const organizationTotal: ResultCount = organizationSearch.totalCount;
const joinTokenTotal: ResultCount = joinTokenSearch.totalCount;
// @ts-expect-error A page size cannot substitute for a poll search total.
const wrongPollTotal: PollSearch['totalCount'] = PageSize.parse(10);
// @ts-expect-error A page size cannot substitute for an organization search total.
const wrongOrganizationTotal: OrganizationSearch['totalCount'] =
  PageSize.parse(10);
// @ts-expect-error A page size cannot substitute for a join-link search total.
const wrongJoinTokenTotal: JoinTokenSearch['totalCount'] = PageSize.parse(10);

// Collection counts retain the meaning of the items being counted.
import { OrganizationWithStats } from '../../organization/OrganizationRepository';
import { MemberCount } from '../../organization/OrganizationValues';
import { PropertyCount } from '../../organization/PropertyValues';
import {
  AttachmentCount,
  AttachmentByteCount,
} from '../attachments/AttachmentValues';
import { PollAttachmentRepository } from '../../poll/PollAttachmentRepository';
import { ReportAttachmentRepository } from '../../report/ReportAttachmentRepository';
import { OrganizationPropertyRepository } from '../../organization/OrganizationPropertyRepository';
type ResultValue<T> =
  Awaited<T> extends { success: true; value: infer V } | { success: false }
    ? V
    : never;
declare const pollAttachmentCount: ResultValue<
  ReturnType<PollAttachmentRepository['countByPollId']>
>;
declare const reportAttachmentCount: ResultValue<
  ReturnType<ReportAttachmentRepository['countByReportId']>
>;
declare const propertyCount: ResultValue<
  ReturnType<OrganizationPropertyRepository['countNonArchived']>
>;
declare const orgStats: OrganizationWithStats;
const pollFiles: AttachmentCount = pollAttachmentCount;
const reportFiles: AttachmentCount = reportAttachmentCount;
const properties: PropertyCount = propertyCount;
const members: MemberCount = orgStats.memberCount;
// @ts-expect-error File byte size is not a number of attachments.
const byteCountAsFiles: AttachmentCount = AttachmentByteCount.parse(5);
// @ts-expect-error Organization member count is not a number of properties.
const membersAsProperties: PropertyCount = members;
// @ts-expect-error A search total is not an organization member count.
const searchAsMembers: OrganizationWithStats['memberCount'] =
  ResultCount.parse(2);

import { PollAttachmentMetadata } from '../../poll/PollAttachmentRepository';
import { ReportAttachmentMetadata } from '../../report/ReportAttachmentRepository';
import { PropertyClaimAttachmentMetadata } from '../../organization/PropertyClaimAttachmentRepository';
import { AllOwnershipRow } from '../../organization/PropertyAssetRepository';
import { ReportRepository } from '../../report/ReportRepository';
type Publication = ResultValue<
  ReturnType<ReportRepository['listPublicAnonForSitemap']>
>[number];
declare const fileMetadata: PollAttachmentMetadata;
declare const reportFileMetadata: ReportAttachmentMetadata;
declare const claimFileMetadata: PropertyClaimAttachmentMetadata;
declare const history: AllOwnershipRow;
declare const publication: Publication;
const fileCreatedAt: Instant = fileMetadata.createdAt;
const reportFileCreatedAt: Instant = reportFileMetadata.createdAt;
const claimFileCreatedAt: Instant = claimFileMetadata.createdAt;
const ownershipStart: Instant = history.effectiveFrom;
const ownershipEnd: Instant | null = history.effectiveUntil;
const publishedAt: Instant = publication.lastPublishedAt;
// @ts-expect-error Attachment metadata must not expose mutable Dates.
fileMetadata.createdAt.setUTCFullYear(2000);
// @ts-expect-error Ownership projections must not expose mutable Dates.
history.effectiveFrom.setUTCFullYear(2000);
// @ts-expect-error Publication timestamps require validated instants.
const rawPublicationTime: Publication['lastPublishedAt'] = 'yesterday';

// Attachment factories accept byte quantities, not counts of files or arbitrary numbers.
import { PollAttachment } from '../../poll/PollAttachment';
import { ReportAttachment } from '../../report/ReportAttachment';
import { PropertyClaimAttachment } from '../../organization/PropertyClaimAttachment';
type PollFileInput = Parameters<typeof PollAttachment.create>[0];
type ReportFileInput = Parameters<typeof ReportAttachment.create>[0];
type ClaimFileInput = Parameters<typeof PropertyClaimAttachment.create>[0];
// @ts-expect-error File count is not file byte size.
const pollFileCountAsSize: PollFileInput['sizeBytes'] =
  AttachmentCount.parse(2);
// @ts-expect-error Report byte sizes must be validated.
const rawReportFileSize: ReportFileInput['sizeBytes'] = 2;
// @ts-expect-error File count is not claim evidence byte size.
const claimFileCountAsSize: ClaimFileInput['sizeBytes'] =
  AttachmentCount.parse(2);
