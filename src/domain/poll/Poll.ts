/** Poll aggregate owns lifecycle/content and validates nested ownership on reconstruction.
 * Plain snapshots retain validated types; finish time comes from the caller.
 * Finish events dispatch only after a successful save. */
import { SortOrder, AnswerText } from './QuestionValues';
import { Result, success, failure } from '../shared/Result';
import { PollPeriod } from './PollPeriod';
import { PollFinished } from './PollFinished';
import { PollRevision } from './PollRevision';
import { PollId, PollInstant } from './PollValues';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { z } from 'zod';
import {
  OrganizationId,
  BoardId,
  UserId,
  PropertyId,
  PollAttachmentId,
  QuestionId,
  AnswerId,
} from '../shared/EntityIds';
import {
  PollTitle,
  PollDescription,
  parsePollTitle,
  parsePollDescription,
  parseNewPollContent,
} from './PollContent';
export {
  POLL_TITLE_MAX_LENGTH,
  POLL_DESCRIPTION_MAX_LENGTH,
} from './PollContent';
import { validateAttachmentRefs } from '../shared/attachments/validateAttachmentRefs';
import {
  POLL_ATTACHMENT_API_PREFIX,
  POLL_ATTACHMENT_COUNT_LIMIT,
} from './PollAttachment';
import { Question, QuestionData } from './Question';
import { Answer } from './Answer';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';
import { PollState } from './PollState';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import {
  SharedDomainCodes,
  SharedDomainCode,
} from '../shared/SharedDomainCodes';
import { PollType, parsePollType } from './PollType';
import { DistributionType } from './DistributionType';
import { parsePollWeightConfig } from './PollWeightConfig';
import { PropertyAggregation } from './PropertyAggregation';

/** Raw persistence boundary. Decode before retaining any aggregate state. */
export interface PollData {
  id: string;
  title: string;
  description: string;
  organizationId: string;
  boardId: string | null;
  pollType: string; // 'ORGANIZATION' | 'OPEN'
  startDate: Date;
  endDate: Date;
  state: PollState;
  finishedAt?: Date | null;
  revision?: PollRevision;
  weightCriteria: string | null;
  distributionType: string; // 'EQUAL' | 'OWNERSHIP_UNIT_COUNT' | 'OWNERSHIP_SIZE_WEIGHTED'
  propertyAggregation: string; // 'RAW_SUM' | 'NORMALIZE_PER_PROPERTY'
  propertyIds: string[]; // empty = no filter (all properties)
  anonymous: boolean;
  createdBy: string;
  createdAt: Date;
  archivedAt: Date | null;
  questions: Question[];
  // Ids of files attached to the description. Optional on input so that
  // existing reconstitute callers keep working; always an array once
  // constructed.
  attachmentIds?: string[];
}

export type PollFailure = PollDomainCode | SharedDomainCode;

export interface PollProps {
  readonly id: PollId;
  title: PollTitle;
  description: PollDescription;
  readonly organizationId: OrganizationId;
  readonly boardId: BoardId | null;
  readonly pollType: PollType;
  period: PollPeriod;
  weightCriteria: string | null;
  distributionType: DistributionType;
  propertyAggregation: PropertyAggregation;
  propertyIds: PropertyId[];
  readonly anonymous: boolean;
  readonly createdBy: UserId;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
  questions: Question[];
}

type PollLifecycle =
  | { state: Exclude<PollState, PollState.FINISHED>; finishedAt: null }
  | { state: PollState.FINISHED; finishedAt: PollInstant | null };

export class Poll {
  private props: PollProps;
  private lifecycle: PollLifecycle;
  public readonly revision: PollRevision;
  private events: PollFinished[] = [];
  // Held outside `props` so it is definitely an array internally while
  // remaining optional for callers of `reconstitute`.
  private attachmentIdList: PollAttachmentId[];

