import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Poll } from '../../domain/poll/Poll';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import { Vote } from '../../domain/poll/Vote';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../domain/poll/PollRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { QuestionType } from '../../domain/poll/QuestionType';

export class PrismaPollRepository implements PollRepository {
  constructor(private prisma: PrismaClient) {}

  // Poll operations
  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    try {
      // Persist the already-validated domain model
      const created = await this.prisma.poll.create({
        data: {
          title: poll.title,
          description: poll.description,
          boardId: poll.boardId,
          createdBy: poll.createdBy,
          startDate: poll.startDate,
          endDate: poll.endDate,
          active: false,
          finished: false,
          participantsSnapshotTaken: false,
          weightCriteria: poll.weightCriteria,
        },
        include: {
          questions: {
            include: {
              answers: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
        },
      });

      return success(this.toDomainPoll(created));
    } catch (error) {
      return failure(`Failed to create poll: ${error}`);
    }
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    try {
      const poll = await this.prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
        },
      });

      if (!poll) {
        return success(null);
      }

      return success(this.toDomainPoll(poll));
    } catch (error) {
      return failure(`Failed to get poll: ${error}`);
    }
  }

  async getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>> {
    try {
      const polls = await this.prisma.poll.findMany({
        where: {
          boardId,
          archivedAt: null,
        },
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      return failure(`Failed to get polls by board: ${error}`);
    }
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
    try {
      // Get polls from boards where the user is a member
      const polls = await this.prisma.poll.findMany({
        where: {
          board: {
            members: {
              some: {
                userId,
                removedAt: null,
              },
            },
          },
          archivedAt: null,
        },
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      return failure(`Failed to get polls by user: ${error}`);
    }
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    try {
      await this.prisma.poll.update({
        where: { id: poll.id },
        data: {
          title: poll.title,
          description: poll.description,
          startDate: poll.startDate,
          endDate: poll.endDate,
          active: poll.active,
          finished: poll.finished,
          participantsSnapshotTaken: poll.participantsSnapshotTaken,
          weightCriteria: poll.weightCriteria,
          archivedAt: poll.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update poll: ${error}`);
    }
  }

  async deletePoll(pollId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.poll.update({
        where: { id: pollId },
        data: { archivedAt: new Date() },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete poll: ${error}`);
    }
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    try {
      // Check if any votes exist for questions belonging to this poll
      const voteCount = await this.prisma.vote.count({
        where: {
          question: {
            pollId: pollId,
          },
        },
      });

      return success(voteCount > 0);
    } catch (error) {
      return failure(`Failed to check poll votes: ${error}`);
    }
  }

  // Question operations
  async createQuestion(question: Question): Promise<Result<Question, string>> {
    try {
      // Persist the already-validated domain model
      const created = await this.prisma.question.create({
        data: {
          text: question.text,
          details: question.details,
          pollId: question.pollId,
          page: question.page,
          order: question.order,
          questionType: question.questionType,
        },
        include: {
          answers: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
          },
        },
      });

      return success(this.toDomainQuestion(created));
    } catch (error) {
      return failure(`Failed to create question: ${error}`);
    }
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    try {
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: {
          answers: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!question) {
        return success(null);
      }

      return success(this.toDomainQuestion(question));
    } catch (error) {
      return failure(`Failed to get question: ${error}`);
    }
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], string>> {
    try {
      const questions = await this.prisma.question.findMany({
        where: {
          pollId,
          archivedAt: null,
        },
        include: {
          answers: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: [{ page: 'asc' }, { order: 'asc' }],
      });

      return success(questions.map((q) => this.toDomainQuestion(q)));
    } catch (error) {
      return failure(`Failed to get questions: ${error}`);
    }
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    try {
      await this.prisma.question.update({
        where: { id: question.id },
        data: {
          text: question.text,
          details: question.details,
          page: question.page,
          order: question.order,
          questionType: question.questionType,
          archivedAt: question.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update question: ${error}`);
    }
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    try {
      // Use a transaction to update all questions atomically
      await this.prisma.$transaction(
        updates.map((update) =>
          this.prisma.question.update({
            where: { id: update.questionId },
            data: {
              page: update.page,
              order: update.order,
            },
          })
        )
      );

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update question order: ${error}`);
    }
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.question.update({
        where: { id: questionId },
        data: { archivedAt: new Date() },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete question: ${error}`);
    }
  }

  // Answer operations
  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    try {
      // Persist the already-validated domain model
      const created = await this.prisma.answer.create({
        data: {
          text: answer.text,
          order: answer.order,
          questionId: answer.questionId,
        },
      });

      return success(this.toDomainAnswer(created));
    } catch (error) {
      return failure(`Failed to create answer: ${error}`);
    }
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, string>> {
    try {
      const answer = await this.prisma.answer.findUnique({
        where: { id: answerId },
      });

      if (!answer) {
        return success(null);
      }

      return success(this.toDomainAnswer(answer));
    } catch (error) {
      return failure(`Failed to get answer: ${error}`);
    }
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], string>> {
    try {
      const answers = await this.prisma.answer.findMany({
        where: {
          questionId,
          archivedAt: null,
        },
        orderBy: { order: 'asc' },
      });

      return success(answers.map((a) => this.toDomainAnswer(a)));
    } catch (error) {
      return failure(`Failed to get answers: ${error}`);
    }
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    try {
      await this.prisma.answer.update({
        where: { id: answer.id },
        data: {
          text: answer.text,
          order: answer.order,
          archivedAt: answer.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update answer: ${error}`);
    }
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.answer.update({
        where: { id: answerId },
        data: { archivedAt: new Date() },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete answer: ${error}`);
    }
  }

  // Vote operations
  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    try {
      const created = await this.prisma.vote.create({
        data: {
          questionId: vote.questionId,
          answerId: vote.answerId,
          userId: vote.userId,
          userWeight: new Prisma.Decimal(vote.userWeight),
        },
      });

      return success(this.toDomainVote(created));
    } catch (error) {
      return failure(`Failed to create vote: ${error}`);
    }
  }

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    try {
      await this.prisma.vote.createMany({
        data: votes.map((vote) => ({
          questionId: vote.questionId,
          answerId: vote.answerId,
          userId: vote.userId,
          userWeight: new Prisma.Decimal(vote.userWeight),
        })),
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to create votes: ${error}`);
    }
  }

  async getUserVotes(
    pollId: string,
    userId: string
  ): Promise<Result<Vote[], string>> {
    try {
      const votes = await this.prisma.vote.findMany({
        where: {
          userId,
          question: {
            pollId,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return success(votes.map((v) => this.toDomainVote(v)));
    } catch (error) {
      return failure(`Failed to get user votes: ${error}`);
    }
  }

  async hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    try {
      // Get count of non-archived questions in poll
      const totalQuestions = await this.prisma.question.count({
        where: {
          pollId,
          archivedAt: null,
        },
      });

      if (totalQuestions === 0) {
        return success(false);
      }

      // Get count of distinct questions user has voted on
      const votedQuestions = await this.prisma.vote.groupBy({
        by: ['questionId'],
        where: {
          userId,
          question: {
            pollId,
            archivedAt: null,
          },
        },
      });

      return success(votedQuestions.length === totalQuestions);
    } catch (error) {
      return failure(`Failed to check if user finished voting: ${error}`);
    }
  }

  async getVotesByPoll(pollId: string): Promise<Result<Vote[], string>> {
    try {
      const votes = await this.prisma.vote.findMany({
        where: {
          question: {
            pollId,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return success(votes.map((v) => this.toDomainVote(v)));
    } catch (error) {
      return failure(`Failed to get votes by poll: ${error}`);
    }
  }

  // Participant operations
  async createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.pollParticipant.createMany({
        data: participants.map((p) => ({
          pollId: p.pollId,
          userId: p.userId,
          userWeight: new Prisma.Decimal(p.userWeight),
          snapshotAt: p.snapshotAt,
        })),
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to create participants: ${error}`);
    }
  }

  async getParticipants(
    pollId: string
  ): Promise<Result<PollParticipant[], string>> {
    try {
      const participants = await this.prisma.pollParticipant.findMany({
        where: { pollId },
        orderBy: { createdAt: 'asc' },
      });

      return success(participants.map((p) => this.toDomainParticipant(p)));
    } catch (error) {
      return failure(`Failed to get participants: ${error}`);
    }
  }

  async getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>> {
    try {
      const participant = await this.prisma.pollParticipant.findUnique({
        where: { id: participantId },
      });

      if (!participant) {
        return success(null);
      }

      return success(this.toDomainParticipant(participant));
    } catch (error) {
      return failure(`Failed to get participant: ${error}`);
    }
  }

  async getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>> {
    try {
      const participant = await this.prisma.pollParticipant.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId,
          },
        },
      });

      if (!participant) {
        return success(null);
      }

      return success(this.toDomainParticipant(participant));
    } catch (error) {
      return failure(`Failed to get participant: ${error}`);
    }
  }

  async updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.pollParticipant.update({
        where: { id: participant.id },
        data: {
          userWeight: new Prisma.Decimal(participant.userWeight),
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update participant weight: ${error}`);
    }
  }

  async deleteParticipant(
    participantId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.pollParticipant.delete({
        where: { id: participantId },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete participant: ${error}`);
    }
  }

  // Weight history operations
  async createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, string>> {
    try {
      const created = await this.prisma.participantWeightHistory.create({
        data: {
          participantId: history.participantId,
          pollId: history.pollId,
          userId: history.userId,
          oldWeight: new Prisma.Decimal(history.oldWeight),
          newWeight: new Prisma.Decimal(history.newWeight),
          changedBy: history.changedBy,
          reason: history.reason,
        },
      });

      return success(this.toDomainWeightHistory(created));
    } catch (error) {
      return failure(`Failed to create weight history: ${error}`);
    }
  }

  async getWeightHistory(
    pollId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    try {
      const history = await this.prisma.participantWeightHistory.findMany({
        where: { pollId },
        orderBy: { changedAt: 'desc' },
      });

      return success(history.map((h) => this.toDomainWeightHistory(h)));
    } catch (error) {
      return failure(`Failed to get weight history: ${error}`);
    }
  }

  async getParticipantWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    try {
      const history = await this.prisma.participantWeightHistory.findMany({
        where: { participantId },
        orderBy: { changedAt: 'desc' },
      });

      return success(history.map((h) => this.toDomainWeightHistory(h)));
    } catch (error) {
      return failure(`Failed to get participant weight history: ${error}`);
    }
  }

  // Draft operations
  async saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>> {
    try {
      const created = await this.prisma.voteDraft.upsert({
        where: {
          pollId_questionId_userId_answerId: {
            pollId: draft.pollId,
            questionId: draft.questionId,
            userId: draft.userId,
            answerId: draft.answerId,
          },
        },
        create: {
          pollId: draft.pollId,
          questionId: draft.questionId,
          answerId: draft.answerId,
          userId: draft.userId,
        },
        update: {
          updatedAt: new Date(),
        },
      });

      return success(this.toDomainDraft(created));
    } catch (error) {
      return failure(`Failed to save draft: ${error}`);
    }
  }

  async getUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>> {
    try {
      const drafts = await this.prisma.voteDraft.findMany({
        where: {
          pollId,
          userId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      return success(drafts.map((d) => this.toDomainDraft(d)));
    } catch (error) {
      return failure(`Failed to get user drafts: ${error}`);
    }
  }

  async deleteUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: {
          pollId,
          userId,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete user drafts: ${error}`);
    }
  }

  async deleteAllPollDrafts(pollId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: { pollId },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete all poll drafts: ${error}`);
    }
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: {
          pollId,
          questionId,
          userId,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete drafts by question: ${error}`);
    }
  }

  async deleteDraftByAnswer(
    pollId: string,
    questionId: string,
    answerId: string,
    userId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: {
          pollId,
          questionId,
          answerId,
          userId,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete draft by answer: ${error}`);
    }
  }

  // Helper methods to convert Prisma models to domain entities
  private toDomainPoll(prismaData: any): Poll {
    const questions = prismaData.questions
      ? prismaData.questions.map((q: any) => this.toDomainQuestion(q))
      : [];

    return Poll.reconstitute({
      id: prismaData.id,
      title: prismaData.title,
      description: prismaData.description,
      boardId: prismaData.boardId,
      startDate: prismaData.startDate,
      endDate: prismaData.endDate,
      active: prismaData.active,
      finished: prismaData.finished,
      participantsSnapshotTaken: prismaData.participantsSnapshotTaken || false,
      weightCriteria: prismaData.weightCriteria || null,
      createdBy: prismaData.createdBy,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
      questions,
    });
  }

  private toDomainQuestion(prismaData: any): Question {
    const answers = prismaData.answers
      ? prismaData.answers.map((a: any) => this.toDomainAnswer(a))
      : [];

    return Question.reconstitute({
      id: prismaData.id,
      text: prismaData.text,
      details: prismaData.details,
      pollId: prismaData.pollId,
      page: prismaData.page,
      order: prismaData.order,
      questionType: prismaData.questionType as QuestionType,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
      answers,
    });
  }

  private toDomainAnswer(prismaData: any): Answer {
    return Answer.reconstitute({
      id: prismaData.id,
      text: prismaData.text,
      order: prismaData.order,
      questionId: prismaData.questionId,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
    });
  }

  private toDomainVote(prismaData: any): Vote {
    return Vote.reconstitute({
      id: prismaData.id,
      questionId: prismaData.questionId,
      answerId: prismaData.answerId,
      userId: prismaData.userId,
      userWeight: prismaData.userWeight.toNumber(),
      createdAt: prismaData.createdAt,
    });
  }

  private toDomainDraft(prismaData: any): VoteDraft {
    return VoteDraft.reconstitute({
      id: prismaData.id,
      pollId: prismaData.pollId,
      questionId: prismaData.questionId,
      answerId: prismaData.answerId,
      userId: prismaData.userId,
      createdAt: prismaData.createdAt,
      updatedAt: prismaData.updatedAt,
    });
  }

  private toDomainParticipant(prismaData: any): PollParticipant {
    return PollParticipant.reconstitute({
      id: prismaData.id,
      pollId: prismaData.pollId,
      userId: prismaData.userId,
      userWeight: prismaData.userWeight.toNumber(),
      snapshotAt: prismaData.snapshotAt,
      createdAt: prismaData.createdAt,
    });
  }

  private toDomainWeightHistory(prismaData: any): ParticipantWeightHistory {
    return ParticipantWeightHistory.reconstitute({
      id: prismaData.id,
      participantId: prismaData.participantId,
      pollId: prismaData.pollId,
      userId: prismaData.userId,
      oldWeight: prismaData.oldWeight.toNumber(),
      newWeight: prismaData.newWeight.toNumber(),
      changedBy: prismaData.changedBy,
      reason: prismaData.reason,
      changedAt: prismaData.changedAt,
    });
  }
}
