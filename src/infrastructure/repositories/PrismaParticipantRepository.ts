/** Persists participant snapshots and atomic ballots. Poll locks coordinate all
 * accepted ballots with lifecycle changes; receipt replay uses frozen cast data. */
import { DistributionType } from '@/domain/poll/DistributionType';
import { PropertyAggregation } from '@/domain/poll/PropertyAggregation';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { PropertyId } from '@/domain/shared/EntityIds';
import {
  Prisma,
  PrismaClient,
  PollState as PrismaPollState,
} from '@/generated/prisma/client';
import { PollId, UserId, ParticipantId } from '@/domain/poll/PollValues';
import { PollWriteFailure } from '@/domain/poll/PollWriteFailure';
import { Poll } from '../../domain/poll/Poll';
import { PollState } from '../../domain/poll/PollState';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { Vote } from '../../domain/poll/Vote';
import { Instant } from '../../domain/shared/Instant';
import {
  ParticipantRepository,
  ParticipantAddition,
  ParticipantRemoval,
  ParticipantReweighting,
} from '../../domain/poll/ParticipantRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { RecordedBallot } from '@/domain/poll/BallotSnapshot';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import {
  lockPoll,
  lockPollRevision,
  pollWriteError,
  PollWriteError,
} from './PollWriteLock';
import { PollRevision } from '@/domain/poll/PollRevision';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { readCastBallot, saveCastBallot } from './CastBallotTransaction';

export class PrismaParticipantRepository implements ParticipantRepository {
  constructor(private prisma: PrismaClient) {}

