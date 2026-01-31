import {
  Prisma,
  PrismaClient,
  PollState as PrismaPollState,
} from '@/generated/prisma/client';
import { Poll } from '../../domain/poll/Poll';
import { PollState } from '../../domain/poll/PollState';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaParticipantRepository implements ParticipantRepository {
  constructor(private prisma: PrismaClient) {}

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

  async deleteParticipantsByPollId(
    pollId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.pollParticipant.deleteMany({
        where: { pollId },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete participants: ${error}`);
    }
  }

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

  async executeActivation(
    poll: Poll,
    participants: PollParticipant[],
    historyRecords: ParticipantWeightHistory[]
  ): Promise<Result<PollParticipant[], string>> {
    try {
      const savedParticipants = await this.prisma.$transaction(async (tx) => {
        // 1. Create participants
        if (participants.length > 0) {
          await tx.pollParticipant.createMany({
            data: participants.map((p) => ({
              pollId: p.pollId,
              userId: p.userId,
              userWeight: new Prisma.Decimal(p.userWeight),
              snapshotAt: p.snapshotAt,
            })),
          });
        }

        // 2. Fetch created participants to get IDs
        const createdParticipants = await tx.pollParticipant.findMany({
          where: { pollId: poll.id },
          orderBy: { createdAt: 'asc' },
        });

        // 3. Create weight history records with participant IDs
        if (historyRecords.length > 0) {
          const historyData = historyRecords.map((h, idx) => ({
            participantId: createdParticipants[idx]?.id || h.participantId,
            pollId: h.pollId,
            userId: h.userId,
            oldWeight: new Prisma.Decimal(h.oldWeight),
            newWeight: new Prisma.Decimal(h.newWeight),
            changedBy: h.changedBy,
            reason: h.reason,
          }));

          await tx.participantWeightHistory.createMany({
            data: historyData,
          });
        }

        // 4. Update poll
        await tx.poll.update({
          where: { id: poll.id },
          data: {
            title: poll.title,
            description: poll.description,
            startDate: poll.startDate,
            endDate: poll.endDate,
            state: this.toPrismaState(poll.state),
            weightCriteria: poll.weightCriteria,
            archivedAt: poll.archivedAt,
          },
        });

        return createdParticipants;
      });

      return success(savedParticipants.map((p) => this.toDomainParticipant(p)));
    } catch (error) {
      return failure(`Failed to execute activation: ${error}`);
    }
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

  private toPrismaState(domainState: PollState): PrismaPollState {
    const stateMap: Record<PollState, PrismaPollState> = {
      [PollState.DRAFT]: PrismaPollState.DRAFT,
      [PollState.READY]: PrismaPollState.READY,
      [PollState.ACTIVE]: PrismaPollState.ACTIVE,
      [PollState.FINISHED]: PrismaPollState.FINISHED,
    };

    return stateMap[domainState];
  }
}
