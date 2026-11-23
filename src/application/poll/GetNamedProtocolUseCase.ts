/** Named protocol read model retains voter references, ownership units and tallies.
 * Holdings are loaded at each participant snapshot; output permissions stay server-side. */
import {
  VoteCount,
  ParticipantCount,
  TotalVotingWeight,
  VotingPercentage,
  sumVotingWeights,
  percentageOfWeight,
} from '../../domain/poll/ResultTallies';
import { VotingWeight } from '../../domain/poll/VotingWeight';
import {
  AnswerText,
  QuestionText,
  QuestionDetails,
} from '../../domain/poll/QuestionValues';
import { QuestionType } from '../../domain/poll/QuestionType';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { PollError } from './PollErrors';
import {
  AssetSize,
  OwnershipShare,
  PropertyName,
  AssetName,
} from '../../domain/organization/PropertyValues';
import {
  SizeUnit,
  SizeUnitTranslationKey,
} from '../../domain/organization/SizeUnit';
import { PropertyAssetRepositoryError } from '../../domain/organization/PropertyAssetRepository';
import { Instant } from '../../domain/shared/Instant';
import { z } from 'zod';
import {
  PollId,
  UserId,
  QuestionId,
  AnswerId,
} from '../../domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { Vote } from '../../domain/poll/Vote';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import {
  PollResultsPolicy,
  ResultsViewerFacts,
} from '../../domain/poll/PollResultsPolicy';
import { isOwnershipMode } from '../../domain/poll/DistributionType';
import { PollErrors } from './PollErrors';

export interface GetNamedProtocolInput {
  pollId: string;
  userId: string;
}

export interface NamedProtocolHolding {
  propertyName: PropertyName;
  assetName: AssetName;
  size: AssetSize;
  // Translation key, e.g. 'propertyAdmin.sizeUnit.squareMeters'. Resolved by
  // the presentation layer so the protocol renders in the reader's language.
  sizeUnitKey: SizeUnitTranslationKey;
  // 1 = sole owner. Anything below is a shared asset.
  share: OwnershipShare;
}

export interface NamedProtocolPerson {
  userId: UserId;
  firstName: string;
  lastName: string;
  middleName: string | null;
  weight: VotingWeight;
  holdings: NamedProtocolHolding[];
}

export interface NamedProtocolAnswer {
  answerId: AnswerId;
  answerText: AnswerText;
  voteCount: VoteCount;
  totalWeight: TotalVotingWeight;
  percentage: VotingPercentage;
  // References into `register` — the holdings are printed there once, not
  // repeated under every answer a multi-choice voter ticked.
  voters: Array<{ userId: UserId; weight: VotingWeight }>;
}

export interface NamedProtocolQuestion {
  questionId: QuestionId;
  questionText: QuestionText;
  questionDetails: QuestionDetails | null;
  questionType: QuestionType;
  answers: NamedProtocolAnswer[];
  totalVotes: VoteCount;
  totalWeight: TotalVotingWeight;
  participantWeight: TotalVotingWeight;
  // Empty for open polls: they have no fixed electorate to be absent from.
  nonVoterIds: UserId[];
}

export interface GetNamedProtocolResult {
  poll: Poll;
  register: NamedProtocolPerson[];
  questions: NamedProtocolQuestion[];
  totalParticipants: ParticipantCount;
  totalParticipantWeight: TotalVotingWeight;
}

/**
 * Read model behind the named protocol.
 *
 * Kept apart from GetPollResultsUseCase deliberately: that one is on the
 * results-page hot path and must not pay for the property lookups this needs,
 * and only this document cares about who did NOT vote.
 */
