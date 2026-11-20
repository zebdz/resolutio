/** Projects a validated v1 record into results for presentation. Percentages use
 * the recorded electorate; turnout counts a voter once across all their selections. */
import { PollSeal } from '@/domain/seal/PollSeal';
import {
  pollSchema,
  talliesSchema,
  registerEntrySchema,
  signerSchema,
  TalliesSection,
} from '@/domain/seal/RecordFormat';
import {
  PollId,
  UserId,
  AnswerId,
  QuestionId,
} from '@/domain/shared/EntityIds';
import {
  ParticipantCount,
  percentageOfWeight,
  TotalVotingWeight,
  VoteCount,
} from '@/domain/poll/ResultTallies';
import { SizeUnit } from '@/domain/organization/SizeUnit';
import { User } from '@/domain/user/User';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { isOwnershipMode } from '@/domain/poll/DistributionType';
import { Weight } from '@/domain/seal/Weight';
import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';

// Committed totals are nonnegative fixed-six-place decimals. Compare their
// integer millionths before rounding for display; Number may lose the winning unit.
function winningAnswer(
  answers: TalliesSection['questions'][number]['answers']
) {
  let highest = BigInt(0);
  let winner: AnswerId | null = null;

  for (const a of answers) {
    const units = BigInt(a.totalWeight.replace('.', ''));

    if (units > highest) {
      highest = units;
      winner = AnswerId.parse(a.answerId);
    } else if (units === highest) {
      winner = null;
    }
  }

  return winner;
}

export class FrozenProtocol {
  private readonly record;
  readonly poll;
  private readonly register;
  private readonly tallies;

  constructor(seal: PollSeal) {
    this.record = seal.record;
    this.poll = pollSchema.parse(JSON.parse(this.record.sections.poll));
    this.register = registerEntrySchema
      .array()
      .parse(JSON.parse(this.record.sections.register));
    this.tallies = talliesSchema.parse(
      JSON.parse(this.record.sections.tallies)
    );
  }

  private questions() {
    const questions = new Map(this.poll.questions.map((q) => [q.id, q]));
    const totalWeight = TotalVotingWeight.parse(
      Number(this.tallies.totalParticipantWeight)
    );

    return this.tallies.questions.map((t) => {
      // Record validation requires the exact active question/answer IDs in its tallies.
      const question = questions.get(t.questionId)!;
      const labels = new Map(question.answers.map((a) => [a.id, a.text]));

      return {
        questionId: QuestionId.parse(question.id),
        questionText: question.text,
        questionDetails: question.details,
        questionType: question.questionType,
        totalVotes: VoteCount.parse(t.totalVotes),
        totalWeight: TotalVotingWeight.parse(Number(t.totalWeight)),
        winningAnswerId:
          question.questionType === 'single-choice'
            ? winningAnswer(t.answers)
            : null,
        exactTotalWeight: t.totalWeight,
        exactParticipantWeight: t.participantWeight,
        participantWeight: TotalVotingWeight.parse(Number(t.participantWeight)),
        answers: t.answers.map((a) => {
          const weightedVotes = TotalVotingWeight.parse(Number(a.totalWeight));

          return {
            answerId: AnswerId.parse(a.answerId),
            answerText: labels.get(a.answerId)!,
            voteCount: VoteCount.parse(a.voteCount),
            exactWeight: a.totalWeight,
            weightedVotes,
            percentage: percentageOfWeight(weightedVotes, totalWeight),
          };
        }),
      };
    });
  }

  private votersByAnswer() {
    const people = new Map<string, (typeof this.register)[number]>(
      this.register.map((p) => [p.userId, p])
    );
    type Voter = { userId: UserId; userName: string; weight: VotingWeight };
    const votersByAnswer = new Map<string, Voter[]>();

    for (const { preimage } of this.record.votes) {
      const person = people.get(preimage.userId)!;
      const voters = votersByAnswer.get(preimage.answerId) ?? [];
      voters.push({
        userId: UserId.parse(person.userId),
        userName: User.formatFullName(
          person.firstName,
          person.lastName,
          person.middleName
        ),
        weight: VotingWeight.parse(Number(preimage.weight)),
      });
      votersByAnswer.set(preimage.answerId, voters);
    }

    return votersByAnswer;
  }

  private signerEntries() {
    return signerSchema
      .array()
      .parse(JSON.parse(this.record.sections.signers))
      .map((s) => ({
        ...s,
        userId: UserId.parse(s.userId),
      }));
  }