  private constructor(data: PollData) {
    const id = PollId.parse(data.id);
    const questions = z
      .array(
        z.custom<Question>((value) => value instanceof Question, {
          error: PollDomainCodes.QUESTION_INVALID_DATA,
        })
      )
      .refine(
        (items) =>
          items.every((question) => question.pollId === id) &&
          new Set(items.map((question) => question.id)).size === items.length,
        { error: PollDomainCodes.QUESTION_INVALID_DATA }
      )
      .parse(data.questions);
    const period = PollPeriod.create(data.startDate, data.endDate);

    if (!period.success) {
      throw new Error(period.error);
    }

    this.props = {
      id,
      title: PollTitle.parse(data.title),
      description: PollDescription.parse(data.description),
      organizationId: OrganizationId.parse(data.organizationId),
      boardId: data.boardId === null ? null : BoardId.parse(data.boardId),
      pollType: z.enum(PollType).parse(data.pollType),
      period: period.value,
      weightCriteria: data.weightCriteria,
      distributionType: z.enum(DistributionType).parse(data.distributionType),
      propertyAggregation: z
        .enum(PropertyAggregation)
        .parse(data.propertyAggregation),
      propertyIds: data.propertyIds.map((id) => PropertyId.parse(id)),
      anonymous: z.boolean().parse(data.anonymous),
      createdBy: UserId.parse(data.createdBy),
      createdAt: Instant.fromDate(data.createdAt),
      archivedAt:
        data.archivedAt === null ? null : Instant.fromDate(data.archivedAt),
      questions: [...questions],
    };

    if (this.props.pollType === PollType.OPEN) {
      if (this.props.boardId !== null) {
        throw new Error(PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED);
      }

      if (
        this.props.distributionType !== DistributionType.EQUAL ||
        this.props.propertyAggregation !== PropertyAggregation.RAW_SUM ||
        this.props.propertyIds.length !== 0
      ) {
        throw new Error(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
      }
    }

    this.revision = PollRevision.parse(data.revision ?? 0);
    this.attachmentIdList = (data.attachmentIds ?? []).map((id) =>
      PollAttachmentId.parse(id)
    );
    let finishedAt: PollInstant | null = null;

    if (data.finishedAt != null) {
      try {
        finishedAt = PollInstant.parse(data.finishedAt.toISOString());
      } catch {
        throw new Error(PollDomainCodes.POLL_INVALID_DATES);
      }
    }

    const state = z.enum(PollState).parse(data.state);

    if (state === PollState.FINISHED) {
      // Explicit legacy state: polls finished before timestamps were recorded have no timestamp.
      this.lifecycle = { state, finishedAt };
    } else {
      if (finishedAt !== null) {
        throw new Error(PollDomainCodes.POLL_INVALID_DATES);
      }

      this.lifecycle = { state, finishedAt: null };
    }
  }

  public static create(
    title: PollTitle,
    description: PollDescription,
    organizationId: OrganizationId,
    boardId: BoardId | null,
    createdBy: UserId,
    period: PollPeriod,
    creation: EntityCreation<PollId>,
    profanityChecker?: ProfanityChecker,
    pollType: PollType = PollType.ORGANIZATION,
    anonymous: boolean = false
  ): Result<Poll, PollFailure> {
    const content = parseNewPollContent(title, description);

    if (!content.success) {
      return content;
    }

    // Only a validated, immutable period can enter the aggregate.
    if (!(period instanceof PollPeriod)) {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }

    // Validate poll type. An open poll is voted on by the whole platform, so
    // narrowing it to a board's members would contradict its own definition.
    const pollTypeResult = parsePollType(pollType);

    if (!pollTypeResult.success) {
      return failure(pollTypeResult.error);
    }

    if (pollTypeResult.value === PollType.OPEN && boardId !== null) {
      return failure(PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED);
    }

    if (profanityChecker?.containsProfanity(title.trim())) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    if (profanityChecker?.containsProfanity(description.trim())) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const poll = new Poll({
      id: PollId.parse(creation.id),
      title: content.value.title,
      description: content.value.description,
      organizationId,
      boardId,
      pollType: pollTypeResult.value,
      startDate: Instant.toDate(period.start),
      endDate: Instant.toDate(period.end),
      state: PollState.DRAFT,
      weightCriteria: null,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      propertyIds: [],
      anonymous,
      createdBy,
      createdAt: Instant.toDate(Instant.parse(creation.now)),
      archivedAt: null,
      questions: [],
    });

    return success(poll);
  }

  public static reconstitute(props: PollData): Poll {
    PollId.parse(props.id);

    return new Poll(props);
  }

  // Getters
  public get id(): PollId {
    return this.props.id;
  }

  public get title(): PollTitle {
    return this.props.title;
  }

  public get description(): PollDescription {
    return this.props.description;
  }

  public get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  public get boardId(): BoardId | null {
    return this.props.boardId;
  }

  public get pollType(): PollType {
    return this.props.pollType;
  }

  public get startDate(): Date {
    return Instant.toDate(this.props.period.start);
  }

  public get endDate(): Date {
    return Instant.toDate(this.props.period.end);
  }

  public get state(): PollState {
    return this.lifecycle.state;
  }

  public get finishedAt(): Date | null {
    return this.lifecycle.finishedAt === null
      ? null
      : new Date(this.lifecycle.finishedAt);
  }

  public pullDomainEvents(): readonly PollFinished[] {
    const events = this.events;
    this.events = [];

    return events;
  }

  public get weightCriteria(): string | null {
    return this.props.weightCriteria;
  }

  public get distributionType(): DistributionType {
    return this.props.distributionType;
  }

  public get propertyAggregation(): PropertyAggregation {
    return this.props.propertyAggregation;
  }

  public get propertyIds(): PropertyId[] {
    return [...this.props.propertyIds];
  }

  public get createdBy(): UserId {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }

  public get archivedAt(): Date | null {
    return this.props.archivedAt === null
      ? null
      : Instant.toDate(this.props.archivedAt);
  }

  public get questions(): Question[] {
    return [...this.props.questions];
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  /**
   * Open polls are voted on by every verified platform user — no snapshot,
   * one vote per person, results tallied live from the votes cast.
   */
  public isOpen(): boolean {
    return this.props.pollType === PollType.OPEN;
  }

  /**
   * An anonymous poll keeps the behaviour every poll had before this flag
   * existed: only admins ever see who voted how, and nothing is readable until
   * the poll is finished. A named poll puts the voter identities into the
   * record and opens them to the organization while the vote is still running.
   *
   * Set once at creation and never mutated — a voter decides whether to vote
   * based on this label, so it must not be able to change under them.
   */
  public isAnonymous(): boolean {
    return this.props.anonymous;
  }

  public isDraft(): boolean {
    return this.lifecycle.state === PollState.DRAFT;
  }

  public isSubmitted(): boolean {
    return this.lifecycle.state === PollState.SUBMITTED;
  }

  public isReady(): boolean {
    return this.lifecycle.state === PollState.READY;
  }

  public isActive(): boolean {
    return this.lifecycle.state === PollState.ACTIVE;
  }

  public isFinished(): boolean {
    return this.lifecycle.state === PollState.FINISHED;
  }

  /**
   * Content is frozen from the moment the author submits the poll. An admin
   * deciding whether to freeze participants has to be looking at what they
   * will actually be freezing, so a submitted poll must not move under them;
   * the author recalls it to DRAFT if they want to change something.
   */
  public isContentLocked(): boolean {
    return this.isSubmitted() || this.isActive() || this.isFinished();
  }

  /**
   * Check if this poll can be edited
   * A poll can only be edited if:
   * - It is not submitted, active or finished
   * - It has no votes
   */
  public canEdit(hasVotes: boolean): Result<boolean, PollFailure> {
    if (this.isContentLocked()) {
      return success(false);
    }

    if (hasVotes) {
      return success(false);
    }

    return success(true);
  }

  /** Shared lifecycle policy for content edits and their request decoders. */
  public canEditContent(): Result<void, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    }

    return success(undefined);
  }

