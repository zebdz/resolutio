/** Compile-only clients ensure question/answer identities and constrained positions
 * stay distinct while raw persistence DTOs remain explicit boundaries. */
import { Question } from '../Question';
import { Poll } from '../Poll';
import { Answer } from '../Answer';
import { QuestionRepository } from '../QuestionRepository';
import { AnswerRepository } from '../AnswerRepository';
import {
  PageNumber,
  SortOrder,
  QuestionText,
  AnswerText,
  QuestionDetails,
} from '../QuestionValues';
import { PollId, QuestionId, AnswerId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';

declare const questions: QuestionRepository;
declare const answers: AnswerRepository;
declare const question: Question;
const pollId = PollId.parse('poll-1');
const questionId = QuestionId.parse('question-1');
const answerId = AnswerId.parse('answer-1');
const at = Instant.parse('2026-01-01T00:00:00.000Z');
Question.create(
  QuestionText.parse('Choose'),
  pollId,
  testCreation(QuestionId, 'question-1')
);
Answer.create(
  AnswerText.parse('Yes'),
  SortOrder.parse(0),
  questionId,
  testCreation(AnswerId, 'answer-1')
);
questions.updateQuestionOrder([
  { questionId, page: PageNumber.parse(1), order: SortOrder.parse(0) },
]);
question.removeAnswer(answerId, at);

// @ts-expect-error A poll cannot be used as question identity.
answers.getAnswersByQuestionId(pollId);
// @ts-expect-error A question cannot be used as answer identity.
answers.getAnswerById(questionId);
// @ts-expect-error The domain requires an explicit creation context.
Question.create(QuestionText.parse('Choose'), pollId);
// @ts-expect-error Page and sort order have distinct meanings.
const wrongPage: PageNumber = SortOrder.parse(1);
// @ts-expect-error Raw numbers have not passed page validation.
const rawPage: PageNumber = 1;
// @ts-expect-error Raw strings have not passed text validation.
const rawQuestion: QuestionText = 'Choose';
// @ts-expect-error Answer and question texts are distinct concepts.
const wrongText: AnswerText = QuestionText.parse('Choose');
// @ts-expect-error Archive time must be explicit and immutable.
question.archive(new Date());

// Public factories/transitions must preserve position units, not just storage.
declare const answer: Answer;
// @ts-expect-error Aggregate answer creation must preserve the answer-content unit.
const wrongAggregateContent: Parameters<Poll['addAnswerToQuestion']>[1] =
  QuestionText.parse('Choose');
// @ts-expect-error Factories must require validated content, not arbitrary strings.
Question.create('Unchecked', pollId, testCreation(QuestionId, 'question-1'));
Answer.create(
  // @ts-expect-error Answer factories must reject question content despite identical representation.
  QuestionText.parse('Choose'),
  SortOrder.parse(0),
  questionId,
  testCreation(AnswerId, 'answer-1')
);
// @ts-expect-error Question edits cannot accept an answer label.
question.updateText(AnswerText.parse('Yes'));
// @ts-expect-error Details and question text are separate constrained concepts.
question.updateDetails(QuestionText.parse('Choose'));
// @ts-expect-error Answer edits cannot accept unchecked text.
answer.updateText('Unchecked');
question.updateText(QuestionText.parse('Choose'));
question.updateDetails(QuestionDetails.parse('Details'));
answer.updateText(AnswerText.parse('Yes'));
question.updatePage(PageNumber.parse(2));
question.updateOrder(SortOrder.parse(1));
answer.updateOrder(SortOrder.parse(1));
// @ts-expect-error A sort order cannot be used as a question page.
question.updatePage(SortOrder.parse(2));
// @ts-expect-error A page cannot be used as a question sort order.
question.updateOrder(PageNumber.parse(2));
// @ts-expect-error A page cannot be used as an answer sort order.
answer.updateOrder(PageNumber.parse(2));
Question.create(
  QuestionText.parse('Choose'),
  pollId,
  testCreation(QuestionId, 'question-1'),
  // @ts-expect-error Factory inputs must preserve the page unit too.
  SortOrder.parse(2)
);
Answer.create(
  AnswerText.parse('Yes'),
  // @ts-expect-error Factory inputs must preserve the sort-order unit too.
  PageNumber.parse(2),
  questionId,
  testCreation(AnswerId, 'answer-1')
);