  page(
    userId: string,
    canViewVoterNames: boolean,
    canViewSignWillingness: boolean
  ) {
    const voters = canViewVoterNames ? this.votersByAnswer() : undefined;
    // V1 stores property names in the restricted register only. An incomplete set
    // of names cannot describe a scoped poll's electorate accurately.
    const names = new Map(
      canViewVoterNames
        ? this.register.flatMap((person) =>
            person.holdings.map((h) => [h.propertyId, h.propertyName] as const)
          )
        : []
    );
    const scope = this.poll.propertyIds;
    const showAggregation =
      isOwnershipMode(this.poll.distributionType) &&
      (scope.length || names.size) >= 2;

    return {
      title: this.poll.title,
      description: this.poll.description,
      attachmentIds: this.poll.attachments.map((a) => a.id),
      distributionType: this.poll.distributionType,
      propertyAggregation: this.poll.propertyAggregation,
      scopedPropertyNames: scope.every((id) => names.has(id))
        ? scope.map((id) => names.get(id)!)
        : [],
      showAggregation,
      isPollCreator: this.poll.createdBy === userId,
      isOpenPoll: this.poll.pollType === 'OPEN',
      isAnonymous: this.poll.anonymous,
      hasOwnVote: this.register.some((p) => p.userId === userId && p.voted),
      canViewVoterNames,
      canViewSignWillingness,
      results: {
        pollId: PollId.parse(this.poll.id),
        totalParticipants: ParticipantCount.parse(
          this.tallies.totalParticipants
        ),
        totalWeight: TotalVotingWeight.parse(
          Number(this.tallies.totalParticipantWeight)
        ),
        exactTotalWeight: this.tallies.totalParticipantWeight,
        votedParticipants: ParticipantCount.parse(
          this.register.filter((p) => p.voted).length
        ),
        questions: this.questions().map((q) => ({
          ...q,
          answers: q.answers.map((a) => ({
            ...a,
            voters: voters?.get(a.answerId) ?? [],
          })),
        })),
        protocolSignWillingness: canViewSignWillingness
          ? this.signerEntries()
          : [],
      },
    };
  }

  signersPdf() {
    return {
      organizationName: this.poll.organizationName,
      boardName: this.poll.boardName,
      pollTitle: this.poll.title,
      entries: this.signerEntries().map((s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        middleName: s.middleName,
        willingToSignProtocol: s.willingToSignProtocol,
        phoneNumber: s.phoneNumber,
      })),
    };
  }

  namedPdf() {
    const voters = this.votersByAnswer();
    const register = this.register
      .map((p) => ({
        userId: UserId.parse(p.userId),
        fullName: User.formatFullName(p.firstName, p.lastName, p.middleName),
        weight: Number(p.weight.toDecimalString()),
        holdings: p.holdings.map((h) => {
          const unit = SizeUnit.parse(h.sizeUnit);

          return {
            propertyName: h.propertyName,
            assetName: h.assetName,
            size: Number(h.size),
            sizeUnitKey: unit.success
              ? SizeUnit.translationKey(unit.value)
              : h.sizeUnit,
            share: Number(h.share),
          };
        }),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    const isOpenPoll = this.poll.pollType === 'OPEN';

    return {
      ...this.documentHeader(),
      isPreliminary: false,
      isOpenPoll,
      isPropertyBased: isOwnershipMode(this.poll.distributionType),
      totalParticipants: this.tallies.totalParticipants,
      exactTotalParticipantWeight: this.tallies.totalParticipantWeight,
      totalParticipantWeight: Number(this.tallies.totalParticipantWeight),
      register,
      questions: this.questions().map((q) => {
        const participated = new Set<UserId>();
        const answers = q.answers.map((a) => ({
          answerId: a.answerId,
          answerText: a.answerText,
          exactWeight: a.exactWeight,
          totalWeight: a.weightedVotes,
          voteCount: a.voteCount,
          percentage: a.percentage,
          voters: (voters.get(a.answerId) ?? []).map((v) => {
            participated.add(v.userId);

            return { userId: v.userId, weight: v.weight };
          }),
        }));

        return {
          questionText: q.questionText,
          questionDetails: q.questionDetails,
          questionType: q.questionType,
          winningAnswerId: q.winningAnswerId,
          totalVotes: q.totalVotes,
          totalWeight: q.totalWeight,
          exactTotalWeight: q.exactTotalWeight,
          answers,
          nonVoterIds: isOpenPoll
            ? []
            : register
                .filter((p) => !participated.has(p.userId))
                .map((p) => p.userId),
        };
      }),
    };
  }

  private documentHeader() {
    return {
      organizationName: this.poll.organizationName,
      boardName: this.poll.boardName,
      pollTitle: this.poll.title,
      pollDescription: stripMarkdownToPlainText(this.poll.description),
      startDate: this.poll.startDate.slice(0, 10),
      endDate: this.poll.endDate.slice(0, 10),
    };
  }

  resultsPdf() {
    const voters = this.register.filter((person) => person.voted);
    const exactWeightOfVoted = voters
      .reduce(
        (sum, p) => sum.add(p.weight),
        Weight.fromDecimalString('0.000000')
      )
      .toDecimalString();

    return {
      ...this.documentHeader(),
      totalParticipants: ParticipantCount.parse(this.tallies.totalParticipants),
      totalWeight: TotalVotingWeight.parse(
        Number(this.tallies.totalParticipantWeight)
      ),
      exactTotalWeight: this.tallies.totalParticipantWeight,
      votedParticipants: ParticipantCount.parse(voters.length),
      weightOfVoted: Number(exactWeightOfVoted),
      exactWeightOfVoted,
      questions: this.questions(),
    };
  }
}
