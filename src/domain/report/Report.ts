/** Report aggregate owns editable content, publication history and audience scope.
 * Validated values are retained; callers supply identity/time and receive detached dates. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import { EntityCreation } from '../shared/EntityCreation';
import {
  ReportId,
  OrganizationId,
  UserId,
  BoardId,
  PollId,
  ReportAttachmentId,
} from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import {
  SharedDomainCode,
  SharedDomainCodes,
} from '../shared/SharedDomainCodes';
import { ReportDomainCode, ReportDomainCodes } from './ReportDomainCodes';
import { ReportVisibility, isPublicVisibility } from './ReportVisibility';
import { validateAttachmentRefs } from '../shared/attachments/validateAttachmentRefs';
import { REPORT_ATTACHMENT_API_PREFIX } from '../shared/attachments/AttachmentReferenceScope';

import {
  ReportTitle,
  ReportBody,
  REPORT_TITLE_MAX_LENGTH,
  REPORT_BODY_MAX_LENGTH,
} from './ReportValues';
export {
  REPORT_TITLE_MAX_LENGTH,
  REPORT_BODY_MAX_LENGTH,
} from './ReportValues';
export type ReportFailure =
  | ReportDomainCode
  | SharedDomainCode
  | `${typeof SharedDomainCodes.CONTAINS_PROFANITY_WITH_WORDS}?words=${string}`;

// Path prefix for inline attachment refs in report bodies and the download
// route that serves them.
export { REPORT_ATTACHMENT_API_PREFIX };

export type ReportState = 'DRAFT' | 'PUBLISHED';

/** Raw storage/serialization shape, decoded by reconstitute. */
export interface ReportData {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  body: string;
  visibility: string;
  state: string;
  publishedById: string | null;
  lastPublishedAt: Date | null;
  notifyAudience: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  boardIds: string[];
  pollIds: string[];
  attachmentIds: string[];
}

export interface CreateReportInput {
  title: ReportTitle;
  body: ReportBody;
  organizationId: OrganizationId;
  createdById: UserId;
  visibility: ReportVisibility;
  boardIds: BoardId[];
  profanityChecker?: ProfanityChecker;
  stripMarkdownToPlainText?: (md: string) => string;
}

type ReportPublication =
  | {
      state: 'DRAFT';
      publishedById: null;
      lastPublishedAt: Instant | null;
      notifyAudience: false;
    }
  | {
      state: 'PUBLISHED';
      publishedById: UserId;
      lastPublishedAt: Instant;
      notifyAudience: boolean;
    };
type ReportAudience =
  | {
      visibility: typeof ReportVisibility.WITHIN_BOARDS;
      boardIds: [BoardId, ...BoardId[]];
    }
  | {
      visibility: Exclude<
        ReportVisibility,
        typeof ReportVisibility.WITHIN_BOARDS
      >;
      boardIds: [];
    };
interface ReportProps {
  readonly id: ReportId;
  readonly organizationId: OrganizationId;
  readonly createdById: UserId;
  title: ReportTitle;
  body: ReportBody;
  publication: ReportPublication;
  audience: ReportAudience;
  readonly createdAt: Instant;
  updatedAt: Instant;
  archivedAt: Instant | null;
  pollIds: PollId[];
  attachmentIds: ReportAttachmentId[];
}

function audience(
  visibility: ReportVisibility,
  boardIds: readonly BoardId[]
): ReportAudience {
  const validated = z.enum(ReportVisibility).parse(visibility);

  return validated === ReportVisibility.WITHIN_BOARDS
    ? {
        visibility: validated,
        boardIds: z.tuple([BoardId]).rest(BoardId).parse(boardIds),
      }
    : { visibility: validated, boardIds: [] };
}

