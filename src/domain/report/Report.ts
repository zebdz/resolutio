import { Result, success, failure } from '../shared/Result';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { ReportDomainCodes } from './ReportDomainCodes';
import { ReportVisibility, isPublicVisibility } from './ReportVisibility';
import { extractReportAttachmentIdsFromBody } from './extractReportAttachmentIdsFromBody';

export const REPORT_TITLE_MAX_LENGTH = 200;
export const REPORT_BODY_MAX_LENGTH = 50_000;

export type ReportState = 'DRAFT' | 'PUBLISHED';

export interface ReportProps {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  body: string;
  visibility: ReportVisibility;
  state: ReportState;
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
  title: string;
  body: string;
  organizationId: string;
  createdById: string;
  visibility: ReportVisibility;
  boardIds: string[];
  profanityChecker?: ProfanityChecker;
  stripMarkdownToPlainText?: (md: string) => string;
}

export class Report {
  private constructor(private props: ReportProps) {}

  static create(input: CreateReportInput): Result<Report, string> {
    const titleCheck = validateTitle(input.title, input.profanityChecker);

    if (!titleCheck.success) {
      return failure(titleCheck.error);
    }

    const bodyCheck = validateBody(
      input.body,
      input.profanityChecker,
      input.stripMarkdownToPlainText
    );

    if (!bodyCheck.success) {
      return failure(bodyCheck.error);
    }

    // No attachments exist for a brand-new report, so any inline image ref
    // is automatically foreign.
    const refCheck = validateBodyAttachmentRefs(input.body, []);

    if (!refCheck.success) {
      return failure(refCheck.error);
    }

    if (
      input.visibility === ReportVisibility.WITHIN_BOARDS &&
      input.boardIds.length === 0
    ) {
      return failure(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }

    const now = new Date();

    return success(
      new Report({
        id: '',
        organizationId: input.organizationId,
        createdById: input.createdById,
        title: input.title.trim(),
        body: input.body,
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

  static reconstitute(props: ReportProps): Report {
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
    return this.props.visibility;
  }
  get state() {
    return this.props.state;
  }
  get publishedById() {
    return this.props.publishedById;
  }
  get lastPublishedAt() {
    return this.props.lastPublishedAt;
  }
  get notifyAudience() {
    return this.props.notifyAudience;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get archivedAt() {
    return this.props.archivedAt;
  }
  get boardIds() {
    return [...this.props.boardIds];
  }
  get pollIds() {
    return [...this.props.pollIds];
  }
  get attachmentIds() {
    return [...this.props.attachmentIds];
  }

  isDraft(): boolean {
    return this.props.state === 'DRAFT';
  }
  isPublished(): boolean {
    return this.props.state === 'PUBLISHED';
  }
  isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  updateTitle(
    newTitle: string,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const v = validateTitle(newTitle, profanityChecker);

    if (!v.success) {
      return failure(v.error);
    }

    this.props.title = newTitle.trim();
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  updateBody(
    newBody: string,
    profanityChecker?: ProfanityChecker,
    stripMarkdownToPlainText?: (md: string) => string
  ): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    const v = validateBody(newBody, profanityChecker, stripMarkdownToPlainText);

    if (!v.success) {
      return failure(v.error);
    }

    const refCheck = validateBodyAttachmentRefs(
      newBody,
      this.props.attachmentIds
    );

    if (!refCheck.success) {
      return failure(refCheck.error);
    }

    this.props.body = newBody;
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  setVisibility(
    visibility: ReportVisibility,
    boardIds: string[]
  ): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    if (
      visibility === ReportVisibility.WITHIN_BOARDS &&
      boardIds.length === 0
    ) {
      return failure(ReportDomainCodes.REPORT_BOARDS_EMPTY);
    }

    this.props.visibility = visibility;
    this.props.boardIds =
      visibility === ReportVisibility.WITHIN_BOARDS ? [...boardIds] : [];
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  attachPoll(pollId: string): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    if (!this.props.pollIds.includes(pollId)) {
      this.props.pollIds.push(pollId);
    }

    this.props.updatedAt = new Date();

    return success(undefined);
  }

  detachPoll(pollId: string): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    this.props.pollIds = this.props.pollIds.filter((p) => p !== pollId);
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  attachAttachment(attachmentId: string): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    this.props.attachmentIds.push(attachmentId);
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  detachAttachment(attachmentId: string): Result<void, string> {
    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_CANNOT_EDIT_PUBLISHED);
    }

    this.props.attachmentIds = this.props.attachmentIds.filter(
      (a) => a !== attachmentId
    );
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  publish(
    publishedById: string,
    notifyAudience: boolean
  ): Result<void, string> {
    if (this.isArchived()) {
      return failure(ReportDomainCodes.REPORT_ARCHIVED);
    }

    if (!this.isDraft()) {
      return failure(ReportDomainCodes.REPORT_MUST_BE_DRAFT);
    }

    const now = new Date();
    this.props.state = 'PUBLISHED';
    this.props.publishedById = publishedById;
    this.props.lastPublishedAt = now;
    this.props.notifyAudience = isPublicVisibility(this.props.visibility)
      ? false
      : notifyAudience;
    this.props.updatedAt = now;

    return success(undefined);
  }

  downgradeToDraft(): Result<void, string> {
    if (this.isArchived()) {
      return failure(ReportDomainCodes.REPORT_ARCHIVED);
    }

    if (!this.isPublished()) {
      return failure(ReportDomainCodes.REPORT_MUST_BE_PUBLISHED);
    }

    this.props.state = 'DRAFT';
    this.props.publishedById = null;
    this.props.notifyAudience = false;
    this.props.updatedAt = new Date();

    return success(undefined);
  }

  archive(): Result<void, string> {
    if (this.isArchived()) {
      return failure(ReportDomainCodes.REPORT_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = new Date();
    this.props.updatedAt = this.props.archivedAt;

    return success(undefined);
  }
}

// Compose a profanity error code, embedding the specific offending words as
// a URL-encoded query suffix when they're available so the UI message can
// quote them back to the user.
function profanityErrorCode(words: string[]): string {
  if (words.length === 0) {
    return SharedDomainCodes.CONTAINS_PROFANITY;
  }

  const encoded = encodeURIComponent(words.join(', '));

  return `${SharedDomainCodes.CONTAINS_PROFANITY_WITH_WORDS}?words=${encoded}`;
}

function validateTitle(
  title: string,
  profanityChecker?: ProfanityChecker
): Result<void, string> {
  if (!title || title.trim().length === 0) {
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

  return success(undefined);
}

function validateBody(
  body: string,
  profanityChecker?: ProfanityChecker,
  stripMarkdownToPlainText?: (md: string) => string
): Result<void, string> {
  if (!body || body.trim().length === 0) {
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

  return success(undefined);
}

// Body may only reference attachments that belong to this report. This
// prevents leaks where pasting a URL from another (private) report would
// render fine for the author but 404 for everyone else.
function validateBodyAttachmentRefs(
  body: string,
  ownAttachmentIds: string[]
): Result<void, string> {
  const refIds = extractReportAttachmentIdsFromBody(body);

  if (refIds.length === 0) {
    return success(undefined);
  }

  const ownSet = new Set(ownAttachmentIds);

  for (const id of refIds) {
    if (!ownSet.has(id)) {
      return failure(ReportDomainCodes.REPORT_BODY_INVALID_ATTACHMENT_REF);
    }
  }

  return success(undefined);
}
