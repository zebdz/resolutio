/** Shared lifecycle fixtures construct valid polls through the public domain API.
 * Content, identities and positions are validated before aggregate creation. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import {
  PageNumber,
  SortOrder,
  QuestionText,
  AnswerText,
} from '@/domain/poll/QuestionValues';
import { UserId } from '@/domain/shared/EntityIds';
import { BoardId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PollId, QuestionId, AnswerId } from '@/domain/shared/EntityIds';
import { pollFixtureCreation } from '@/application/poll/__tests__/pollFixtureCreation';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollState } from '../../../domain/poll/PollState';

/**
 * Creates a poll in DRAFT state with a question and answer
 */
export function createDraftPoll(
  id: string,
  boardId: string,
  createdBy: string
): Poll {
  const pollResult = Poll.create(
    PollTitle.parse('Test Poll'),
    PollDescription.parse('Test Description'),
    OrganizationId.parse('org-1'),
    BoardId.parse(boardId),
    UserId.parse(createdBy),
    expectSuccess(
      PollPeriod.create(new Date('2024-01-01'), new Date('2024-12-31'))
    ),
    pollFixtureCreation(PollId)
  );
  let poll = expectSuccess(pollResult);
  poll = Poll.reconstitute({
    ...poll.toJSON(),
    questions: poll.questions,
    id: id,
  });

  // Add question with answer
  const questionResult = Question.create(
    QuestionText.parse('Question 1'),
    PollId.parse(id),
    pollFixtureCreation(QuestionId),
    PageNumber.parse(1),
    SortOrder.parse(1),
    'single-choice'
  );
  let question = expectSuccess(questionResult);
  question = Question.reconstitute({
    ...question.toJSON(),
    answers: question.answers,
    id: `${id}-question-1`,
  });
  const answerResult = Answer.create(
    AnswerText.parse('Answer 1'),
    SortOrder.parse(1),
    question.id,
    pollFixtureCreation(AnswerId)
  );
  question.addAnswer(expectSuccess(answerResult));
  poll.addQuestion(question);

  return poll;
}

/**
 * Creates a poll in READY state (snapshot taken)
 */
export function createReadyPoll(
  id: string,
  boardId: string,
  createdBy: string
): Poll {
  const poll = createDraftPoll(id, boardId, createdBy);
  poll.submitToAdmin();
  poll.takeSnapshot();

  return poll;
}

/**
 * Creates a poll in ACTIVE state
 */
export function createActivePoll(
  id: string,
  boardId: string,
  createdBy: string
): Poll {
  const poll = createReadyPoll(id, boardId, createdBy);
  poll.activate();

  return poll;
}

/**
 * Creates a poll in FINISHED state
 */
export function createFinishedPoll(
  id: string,
  boardId: string,
  createdBy: string
): Poll {
  const poll = createActivePoll(id, boardId, createdBy);
  poll.finish(PollInstant.parse(new Date().toISOString()));

  return poll;
}