export class Report {
  private props: ReportProps;
  private constructor(data: ReportData) {
    try {
      if (
        data.visibility !== ReportVisibility.WITHIN_BOARDS &&
        data.boardIds.length !== 0
      ) {
        throw new Error();
      }

      const lastPublishedAt =
        data.lastPublishedAt === null
          ? null
          : Instant.fromDate(data.lastPublishedAt);
      let publication: ReportPublication;

      if (data.state === 'DRAFT') {
        if (data.publishedById !== null || data.notifyAudience !== false) {
          throw new Error();
        }

        publication = {
          state: 'DRAFT',
          publishedById: null,
          notifyAudience: false,
          lastPublishedAt,
        };
      } else if (data.state === 'PUBLISHED' && lastPublishedAt !== null) {
        const notifyAudience = z.boolean().parse(data.notifyAudience);

        if (
          isPublicVisibility(z.enum(ReportVisibility).parse(data.visibility)) &&
          notifyAudience
        ) {
          throw new Error();
        }

        publication = {
          state: 'PUBLISHED',
          publishedById: UserId.parse(data.publishedById),
          lastPublishedAt,
          notifyAudience,
        };
      } else {
        throw new Error();
      }

      this.props = {
        id: ReportId.parse(data.id),
        organizationId: OrganizationId.parse(data.organizationId),
        createdById: UserId.parse(data.createdById),
        title: ReportTitle.parse(data.title),
        body: ReportBody.parse(data.body),
        publication,
        audience: audience(
          z.enum(ReportVisibility).parse(data.visibility),
          data.boardIds.map((id) => BoardId.parse(id))
        ),
        createdAt: Instant.fromDate(data.createdAt),
        updatedAt: Instant.fromDate(data.updatedAt),
        archivedAt:
          data.archivedAt === null ? null : Instant.fromDate(data.archivedAt),
        pollIds: data.pollIds.map((id) => PollId.parse(id)),
        attachmentIds: data.attachmentIds.map((id) =>
          ReportAttachmentId.parse(id)
        ),
      };
    } catch {
      throw new Error(ReportDomainCodes.REPORT_INVALID_DATA);
    }
  }

