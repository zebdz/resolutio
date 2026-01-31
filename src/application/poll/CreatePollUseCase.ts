import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { PollErrors } from './PollErrors';

export interface CreatePollInput {
  title: string;
  description: string;
  boardId: string;
  createdBy: string;
  startDate: Date;
  endDate: Date;
}

export class CreatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private boardRepository: BoardRepository
  ) {}

  async execute(input: CreatePollInput): Promise<Result<Poll, string>> {
    // 1. Check if board exists
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(PollErrors.BOARD_NOT_FOUND);
    }

    // 2. Check if user is a board member
    const isMember = await this.boardRepository.isUserMember(
      input.createdBy,
      input.boardId
    );

    if (!isMember) {
      return failure(PollErrors.NOT_BOARD_MEMBER);
    }

    // 3. Create poll domain object with validation
    const pollResult = Poll.create(
      input.title,
      input.description,
      input.boardId,
      input.createdBy,
      input.startDate,
      input.endDate
    );

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    // 4. Persist the validated domain object
    const result = await this.pollRepository.createPoll(pollResult.value);

    return result;
  }
}