  async getCastBallot(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<RecordedBallot | null, PollWriteFailure>> {
    try {
      // The participant and vote-presence reads must see the same commit.
      // Otherwise a new original ballot can be misclassified as legacy.
      const ballot = await this.prisma.$transaction(
        (tx) => readCastBallot(tx, pollId, userId),
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
      );

      return success(ballot);
    } catch (error) {
      return failure(pollWriteError(error));
    }
  }

  async castVotes(
    participantId: ParticipantId,
    votes: Vote[],
    willingness: boolean,
    secret: ReceiptSecret
  ): Promise<Result<RecordedBallot, PollWriteFailure>> {
    try {
      const ballot = await this.prisma.$transaction(async (tx) => {
        const participant = await tx.pollParticipant.findUniqueOrThrow({
          where: { id: participantId },
        });
        await lockPoll(tx, PollId.parse(participant.pollId));
        const existing = await readCastBallot(
          tx,
          PollId.parse(participant.pollId),
          UserId.parse(participant.userId)
        );

        if (existing) {
          return existing;
        }

        return saveCastBallot(tx, participantId, votes, willingness, secret);
      });

      return success(ballot);
    } catch (error) {
      return failure(pollWriteError(error));
    }
  }

  async createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.pollParticipant.createMany({
        data: participants.map((p) => ({
          id: p.id,
          pollId: p.pollId,
          userId: p.userId,
          userWeight: new Prisma.Decimal(p.userWeight),
          snapshotAt: p.snapshotAt,
          createdAt: p.createdAt,
        })),
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to create participants:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getParticipants(
    pollId: PollId
  ): Promise<Result<PollParticipant[], PollWriteFailure>> {
    try {
      const participants = await this.prisma.pollParticipant.findMany({
        where: { pollId },
        orderBy: { createdAt: 'asc' },
      });

      return success(participants.map((p) => this.toDomainParticipant(p)));
    } catch (error) {
      console.error('Failed to get participants:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getParticipantById(
    participantId: ParticipantId
  ): Promise<Result<PollParticipant | null, PollWriteFailure>> {
    try {
      const participant = await this.prisma.pollParticipant.findUnique({
        where: { id: participantId },
      });

      if (!participant) {
        return success(null);
      }

      return success(this.toDomainParticipant(participant));
    } catch (error) {
      console.error('Failed to get participant:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getParticipantByUserAndPoll(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<PollParticipant | null, PollWriteFailure>> {
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
      console.error('Failed to get participant:', error);

      return failure('common.errors.unexpected');
    }
  }

  async updateParticipantWeight(
    participant: PollParticipant,
    history: ParticipantWeightHistory
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockPoll(tx, PollId.parse(participant.pollId));
        const current = await tx.poll.findUniqueOrThrow({
          where: { id: participant.pollId },
        });

        if (current.state !== 'READY') {
          throw new PollWriteError(PollDomainCodes.POLL_MUST_BE_READY);
        }

        if (
          await tx.vote.count({
            where: { question: { pollId: participant.pollId } },
          })
        ) {
          throw new PollWriteError(
            PollDomainCodes.CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES
          );
        }

        await tx.pollParticipant.update({
          where: { id: participant.id },
          data: {
            userWeight: new Prisma.Decimal(participant.userWeight),
          },
        });
        await tx.participantWeightHistory.create({
          data: {
            id: history.id,
            participantId: history.participantId,
            pollId: history.pollId,
            userId: history.userId,
            oldWeight: new Prisma.Decimal(history.oldWeight),
            newWeight: new Prisma.Decimal(history.newWeight),
            changedBy: history.changedBy,
            reason: history.reason,
            changedAt: history.changedAt,
          },
        });
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to update participant weight:', error);

      return failure(pollWriteError(error));
    }
  }

  async deleteParticipant(
    participantId: ParticipantId
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.pollParticipant.delete({
        where: { id: participantId },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete participant:', error);

      return failure('common.errors.unexpected');
    }
  }

  async updateWillingToSignProtocol(
    participantId: ParticipantId,
    willingToSignProtocol: boolean
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.pollParticipant.update({
        where: { id: participantId },
        data: { willingToSignProtocol },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to update willingToSignProtocol:', error);

      return failure('common.errors.unexpected');
    }
  }

  async deleteParticipantsByPollId(
    pollId: PollId
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.pollParticipant.deleteMany({
        where: { pollId },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete participants:', error);

      return failure('common.errors.unexpected');
    }
  }

  async createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, PollWriteFailure>> {
    try {
      const created = await this.prisma.participantWeightHistory.create({
        data: {
          id: history.id,
          participantId: history.participantId,
          pollId: history.pollId,
          userId: history.userId,
          oldWeight: new Prisma.Decimal(history.oldWeight),
          newWeight: new Prisma.Decimal(history.newWeight),
          changedBy: history.changedBy,
          reason: history.reason,
          changedAt: history.changedAt,
        },
      });

      return success(this.toDomainWeightHistory(created));
    } catch (error) {
      console.error('Failed to create weight history:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getWeightHistory(
    pollId: PollId
  ): Promise<Result<ParticipantWeightHistory[], PollWriteFailure>> {
    try {
      const history = await this.prisma.participantWeightHistory.findMany({
        where: { pollId },
        orderBy: { changedAt: 'desc' },
      });

      return success(history.map((h) => this.toDomainWeightHistory(h)));
    } catch (error) {
      console.error('Failed to get weight history:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getParticipantWeightHistory(
    participantId: ParticipantId
  ): Promise<Result<ParticipantWeightHistory[], PollWriteFailure>> {
    try {
      const history = await this.prisma.participantWeightHistory.findMany({
        where: { participantId },
        orderBy: { changedAt: 'desc' },
      });

      return success(history.map((h) => this.toDomainWeightHistory(h)));
    } catch (error) {
      console.error('Failed to get participant weight history:', error);

      return failure('common.errors.unexpected');
    }
  }

  async executeActivation(
    poll: Poll,
    participants: PollParticipant[],
    historyRecords: ParticipantWeightHistory[]
  ): Promise<Result<PollParticipant[], PollWriteFailure>> {
    try {
      const savedParticipants = await this.prisma.$transaction(async (tx) => {
        const current = await lockPollRevision(tx, poll);

        if (current.state !== 'SUBMITTED' || poll.state !== PollState.READY) {
          throw new PollWriteError(PollDomainCodes.POLL_STALE);
        }

        // 1. Create participants
        if (participants.length > 0) {
          await tx.pollParticipant.createMany({
            data: participants.map((p) => ({
              id: p.id,
              pollId: p.pollId,
              userId: p.userId,
              userWeight: new Prisma.Decimal(p.userWeight),
              snapshotAt: p.snapshotAt,
              createdAt: p.createdAt,
            })),
          });
        }

        // 2. Fetch the persisted snapshot using the supplied stable identities.
        const createdParticipants = await tx.pollParticipant.findMany({
          where: { pollId: poll.id },
          orderBy: { createdAt: 'asc' },
        });

        // 3. Create weight history records with participant IDs
        if (historyRecords.length > 0) {
          const historyData = historyRecords.map((h) => ({
            id: h.id,
            participantId: h.participantId,
            pollId: h.pollId,
            userId: h.userId,
            oldWeight: new Prisma.Decimal(h.oldWeight),
            newWeight: new Prisma.Decimal(h.newWeight),
            changedBy: h.changedBy,
            reason: h.reason,
            changedAt: h.changedAt,
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
      console.error('Failed to execute activation:', error);

      return failure(pollWriteError(error));
    }
  }

  async joinAndVote(
    participant: PollParticipant,
    history: ParticipantWeightHistory,
    votes: Vote[],
    willingToSignProtocol: boolean,
    receiptSecret: ReceiptSecret
  ): Promise<Result<RecordedBallot, PollWriteFailure>> {
    try {
      const ballot = await this.prisma.$transaction(async (tx) => {
        await lockPoll(tx, PollId.parse(participant.pollId));
        const existing = await readCastBallot(
          tx,
          PollId.parse(participant.pollId),
          UserId.parse(participant.userId)
        );

        if (existing) {
          return existing;
        }

        const poll = await tx.poll.findUniqueOrThrow({
          where: { id: participant.pollId },
        });

        if (poll.pollType !== 'OPEN') {
          throw new PollWriteError('domain.poll.notParticipant');
        }

        const saved = await tx.pollParticipant.upsert({
          where: {
            pollId_userId: {
              pollId: participant.pollId,
              userId: participant.userId,
            },
          },
          create: {
            id: participant.id,
            pollId: participant.pollId,
            userId: participant.userId,
            userWeight: new Prisma.Decimal(1),
            snapshotAt: participant.snapshotAt,
            createdAt: participant.createdAt,
          },
          update: {},
        });
        await tx.participantWeightHistory.create({
          data: {
            id: history.id,
            participantId: saved.id,
            pollId: participant.pollId,
            userId: participant.userId,
            oldWeight: 0,
            newWeight: 1,
            changedBy: participant.userId,
            reason: history.reason,
            changedAt: history.changedAt,
          },
        });

        return saveCastBallot(
          tx,
          ParticipantId.parse(saved.id),
          votes,
          willingToSignProtocol,
          receiptSecret
        );
      });

      return success(ballot);
    } catch (error) {
      return failure(pollWriteError(error));
    }
  }

  async pollHasVotes(
    pollId: PollId
  ): Promise<Result<boolean, PollWriteFailure>> {
    try {
      const vote = await this.prisma.vote.findFirst({
        where: { question: { pollId } },
      });

      return success(vote !== null);
    } catch (e) {
      return failure(pollWriteError(e));
    }
  }

  async applyWeightConfigChange(
    pollId: PollId,
    newDistributionType: DistributionType,
    newPropertyAggregation: PropertyAggregation,
    newPropertyIds: PropertyId[],
    add: ParticipantAddition[],
    remove: ParticipantRemoval[],
    update: ParticipantReweighting[],
    adminUserId: UserId,
    reason: string,
    expectedRevision: PollRevision
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockPoll(tx, PollId.parse(pollId));
        const current = await tx.poll.findUniqueOrThrow({
          where: { id: pollId },
        });

        if (current.revision !== expectedRevision) {
          throw new PollWriteError(PollDomainCodes.POLL_STALE);
        }

        if (current.state === 'ACTIVE' || current.state === 'FINISHED') {
          throw new PollWriteError(
            PollDomainCodes.WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION
          );
        }

        if (await tx.vote.count({ where: { question: { pollId } } })) {
          throw new PollWriteError(
            PollDomainCodes.VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG
          );
        }

        // 1. Update polls columns
        await tx.poll.update({
          where: { id: pollId },
          data: {
            distributionType: newDistributionType,
            propertyAggregation: newPropertyAggregation,
            revision: { increment: 1 },
          },
        });

        // 2. Replace poll_properties rows
        await tx.pollProperty.deleteMany({ where: { pollId } });

        if (newPropertyIds.length > 0) {
          await tx.pollProperty.createMany({
            data: newPropertyIds.map((propertyId) => ({ pollId, propertyId })),
          });
        }

        // 3. Deletes + history rows
        if (remove.length > 0) {
          await tx.pollParticipant.deleteMany({
            where: { id: { in: remove.map((r) => r.participantId) } },
          });
          await tx.participantWeightHistory.createMany({
            data: remove.map((r) => ({
              id: r.historyCreation.id,
              changedAt: Instant.toDate(r.historyCreation.now),
              participantId: r.participantId,
              pollId,
              userId: r.userId,
              oldWeight: r.oldWeight,
              newWeight: 0,
              changedBy: adminUserId,
              reason,
            })),
          });
        }

        // 4. Inserts + history rows
        for (const a of add) {
          const created = await tx.pollParticipant.create({
            data: {
              id: a.creation.id,
              createdAt: Instant.toDate(a.creation.now),
              snapshotAt: Instant.toDate(a.creation.now),
              pollId,
              userId: a.userId,
              userWeight: a.weight,
            },
          });
          await tx.participantWeightHistory.create({
            data: {
              id: a.historyCreation.id,
              changedAt: Instant.toDate(a.historyCreation.now),
              participantId: created.id,
              pollId,
              userId: a.userId,
              oldWeight: 0,
              newWeight: a.weight,
              changedBy: adminUserId,
              reason,
            },
          });
        }

        // 5. Weight updates + history rows
        for (const u of update) {
          await tx.pollParticipant.update({
            where: { id: u.participantId },
            data: { userWeight: u.newWeight },
          });
          await tx.participantWeightHistory.create({
            data: {
              id: u.historyCreation.id,
              changedAt: Instant.toDate(u.historyCreation.now),
              participantId: u.participantId,
              pollId,
              userId: u.userId,
              oldWeight: u.oldWeight,
              newWeight: u.newWeight,
              changedBy: adminUserId,
              reason,
            },
          });
        }
      });

      return success(undefined);
    } catch (e) {
      return failure(pollWriteError(e));
    }
  }

  private toDomainParticipant(
    prismaData: Prisma.PollParticipantGetPayload<object>
  ): PollParticipant {
    return PollParticipant.reconstitute({
      id: prismaData.id,
      pollId: prismaData.pollId,
      userId: prismaData.userId,
      userWeight: prismaData.userWeight.toNumber(),
      willingToSignProtocol: prismaData.willingToSignProtocol ?? null,
      receiptSecret:
        prismaData.receiptSecret == null
          ? null
          : ReceiptSecret.parse(prismaData.receiptSecret),
      snapshotAt: prismaData.snapshotAt,
      createdAt: prismaData.createdAt,
    });
  }

  private toDomainWeightHistory(
    prismaData: Prisma.ParticipantWeightHistoryGetPayload<object>
  ): ParticipantWeightHistory {
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
      [PollState.SUBMITTED]: PrismaPollState.SUBMITTED,
      [PollState.READY]: PrismaPollState.READY,
      [PollState.ACTIVE]: PrismaPollState.ACTIVE,
      [PollState.FINISHED]: PrismaPollState.FINISHED,
    };

    return stateMap[domainState];
  }
}