  static create(
    input: CreateReportInput,
    creation: EntityCreation<ReportId>
  ): Result<Report, ReportFailure> {
    if (!z.enum(ReportVisibility).safeParse(input.visibility).success) {
      return failure(ReportDomainCodes.REPORT_INVALID_VISIBILITY);
    }

    const titleCheck = parseReportTitle(input.title, input.profanityChecker);

    if (!titleCheck.success) {
      return failure(titleCheck.error);
    }

    const bodyCheck = parseReportBody(
      input.body,
      input.profanityChecker,
      input.stripMarkdownToPlainText
    );

    if (!bodyCheck.success) {
      return failure(bodyCheck.error);
    }

    // No attachments exist for a brand-new report, so any inline image ref
    // is automatically foreign.
    const refCheck = validateAttachmentRefs(
      input.body,
      { apiPrefix: REPORT_ATTACHMENT_API_PREFIX, ownIds: [] },
      ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF
    );

    if (!refCheck.success) {
      return failure(ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF);
    }

    if (
      input.visibility === ReportVisibility.WITHIN_BOARDS &&
      input.boardIds.length === 0
    ) {
      return failure(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }

    const now = Instant.toDate(Instant.parse(creation.now));

    return success(
      new Report({
        id: ReportId.parse(creation.id),
        organizationId: input.organizationId,
        createdById: input.createdById,
        title: titleCheck.value,
        body: bodyCheck.value,
        visibility: input.visibility,
        state: 'DRAFT',
        publishedById: null,
        lastPublishedAt: null,
        notifyAudience: false,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        boardIds:
          input.visibility === ReportVisibility.WITHIN_BOARDS
            ? [...input.boardIds]
            : [],
        pollIds: [],
        attachmentIds: [],
      })
    );
  }

  static reconstitute(props: ReportData): Report {
    return new Report(props);
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get createdById() {
    return this.props.createdById;
  }
  get title() {
    return this.props.title;
  }
  get body() {
    return this.props.body;
  }
  get visibility() {
    return this.props.audience.visibility;
  }
  get state() {
    return this.props.publication.state;
  }
  get publishedById() {
    return this.props.publication.publishedById;
  }
  get lastPublishedAt() {
    return this.props.publication.lastPublishedAt === null
      ? null
      : Instant.toDate(this.props.publication.lastPublishedAt);
  }
  get notifyAudience() {
    return this.props.publication.notifyAudience;
  }
  get createdAt() {
    return Instant.toDate(this.props.createdAt);
  }
  get updatedAt() {
    return Instant.toDate(this.props.updatedAt);
  }
  get archivedAt() {
    return this.props.archivedAt === null
      ? null
      : Instant.toDate(this.props.archivedAt);
  }
  get boardIds() {
    return [...this.props.audience.boardIds];
  }
  get pollIds() {
    return [...this.props.pollIds];
  }
  get attachmentIds() {
    return [...this.props.attachmentIds];
  }

  isDraft(): boolean {
    return this.props.publication.state === 'DRAFT';
  }
  isPublished(): boolean {
    return this.props.publication.state === 'PUBLISHED';
  }
  isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  /** Shared content-edit policy also lets request decoding retain lifecycle precedence. */
  canEditContent(): Result<void, ReportFailure> {
    return this.isDraft()
      ? success(undefined)
      : failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
  }

  updateTitle(
    newTitle: ReportTitle,
    at: Instant,
    profanityChecker?: ProfanityChecker
  ): Result<void, ReportFailure> {
    const editable = this.canEditContent();

    if (!editable.success) {
      return editable;
    }

    const v = parseReportTitle(newTitle, profanityChecker);

    if (!v.success) {
      return failure(v.error);
    }

    const now = Instant.parse(at);
    this.props.title = v.value;
    this.props.updatedAt = now;

    return success(undefined);
  }

  updateBody(
    newBody: ReportBody,
    at: Instant,
    profanityChecker?: ProfanityChecker,
    stripMarkdownToPlainText?: (md: string) => string
  ): Result<void, ReportFailure> {
    const editable = this.canEditContent();

    if (!editable.success) {
      return editable;
    }

    const v = parseReportBody(
      newBody,
      profanityChecker,
      stripMarkdownToPlainText
    );

    if (!v.success) {
      return failure(v.error);
    }

    const refCheck = validateAttachmentRefs(
      newBody,
      {
        apiPrefix: REPORT_ATTACHMENT_API_PREFIX,
        ownIds: this.props.attachmentIds,
      },
      ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF
    );

    if (!refCheck.success) {
      return failure(ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF);
    }

    const now = Instant.parse(at);
    this.props.body = v.value;
    this.props.updatedAt = now;

    return success(undefined);
  }

  setVisibility(
    visibility: ReportVisibility,
    boardIds: BoardId[],
    at: Instant
  ): Result<void, ReportFailure> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    if (!z.enum(ReportVisibility).safeParse(visibility).success) {
      return failure(ReportDomainCodes.REPORT_INVALID_VISIBILITY);
    }

    if (
      visibility === ReportVisibility.WITHIN_BOARDS &&
      boardIds.length === 0
    ) {
      return failure(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }

    const now = Instant.parse(at);
    this.props.audience = audience(visibility, boardIds);
    this.props.updatedAt = now;

    return success(undefined);
  }

  attachPoll(pollId: PollId, at: Instant): Result<void, ReportFailure> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const now = Instant.parse(at);
    const validatedPollId = PollId.parse(pollId);

    if (!this.props.pollIds.includes(validatedPollId)) {
      this.props.pollIds.push(validatedPollId);
    }

    this.props.updatedAt = now;

    return success(undefined);
  }

  detachPoll(pollId: PollId, at: Instant): Result<void, ReportFailure> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const now = Instant.parse(at);
    const validatedPollId = PollId.parse(pollId);
    this.props.pollIds = this.props.pollIds.filter(
      (p) => p !== validatedPollId
    );
    this.props.updatedAt = now;

    return success(undefined);
  }

  attachAttachment(
    attachmentId: ReportAttachmentId,
    at: Instant
  ): Result<void, ReportFailure> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const now = Instant.parse(at);
    this.props.attachmentIds.push(ReportAttachmentId.parse(attachmentId));
    this.props.updatedAt = now;