export class GetNamedProtocolUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private propertyAssetRepository: PropertyAssetRepository
  ) {}

  async execute(
    rawRequest: GetNamedProtocolInput
  ): Promise<
    Result<
      GetNamedProtocolResult,
      | PollWriteFailure
      | PollError
      | PropertyAssetRepositoryError
      | 'common.errors.validationFailed'
    >
  > {
    const decoded = z
      .object({ pollId: PollId, userId: UserId })
      .safeParse(rawRequest);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawRequest, ...decoded.data };

    const { pollId, userId } = input;

    const pollResult = await this.pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    const [isSuperAdmin, isOrganizationAdmin, isMember, participantResult] =
      await Promise.all([
        this.userRepository.isSuperAdmin(userId),
        this.organizationRepository.isUserAdmin(userId, poll.organizationId),
        this.organizationRepository.isUserMember(userId, poll.organizationId),
        this.participantRepository.getParticipantByUserAndPoll(pollId, userId),
      ]);

    const viewerFacts: ResultsViewerFacts = {
      isAdmin: isSuperAdmin || isOrganizationAdmin,
      isOrgMember: isMember,
      isPollVoter: participantResult.success && !!participantResult.value,
    };

    const allowed = PollResultsPolicy.canExportNamedProtocol(poll, viewerFacts);

    if (!allowed.success) {
      return failure(allowed.error);
    }

    const [votesResult, participantsResult] = await Promise.all([
      this.voteRepository.getVotesByPoll(pollId),
      this.participantRepository.getParticipants(pollId),
    ]);

    if (!votesResult.success) {
      return failure(votesResult.error);
    }

    if (!participantsResult.success) {
      return failure(participantsResult.error);
    }

    const votes = votesResult.value;
    const participants = participantsResult.value;

    const totalParticipantWeight = sumVotingWeights(
      participants.map((p) => p.userWeight)
    );

    const users =
      (await this.userRepository.findByIds(
        participants.map((p) => p.userId)
      )) ?? [];
    const usersById = new Map(users.map((u) => [u.id, u]));

    // Holdings only make sense when the weight came from property. An EQUAL
    // poll — including every open poll — skips the query entirely.
    let holdingsByUser = new Map<UserId, NamedProtocolHolding[]>();

    if (isOwnershipMode(poll.distributionType)) {
      const holdingsResult = await this.loadHoldings(poll, participants);

      if (!holdingsResult.success) {
        return failure(holdingsResult.error);
      }

      holdingsByUser = holdingsResult.value;
    }

    const register: NamedProtocolPerson[] = participants
      .map((p) => {
        const user = usersById.get(p.userId);

        return {
          userId: p.userId,
          firstName: user?.firstName ?? 'Unknown',
          lastName: user?.lastName ?? 'Unknown',
          middleName: user?.middleName ?? null,
          weight: p.userWeight,
          holdings: holdingsByUser.get(p.userId) ?? [],
        };
      })
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          (a.middleName ?? '').localeCompare(b.middleName ?? '')
      );

    const votesByQuestion = new Map<QuestionId, Vote[]>();

    for (const vote of votes) {
      const bucket = votesByQuestion.get(vote.questionId);

      if (bucket) {
        bucket.push(vote);
      } else {
        votesByQuestion.set(vote.questionId, [vote]);
      }
    }

    const participantIds = participants.map((p) => p.userId);
    const questions: NamedProtocolQuestion[] = [];

    for (const question of poll.questions) {
      if (question.isArchived()) {
        continue;
      }

      const questionVotes = votesByQuestion.get(question.id) ?? [];
      const votesByAnswer = new Map<AnswerId, Vote[]>();

      for (const vote of questionVotes) {
        const bucket = votesByAnswer.get(vote.answerId);

        if (bucket) {
          bucket.push(vote);
        } else {
          votesByAnswer.set(vote.answerId, [vote]);
        }
      }

      const answers: NamedProtocolAnswer[] = [];

      for (const answer of question.answers) {
        if (answer.isArchived()) {
          continue;
        }

        const answerVotes = votesByAnswer.get(answer.id) ?? [];
        const totalWeight = sumVotingWeights(
          answerVotes.map((v) => v.userWeight)
        );

        answers.push({
          answerId: answer.id,
          answerText: answer.text,
          voteCount: VoteCount.parse(answerVotes.length),
          totalWeight,
          percentage: percentageOfWeight(totalWeight, totalParticipantWeight),
          voters: answerVotes.map((v) => ({
            userId: v.userId,
            weight: v.userWeight,
          })),
        });
      }

      // Dedupe by userId — a multi-choice voter casting N votes contributes
      // their weight to participation only once.
      const uniqueVoterWeights = new Map<UserId, VotingWeight>();

      for (const v of questionVotes) {
        if (!uniqueVoterWeights.has(v.userId)) {
          uniqueVoterWeights.set(v.userId, v.userWeight);
        }
      }

      questions.push({
        questionId: question.id,
        questionText: question.text,
        questionDetails: question.details,
        questionType: question.questionType,
        answers,
        totalVotes: VoteCount.parse(questionVotes.length),
        totalWeight: sumVotingWeights(answers.map((a) => a.totalWeight)),
        participantWeight: sumVotingWeights(
          Array.from(uniqueVoterWeights.values())
        ),
        nonVoterIds: poll.isOpen()
          ? []
          : participantIds.filter((id) => !uniqueVoterWeights.has(id)),
      });
    }

    return success({
      poll,
      register,
      questions,
      totalParticipants: ParticipantCount.parse(participants.length),
      totalParticipantWeight,
    });
  }

  /**
   * Holdings are read as of each participant's own snapshotAt — the instant
   * that fixed their weight — so the flats printed in the register always
   * explain the weight printed beside them, even after a sale. Participants
   * normally share one snapshot, so this is usually a single query.
   */
  private async loadHoldings(
    poll: Poll,
    participants: Array<{ userId: UserId; snapshotAt: Date }>
  ): Promise<
    Result<Map<UserId, NamedProtocolHolding[]>, PropertyAssetRepositoryError>
  > {
    const descendantIds = await this.organizationRepository.getDescendantIds(
      poll.organizationId
    );
    const organizationIds = [poll.organizationId, ...descendantIds];

    const bySnapshot = new Map<Instant, UserId[]>();

    for (const p of participants) {
      const key = Instant.fromDate(p.snapshotAt);
      const bucket = bySnapshot.get(key);

      if (bucket) {
        bucket.push(p.userId);
      } else {
        bySnapshot.set(key, [p.userId]);
      }
    }

    const holdingsByUser = new Map<UserId, NamedProtocolHolding[]>();

    for (const [time, userIds] of bySnapshot) {
      const rowsResult = await this.propertyAssetRepository.findHoldingsAsOf({
        organizationIds,
        propertyIds: poll.propertyIds,
        userIds,
        asOf: time,
      });

      if (!rowsResult.success) {
        return failure(rowsResult.error);
      }

      for (const row of rowsResult.value) {
        const holding: NamedProtocolHolding = {
          propertyName: row.propertyName,
          assetName: row.assetName,
          size: row.size,
          sizeUnitKey: SizeUnit.translationKey(row.sizeUnit),
          share: row.share,
        };
        const bucket = holdingsByUser.get(row.userId);

        if (bucket) {
          bucket.push(holding);
        } else {
          holdingsByUser.set(row.userId, [holding]);
        }
      }
    }

    return success(holdingsByUser);
  }
}