  public updateTitle(
    newTitle: PollTitle,
    profanityChecker?: ProfanityChecker
  ): Result<void, PollFailure> {
    const editable = this.canEditContent();

    if (!editable.success) {
      return editable;
    }

    const title = parsePollTitle(newTitle);

    if (!title.success) {
      return title;
    }

    if (profanityChecker?.containsProfanity(title.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.title = title.value;

    return success(undefined);
  }

  public updateDescription(
    newDescription: PollDescription,
    profanityChecker?: ProfanityChecker
  ): Result<void, PollFailure> {
    const editable = this.canEditContent();

    if (!editable.success) {
      return editable;
    }

    const description = parsePollDescription(newDescription);

    if (!description.success) {
      return description;
    }

    const refCheck = validateAttachmentRefs(
      newDescription,
      { apiPrefix: POLL_ATTACHMENT_API_PREFIX, ownIds: this.attachmentIdList },
      PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
    );

    if (!refCheck.success) {
      return refCheck;
    }

    if (profanityChecker?.containsProfanity(newDescription.trim())) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.description = description.value;

    return success(undefined);
  }

  public get attachmentIds(): PollAttachmentId[] {
    return [...this.attachmentIdList];
  }

  // Attachments are part of the description's evidence, so they follow the
  // same freeze rule as the description itself: mutable while DRAFT or
  // READY, fixed once voting opens. Otherwise voters would see different
  // evidence at different times.
  public addAttachment(
    attachmentId: PollAttachmentId
  ): Result<void, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    if (this.attachmentIdList.length >= POLL_ATTACHMENT_COUNT_LIMIT) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED);
    }

    this.attachmentIdList.push(PollAttachmentId.parse(attachmentId));

