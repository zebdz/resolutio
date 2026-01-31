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
    'Test Poll',
    'Test Description',
    boardId,
    createdBy,
    new Date('2024-01-01'),
    new Date('2024-12-31')
  );
  const poll = pollResult.value;
  (poll as any).props.id = id;

  // Add question with answer
  const questionResult = Question.create(
    'Question 1',
    id,
    1,
    1,
    'single-choice'
  );
  const question = questionResult.value;
  (question as any).props.id = `${id}-question-1`;
  const answerResult = Answer.create('Answer 1', 1, question.id);
  question.addAnswer(answerResult.value);
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
  poll.finish();

  return poll;
}
