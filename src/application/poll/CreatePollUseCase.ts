import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollErrors } from './PollErrors';

export interface CreatePollInput {
  title: string;
  description: string;
  organizationId: string;
  boardId: string | null;
  createdBy: string;
  startDate: Date;
  endDate: Date;
}

export class CreatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository
  ) {}

  async execute(input: CreatePollInput): Promise<Result<Poll, string>> {
    // 1. If boardId provided, validate board exists and check board membership
    if (input.boardId) {
      const board = await this.boardRepository.findById(input.boardId);

      if (!board) {
        return failure(PollErrors.BOARD_NOT_FOUND);
      }

      const isMember = await this.boardRepository.isUserMember(
        input.createdBy,
        input.boardId
      );

      if (!isMember) {
        return failure(PollErrors.NOT_BOARD_MEMBER);
      }
    } else {
      // Org-wide poll: check org membership
      const isMember = await this.organizationRepository.isUserMember(
        input.createdBy,
        input.organizationId
      );

      if (!isMember) {
        return failure(PollErrors.NOT_ORG_MEMBER);
      }
    }

    // 2. Create poll domain object with validation
    const pollResult = Poll.create(
      input.title,
      input.description,
      input.organizationId,
      input.boardId,
      input.createdBy,
      input.startDate,
      input.endDate
    );

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    // 3. Persist the validated domain object
    const result = await this.pollRepository.createPoll(pollResult.value);

    return result;
  }
}