    return success(undefined);
  }

  public removeAttachment(
    attachmentId: PollAttachmentId
  ): Result<void, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    if (!this.attachmentIdList.includes(attachmentId)) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND);
    }

    this.attachmentIdList = this.attachmentIdList.filter(
      (id) => id !== attachmentId
    );

    return success(undefined);
  }

  public updateDates(period: PollPeriod): Result<void, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    }

    if (!(period instanceof PollPeriod)) {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }

    this.props.period = period;

    return success(undefined);
  }

  /**
   * A poll is only fit to leave the author's hands once every live question
   * can actually be answered. Checked when it is submitted, so the author sees
   * the problem while they can still fix it, and again on snapshot, which is a
   * separate entry point into the same requirement.
   */
  private validateAnswerable(): Result<void, PollFailure> {
    const activeQuestions = this.props.questions.filter((q) => !q.isArchived());

    if (activeQuestions.length === 0) {
      return failure(PollDomainCodes.POLL_NO_QUESTIONS);
    }

    for (const question of activeQuestions) {
      const activeAnswers = question.answers.filter((a) => !a.isArchived());

      if (activeAnswers.length === 0) {
        return failure(PollDomainCodes.POLL_QUESTION_NO_ANSWERS);
      }
    }

    return success(undefined);
  }

  /**
   * Submit to admin: DRAFT → SUBMITTED
   *
   * The author declaring the poll finished. Nothing an admin does to a poll's
   * lifecycle is possible before this point.
   */
  public submitToAdmin(): Result<void, PollFailure> {
    if (!this.isDraft()) {
      return failure(PollDomainCodes.POLL_MUST_BE_DRAFT);
    }

    const answerable = this.validateAnswerable();

    if (!answerable.success) {
      return failure(answerable.error);
    }

    this.lifecycle = { state: PollState.SUBMITTED, finishedAt: null };

    return success(undefined);
  }

  /**
   * Return to draft: SUBMITTED → DRAFT
   *
   * One transition, two callers: the author recalling a poll they submitted
   * too early, and an admin handing it back for changes. Only from SUBMITTED —
   * once an admin has frozen participants the way back is discardSnapshot,
   * which has to reckon with votes.
   */
  public returnToDraft(): Result<void, PollFailure> {
    if (!this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
    }

    this.lifecycle = { state: PollState.DRAFT, finishedAt: null };

    return success(undefined);
  }

  /**
   * Take snapshot: SUBMITTED → READY
   * Validates poll has questions with answers before transitioning
   */
  public takeSnapshot(): Result<void, PollFailure> {
    if (!this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
    }

    const answerable = this.validateAnswerable();

    if (!answerable.success) {
      return failure(answerable.error);
    }

    this.lifecycle = { state: PollState.READY, finishedAt: null };

    return success(undefined);
  }

  /**
   * Discard snapshot: READY → DRAFT
   * Only allowed if no votes have been cast
   */
  public discardSnapshot(hasVotes: boolean): Result<void, PollDomainCode> {
    if (!this.isReady()) {
      return failure(PollDomainCodes.POLL_MUST_BE_READY);
    }

    if (hasVotes) {
      return failure(PollDomainCodes.POLL_CANNOT_DISCARD_SNAPSHOT_HAS_VOTES);
    }

    // Back to SUBMITTED, not DRAFT: this undoes the admin's freeze, not the
    // author's handover. Dropping to DRAFT would silently revoke a decision
    // that was never the admin's to revoke, and leave the author waiting on a
    // poll they had already sent. An admin who does want the author to change
    // something uses returnToDraft, which tells them so.
    this.lifecycle = { state: PollState.SUBMITTED, finishedAt: null };

    return success(undefined);
  }

  /**
   * Activate: READY → ACTIVE
   */
  public activate(): Result<void, PollFailure> {
    if (!this.isReady()) {
      return failure(PollDomainCodes.POLL_MUST_BE_READY);
    }

    this.lifecycle = { state: PollState.ACTIVE, finishedAt: null };

    return success(undefined);
  }

  /**
   * Deactivate: ACTIVE → READY
   */
  public deactivate(): Result<void, PollFailure> {
    if (!this.isActive()) {
      return failure(PollDomainCodes.POLL_MUST_BE_ACTIVE);
    }

    this.lifecycle = { state: PollState.READY, finishedAt: null };

    return success(undefined);
  }

  /**
   * Finish: ACTIVE → FINISHED
   */
  public finish(now: PollInstant): Result<void, PollDomainCode> {
    if (!this.isActive()) {
      return failure(PollDomainCodes.POLL_MUST_BE_ACTIVE);
    }

    const pollId = PollId.safeParse(this.id);

    if (!pollId.success) {
      return failure(PollDomainCodes.POLL_INVALID_ID);
    }

    const finishedAt = PollInstant.safeParse(now);

    if (!finishedAt.success) {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }

    this.lifecycle = { state: PollState.FINISHED, finishedAt: finishedAt.data };
    this.events.push(
      Object.freeze({
        type: 'PollFinished',
        pollId: pollId.data,
        finishedAt: finishedAt.data,
      })
    );

    return success(undefined);
  }

  public addQuestion(question: Question): Result<void, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_ADD_QUESTION_FINISHED);
    }

    if (this.isArchived()) {
      return failure(PollDomainCodes.POLL_CANNOT_ADD_QUESTION_ARCHIVED);
    }

    this.props.questions.push(question);

    return success(undefined);
  }

  public removeQuestion(
    questionId: QuestionId,
    at: Instant
  ): Result<void, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_REMOVE_QUESTION_FINISHED);
    }

    if (this.isArchived()) {
      return failure(PollDomainCodes.POLL_CANNOT_REMOVE_QUESTION_ARCHIVED);
    }

    const question = this.props.questions.find((q) => q.id === questionId);

    if (!question) {
      return failure(PollDomainCodes.QUESTION_NOT_FOUND);
    }

    // Archive the question instead of removing it
    const archiveResult = question.archive(at);

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    return success(undefined);
  }

  public archive(at: Instant): Result<void, PollFailure> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.POLL_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = Instant.parse(at);

    return success(undefined);
  }

  /** Resolve the target under the answer-creation policy. Request adapters can
   * retain lifecycle-error precedence before decoding the answer's content. */
  public questionForNewAnswer(
    questionId: QuestionId
  ): Result<Question, PollFailure> {
    if (this.isSubmitted()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
    }

    if (this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_ADD_ANSWER_ACTIVE);
    }

    if (this.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_ADD_ANSWER_FINISHED);
    }

    const question = this.props.questions.find((q) => q.id === questionId);

    if (!question) {
      return failure(PollDomainCodes.QUESTION_NOT_FOUND);
    }

    return success(question);
  }

  /**
   * Add an answer to a question through the aggregate root
   * Validates poll state before delegating to the question
   */
  public addAnswerToQuestion(
    questionId: QuestionId,
    text: AnswerText,
    order: SortOrder,
    creation: EntityCreation<AnswerId>,
    profanityChecker?: ProfanityChecker
  ): Result<Answer, PollFailure> {
    const target = this.questionForNewAnswer(questionId);

    if (!target.success) {
      return target;
    }

    const question = target.value;

    // Create the answer
    const answerResult = Answer.create(
      text,
      order,
      questionId,
      creation,
      profanityChecker
    );

    if (!answerResult.success) {
      return failure(answerResult.error);
    }

    // Add to question (Question.addAnswer checks archived status)
    const addResult = question.addAnswer(answerResult.value);

    if (!addResult.success) {
      return failure(addResult.error);
    }

    return success(answerResult.value);
  }

  public toJSON() {
    const { period: _period, ...data } = this.props;

    return {
      ...data,
      state: this.state,
      revision: this.revision,
      startDate: this.startDate,
      endDate: this.endDate,
      createdAt: this.createdAt,
      archivedAt: this.archivedAt,
      propertyIds: this.propertyIds,
      finishedAt: this.finishedAt,
      questions: this.props.questions.map((q) => q.toJSON()),
      // Held outside `props`, so the spread above would otherwise drop it.
      attachmentIds: [...this.attachmentIdList],
    } satisfies Omit<PollData, 'questions'> & { questions: QuestionData[] };
  }

  /**
   * Check if participants can be modified
   * Participants can only be modified in READY state with no votes
   */
  public canModifyParticipants(hasVotes: boolean): boolean {
    return this.isReady() && !hasVotes;
  }

  /**
   * Set weight criteria for the poll
   */
  public setWeightCriteria(criteria: string | null): void {
    this.props.weightCriteria = criteria;
  }

  public applyWeightConfig(
    distributionType: DistributionType,
    propertyAggregation: PropertyAggregation,
    propertyIds: readonly PropertyId[]
  ): Result<void, PollFailure> {
    const config = parsePollWeightConfig(this.pollType, {
      distributionType,
      propertyAggregation,
      propertyIds,
    });

    if (!config.success) {
      return config;
    }

    this.props.distributionType = config.value.distributionType;
    this.props.propertyAggregation = config.value.propertyAggregation;
    this.props.propertyIds = config.value.propertyIds;

    return success(undefined);
  }
}

/** Plain, detached projection of validated state, distinct from raw persistence input. */
export type PollSnapshot = ReturnType<Poll['toJSON']>;
