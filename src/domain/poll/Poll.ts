import { Result, success, failure } from '../shared/Result';
import { Question, QuestionProps } from './Question';
import { PollDomainCodes } from './PollDomainCodes';

export interface PollProps {
  id: string;
  title: string;
  description: string;
  boardId: string;
  startDate: Date;
  endDate: Date;
  active: boolean;
  finished: boolean;
  participantsSnapshotTaken: boolean;
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
      active: false,
      finished: false,
      participantsSnapshotTaken: false,
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

  public get active(): boolean {
    return this.props.active;
  }

  public get finished(): boolean {
    return this.props.finished;
  }

  public get participantsSnapshotTaken(): boolean {
    return this.props.participantsSnapshotTaken;
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

  public isFinished(): boolean {
    return this.props.finished;
  }

  public isActive(): boolean {
    return this.props.active;
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

  public activate(): Result<void, string> {
    if (this.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_ACTIVATE_FINISHED);
    }

    if (this.isActive()) {
      return failure(PollDomainCodes.POLL_ALREADY_ACTIVE);
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

    this.props.active = true;

    return success(undefined);
  }

  public deactivate(): Result<void, string> {
    if (this.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_DEACTIVATE_FINISHED);
    }

    if (!this.isActive()) {
      return failure(PollDomainCodes.POLL_ALREADY_INACTIVE);
    }

    this.props.active = false;

    return success(undefined);
  }

  public finish(): Result<void, string> {
    if (this.isFinished()) {
      return failure(PollDomainCodes.POLL_ALREADY_FINISHED);
    }

    this.props.finished = true;
    this.props.active = false;

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

  public toJSON(): Omit<PollProps, 'questions'> & { questions: any[] } {
    return {
      ...this.props,
      questions: this.props.questions.map((q) => q.toJSON()),
    };
  }

  /**
   * Mark that participants snapshot has been taken
   * This should only be called once when the poll is first activated
   */
  public takeParticipantsSnapshot(): void {
    this.props.participantsSnapshotTaken = true;
  }

  /**
   * Check if participants can be modified
   * Participants can be modified if snapshot has been taken but no votes exist
   */
  public canModifyParticipants(hasVotes: boolean): boolean {
    return this.props.participantsSnapshotTaken && !hasVotes;
  }

  /**
   * Set weight criteria for the poll
   */
  public setWeightCriteria(criteria: string | null): void {
    this.props.weightCriteria = criteria;
  }
}