    return success(undefined);
  }

  detachAttachment(
    attachmentId: ReportAttachmentId,
    at: Instant
  ): Result<void, ReportFailure> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const now = Instant.parse(at);
    const validatedAttachmentId = ReportAttachmentId.parse(attachmentId);
    this.props.attachmentIds = this.props.attachmentIds.filter(
      (a) => a !== validatedAttachmentId
    );
    this.props.updatedAt = now;

    return success(undefined);
  }

  publish(
    publishedById: UserId,
    notifyAudience: boolean,
    at: Instant
  ): Result<void, ReportFailure> {
    if (this.isArchived()) {
      return failure(ReportDomainCodes.REPORT_ARCHIVED);
    }

    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_MUST_BE_DRAFT);
    }

    const now = Instant.parse(at);
    this.props.publication = {
      state: 'PUBLISHED',
      publishedById: UserId.parse(publishedById),
      lastPublishedAt: now,
      notifyAudience: isPublicVisibility(this.visibility)
        ? false
        : notifyAudience,
    };
    this.props.updatedAt = now;

    return success(undefined);
  }

  downgradeToDraft(at: Instant): Result<void, ReportFailure> {
    if (this.isArchived()) {
      return failure(ReportDomainCodes.REPORT_ARCHIVED);
    }

    if (!this.isPublished()) {
      return failure(ReportDomainCodes.REPORT_MUST_BE_PUBLISHED);
    }

    const now = Instant.parse(at);
    this.props.publication = {
      state: 'DRAFT',
      publishedById: null,
      notifyAudience: false,
      lastPublishedAt: this.props.publication.lastPublishedAt,
    };
    this.props.updatedAt = now;

    return success(undefined);
  }

  archive(at: Instant): Result<void, ReportFailure> {
    if (this.isArchived()) {
      return failure(ReportDomainCodes.REPORT_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = Instant.parse(at);
    this.props.updatedAt = this.props.archivedAt;

    return success(undefined);
  }
}

// Compose a profanity error code, embedding the specific offending words as
// a URL-encoded query suffix when they're available so the UI message can
// quote them back to the user.
function profanityErrorCode(words: string[]): ReportFailure {
  if (words.length === 0) {
    return SharedDomainCodes.CONTAINS_PROFANITY;
  }

  const encoded = encodeURIComponent(words.join(', '));

  return `${SharedDomainCodes.CONTAINS_PROFANITY_WITH_WORDS}?words=${encoded}`;
}

/** Raw author input is decoded with the same policy used by aggregate mutations. */
export function parseReportTitle(
  title: unknown,
  profanityChecker?: ProfanityChecker
): Result<ReportTitle, ReportFailure> {
  if (typeof title !== 'string' || title.trim().length === 0) {
    return failure(ReportDomainCodes.REPORT_TITLE_EMPTY);
  }

  if (title.length > REPORT_TITLE_MAX_LENGTH) {
    return failure(ReportDomainCodes.REPORT_TITLE_TOO_LONG);
  }

  if (profanityChecker?.containsProfanity(title.trim())) {
    return failure(
      profanityErrorCode(profanityChecker.findProfaneWords(title.trim()))
    );
  }

  return success(ReportTitle.parse(title.trim()));
}

export function parseReportBody(
  body: unknown,
  profanityChecker?: ProfanityChecker,
  stripMarkdownToPlainText?: (md: string) => string
): Result<ReportBody, ReportFailure> {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return failure(ReportDomainCodes.REPORT_BODY_EMPTY);
  }

  if (body.length > REPORT_BODY_MAX_LENGTH) {
    return failure(ReportDomainCodes.REPORT_BODY_TOO_LONG);
  }

  if (profanityChecker) {
    const text = stripMarkdownToPlainText
      ? stripMarkdownToPlainText(body)
      : body;

    if (profanityChecker.containsProfanity(text)) {
      return failure(
        profanityErrorCode(profanityChecker.findProfaneWords(text))
      );
    }
  }

  return success(ReportBody.parse(body));
}
