import { Result, success, failure } from '../shared/Result';
import { Question, QuestionProps } from './Question';
import { Answer } from './Answer';
import { PollDomainCodes } from './PollDomainCodes';
import { PollState } from './PollState';

export interface PollProps {
  id: string;
  title: string;
  description: string;
  boardId: string;
  startDate: Date;
  endDate: Date;
  state: PollState;
  weightCriteria: string | null;
  createdBy: string;
  createdAt: Date;
  archivedAt: Date | null;
  questions: Question[];
}

export class Poll {
  private constructor(private props: PollProps) {}

  public static create(
    title: string,
    description: string,
    boardId: string,
    createdBy: string,
    startDate: Date,
    endDate: Date
  ): Result<Poll, string> {
    // Validate title
    if (!title || title.trim().length === 0) {
      return failure(PollDomainCodes.POLL_TITLE_EMPTY);
    }

    if (title.length > 500) {
      return failure(PollDomainCodes.POLL_TITLE_TOO_LONG);
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      return failure(PollDomainCodes.POLL_DESCRIPTION_EMPTY);
    }

    if (description.length > 5000) {
      return failure(PollDomainCodes.POLL_DESCRIPTION_TOO_LONG);
    }

    // Validate dates
    if (startDate >= endDate) {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }

    const poll = new Poll({
      id: '',
      title: title.trim(),
      description: description.trim(),
      boardId,
      startDate,
      endDate,
      state: PollState.DRAFT,
      weightCriteria: null,
      createdBy,
      createdAt: new Date(),
      archivedAt: null,
      questions: [],
    });

    return success(poll);
  }

  public static reconstitute(props: PollProps): Poll {
    return new Poll(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get title(): string {
    return this.props.title;
  }

  public get description(): string {
    return this.props.description;
  }

  public get boardId(): string {
    return this.props.boardId;
  }

  public get startDate(): Date {
    return this.props.startDate;
  }

  public get endDate(): Date {
    return this.props.endDate;
  }

  public get state(): PollState {
    return this.props.state;
  }

  public get weightCriteria(): string | null {
    return this.props.weightCriteria;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  public get questions(): Question[] {
    return [...this.props.questions];
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public isDraft(): boolean {
    return this.props.state === PollState.DRAFT;
  }

  public isReady(): boolean {
    return this.props.state === PollState.READY;
  }

  public isActive(): boolean {
    return this.props.state === PollState.ACTIVE;
  }

  public isFinished(): boolean {
    return this.props.state === PollState.FINISHED;
  }

  /**
   * Check if this poll can be edited
   * A poll can only be edited if:
   * - It is not active
   * - It is not finished
   * - It has no votes
   */
  public canEdit(hasVotes: boolean): Result<boolean, string> {
    if (this.isActive()) {
      return success(false);
    }

    if (this.isFinished()) {
      return success(false);
    }

    if (hasVotes) {
      return success(false);
    }

    return success(true);
  }

  public updateTitle(newTitle: string): Result<void, string> {
    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    }

    if (!newTitle || newTitle.trim().length === 0) {
      return failure(PollDomainCodes.POLL_TITLE_EMPTY);
    }

    if (newTitle.length > 500) {
      return failure(PollDomainCodes.POLL_TITLE_TOO_LONG);
    }

    this.props.title = newTitle.trim();

    return success(undefined);
  }

  public updateDescription(newDescription: string): Result<void, string> {
    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    }

    if (!newDescription || newDescription.trim().length === 0) {
      return failure(PollDomainCodes.POLL_DESCRIPTION_EMPTY);
    }

    if (newDescription.length > 5000) {
      return failure(PollDomainCodes.POLL_DESCRIPTION_TOO_LONG);
    }

    this.props.description = newDescription.trim();

    return success(undefined);
  }

  public updateDates(startDate: Date, endDate: Date): Result<void, string> {
    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    }

    if (startDate >= endDate) {
      return failure(PollDomainCodes.POLL_INVALID_DATES);
    }

    this.props.startDate = startDate;
    this.props.endDate = endDate;

    return success(undefined);
  }

  /**
   * Take snapshot: DRAFT → READY
   * Validates poll has questions with answers before transitioning
   */
  public takeSnapshot(): Result<void, string> {
    if (!this.isDraft()) {
      return failure(PollDomainCodes.POLL_MUST_BE_DRAFT);
    }

    // Check poll has at least one non-archived question
    const activeQuestions = this.props.questions.filter((q) => !q.isArchived());

    if (activeQuestions.length === 0) {
      return failure(PollDomainCodes.POLL_NO_QUESTIONS);
    }

    // Check each active question has at least one non-archived answer
    for (const question of activeQuestions) {
      const activeAnswers = question.answers.filter((a) => !a.isArchived());

      if (activeAnswers.length === 0) {
        return failure(PollDomainCodes.POLL_QUESTION_NO_ANSWERS);
      }
    }

    this.props.state = PollState.READY;

    return success(undefined);
  }

  /**
   * Discard snapshot: READY → DRAFT
   * Only allowed if no votes have been cast
   */
  public discardSnapshot(hasVotes: boolean): Result<void, string> {
    if (!this.isReady()) {
      return failure(PollDomainCodes.POLL_MUST_BE_READY);
    }

    if (hasVotes) {
      return failure(PollDomainCodes.POLL_CANNOT_DISCARD_SNAPSHOT_HAS_VOTES);
    }

    this.props.state = PollState.DRAFT;

    return success(undefined);
  }

  /**
   * Activate: READY → ACTIVE
   */
  public activate(): Result<void, string> {
    if (!this.isReady()) {
      return failure(PollDomainCodes.POLL_MUST_BE_READY);
    }

    this.props.state = PollState.ACTIVE;

    return success(undefined);
  }

  /**
   * Deactivate: ACTIVE → READY
   */
  public deactivate(): Result<void, string> {
    if (!this.isActive()) {
      return failure(PollDomainCodes.POLL_MUST_BE_ACTIVE);
    }

    this.props.state = PollState.READY;

    return success(undefined);
  }

  /**
   * Finish: ACTIVE → FINISHED
   */
  public finish(): Result<void, string> {
    if (!this.isActive()) {
      return failure(PollDomainCodes.POLL_MUST_BE_ACTIVE);
    }

    this.props.state = PollState.FINISHED;

    return success(undefined);
  }

  public addQuestion(question: Question): Result<void, string> {
    if (this.isFinished() || this.isActive()) {
      return failure(PollDomainCodes.POLL_CANNOT_ADD_QUESTION_FINISHED);
    }

    if (this.isArchived()) {
      return failure(PollDomainCodes.POLL_CANNOT_ADD_QUESTION_ARCHIVED);
    }

    this.props.questions.push(question);

    return success(undefined);
  }

  public removeQuestion(questionId: string): Result<void, string> {
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
    const archiveResult = question.archive();

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.isArchived()) {
      return failure(PollDomainCodes.POLL_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = new Date();

    return success(undefined);
  }

  /**
   * Add an answer to a question through the aggregate root
   * Validates poll state before delegating to the question
   */
  public addAnswerToQuestion(
    questionId: string,
    text: string,
    order: number
  ): Result<Answer, string> {
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

    // Create the answer
    const answerResult = Answer.create(text, order, questionId);

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

  public toJSON(): Omit<PollProps, 'questions'> & { questions: any[] } {
    return {
      ...this.props,
      questions: this.props.questions.map((q) => q.toJSON()),
    };
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
}
