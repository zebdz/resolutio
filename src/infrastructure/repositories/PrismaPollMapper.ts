/** Shared Prisma/domain mapping for ordinary poll persistence and transaction scopes.
 * Validates persisted choices/revisions and keeps ORM shapes out of core ports. */
import {
  Prisma,
  Poll as PrismaPoll,
  Question as PrismaQuestion,
  Answer as PrismaAnswer,
  PollState as PrismaPollState,
  PollType as PrismaPollType,
} from '@/generated/prisma/client';
import { Poll } from '@/domain/poll/Poll';
import { Question } from '@/domain/poll/Question';
import { Answer } from '@/domain/poll/Answer';
import { PollState } from '@/domain/poll/PollState';
import { PollType, parsePollType } from '@/domain/poll/PollType';
import { isValidQuestionType } from '@/domain/poll/QuestionType';
import { PollRevision } from '@/domain/poll/PollRevision';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { PollWriteError } from './PollWriteLock';

type QuestionRow = PrismaQuestion & { answers?: PrismaAnswer[] };
type PollRow = PrismaPoll & {
  questions?: QuestionRow[];
  properties?: { propertyId: string }[];
  attachments?: { id: string }[];
};

export const editablePollInclude = {
  questions: {
    where: { archivedAt: null },
    include: {
      answers: { where: { archivedAt: null }, orderBy: { order: 'asc' } },
    },
    orderBy: [{ page: 'asc' }, { order: 'asc' }],
  },
  properties: true,
  // Ids only — never `bytes`. The description renderer needs the id
  // allowlist so it can refuse refs to other polls' files; file
  // content is served solely by the download route.
  attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PollInclude;

export function pollUpdateData(poll: Poll): Prisma.PollUpdateInput {
  return {
    title: poll.title,
    description: poll.description,
    startDate: poll.startDate,
    endDate: poll.endDate,
    pollType: toPrismaPollType(poll.pollType),
    state: toPrismaState(poll.state),
    finishedAt: poll.finishedAt,
    weightCriteria: poll.weightCriteria,
    distributionType: poll.distributionType,
    propertyAggregation: poll.propertyAggregation,
    // The domain exposes no mutator, so this only ever rewrites the
    // value it loaded — it exists so a round-trip cannot drop the flag.
    anonymous: poll.isAnonymous(),
    archivedAt: poll.archivedAt,
  };
}

export function toDomainPoll(prismaData: PollRow): Poll {
  const questions = prismaData.questions
    ? prismaData.questions.map((q) => toDomainQuestion(q))
    : [];

  return Poll.reconstitute({
    id: prismaData.id,
    title: prismaData.title,
    description: prismaData.description,
    organizationId: prismaData.organizationId,
    boardId: prismaData.boardId,
    pollType: toDomainPollType(prismaData.pollType),
    startDate: prismaData.startDate,
    endDate: prismaData.endDate,
    state: toDomainState(prismaData.state),
    finishedAt: prismaData.finishedAt ?? null,
    revision: PollRevision.parse(prismaData.revision ?? 0),
    weightCriteria: prismaData.weightCriteria || null,
    distributionType: prismaData.distributionType,
    propertyAggregation: prismaData.propertyAggregation,
    propertyIds: (prismaData.properties ?? []).map(
      (p: { propertyId: string }) => p.propertyId
    ),
    anonymous: prismaData.anonymous ?? false,
    createdBy: prismaData.createdBy,
    createdAt: prismaData.createdAt,
    archivedAt: prismaData.archivedAt,
    questions,
    attachmentIds: (prismaData.attachments ?? []).map(
      (a: { id: string }) => a.id
    ),
  });
}

function toDomainState(prismaState: PrismaPollState): PollState {
  switch (prismaState) {
    case 'DRAFT':
      return PollState.DRAFT;
    case 'SUBMITTED':
      return PollState.SUBMITTED;
    case 'READY':
      return PollState.READY;
    case 'ACTIVE':
      return PollState.ACTIVE;
    case 'FINISHED':
      return PollState.FINISHED;
  }
}

export function toPrismaState(domainState: PollState): PrismaPollState {
  switch (domainState) {
    case PollState.DRAFT:
      return 'DRAFT';
    case PollState.SUBMITTED:
      return 'SUBMITTED';
    case PollState.READY:
      return 'READY';
    case PollState.ACTIVE:
      return 'ACTIVE';
    case PollState.FINISHED:
      return 'FINISHED';
  }
}

function toDomainPollType(prismaPollType: PrismaPollType): PollType {
  switch (prismaPollType) {
    case 'ORGANIZATION':
      return PollType.ORGANIZATION;
    case 'OPEN':
      return PollType.OPEN;
  }
}

export function toPrismaPollType(domainPollType: string): PrismaPollType {
  const parsed = parsePollType(domainPollType);

  if (!parsed.success) {
    throw new PollWriteError(PollDomainCodes.POLL_TYPE_INVALID);
  }

  return parsed.value;
}

function toDomainQuestion(prismaData: QuestionRow): Question {
  if (!isValidQuestionType(prismaData.questionType)) {
    throw new PollWriteError(PollDomainCodes.QUESTION_INVALID_TYPE);
  }

  const answers = prismaData.answers
    ? prismaData.answers.map((a) => toDomainAnswer(a))
    : [];

  return Question.reconstitute({
    id: prismaData.id,
    text: prismaData.text,
    details: prismaData.details,
    pollId: prismaData.pollId,
    page: prismaData.page,
    order: prismaData.order,
    questionType: prismaData.questionType,
    createdAt: prismaData.createdAt,
    archivedAt: prismaData.archivedAt,
    answers,
  });
}

function toDomainAnswer(prismaData: PrismaAnswer): Answer {
  return Answer.reconstitute({
    id: prismaData.id,
    text: prismaData.text,
    order: prismaData.order,
    questionId: prismaData.questionId,
    createdAt: prismaData.createdAt,
    archivedAt: prismaData.archivedAt,
  });
}
