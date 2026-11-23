/** Application result clients must keep domain references, tally units and
 * known failures until an explicit presentation boundary serializes them. */
import {
  AnswerResult,
  QuestionResult,
  GetPollResultsResult,
  GetPollResultsUseCase,
} from '../../../application/poll/GetPollResultsUseCase';
import {
  NamedProtocolPerson,
  NamedProtocolQuestion,
  NamedProtocolHolding,
  GetNamedProtocolUseCase,
} from '../../../application/poll/GetNamedProtocolUseCase';
import type { Poll } from '../Poll';
import { AnswerId, QuestionId, PollId } from '../../shared/EntityIds';
import { AssetSize } from '../../organization/PropertyValues';
import { VotingWeight } from '../VotingWeight';
import {
  VoteCount,
  ParticipantCount,
  TotalVotingWeight,
  VotingPercentage,
} from '../ResultTallies';
declare const answer: AnswerResult;
declare const result: GetPollResultsResult;
declare const person: NamedProtocolPerson;
const answerId: AnswerId = answer.answerId;
const voteCount: VoteCount = answer.voteCount;
const totalWeight: TotalVotingWeight = answer.totalWeight;
const percentage: VotingPercentage = answer.percentage;
const participantCount: ParticipantCount = result.totalParticipants;
const voterWeight: VotingWeight = person.weight;
// @ts-expect-error A question cannot be used as an answer reference.
const wrongAnswer: AnswerResult['answerId'] = QuestionId.parse('question');
// @ts-expect-error Named protocol references must preserve voter identities.
const wrongVoter: NamedProtocolPerson['userId'] = PollId.parse('poll');
// @ts-expect-error Question kinds remain a closed vocabulary in read models.
const wrongKind: QuestionResult['questionType'] = 'unknown';
// @ts-expect-error Nonvoter references are validated user identities.
const rawNonVoter: NamedProtocolQuestion['nonVoterIds'] = ['user'];
// @ts-expect-error Asset sizes cannot substitute for ownership fractions.
const wrongShare: NamedProtocolHolding['share'] = AssetSize.parse(1);
// @ts-expect-error Size-unit translation keys are a closed set, not arbitrary messages.
const unknownUnitKey: NamedProtocolHolding['sizeUnitKey'] =
  'propertyAdmin.sizeUnit.furlongs';
// @ts-expect-error Individual weights cannot be substituted for aggregate totals.
const wrongTotal: AnswerResult['totalWeight'] = VotingWeight.parse(1);
// @ts-expect-error Participant counts cannot substitute for selection counts.
const wrongCount: AnswerResult['voteCount'] = ParticipantCount.parse(1);
type FailureOf<T> = T extends { success: false; error: infer E } ? E : never;
type ReadFailure = FailureOf<
  Awaited<
    ReturnType<
      GetPollResultsUseCase['execute'] | GetNamedProtocolUseCase['execute']
    >
  >
>;
// @ts-expect-error Poll readers return known failures, not arbitrary strings.
const unknownFailure: ReadFailure = 'arbitrary message';

import { ProtocolSignWillingnessEntry } from '../../../application/poll/GetPollResultsUseCase';
import { PhoneNumber } from '../../user/PhoneNumber';
import { QuestionText } from '../QuestionValues';
// @ts-expect-error Question and answer content retain their distinct constraints.
const questionAsAnswer: AnswerResult['answerText'] =
  QuestionText.parse('Question');
// @ts-expect-error Declining signing consent cannot expose a phone number.
const declinedPhone: ProtocolSignWillingnessEntry = {
  userId: person.userId,
  firstName: 'Ivan',
  lastName: 'Petrov',
  middleName: null,
  willingToSignProtocol: false,
  phoneNumber: PhoneNumber.create('+79161234567'),
};

import { PreviewPollWeightConfigOutput } from '../../../application/poll/PreviewPollWeightConfigUseCase';
import { AddPollAttachmentOutput } from '../../../application/poll/AddPollAttachmentUseCase';
import { OpenPollPreview } from '../../../application/poll/GetOpenPollPreviewUseCase';
import { GetUserVotingProgressResult } from '../../../application/poll/GetUserVotingProgressUseCase';
const wrongScope: PreviewPollWeightConfigOutput['effectiveConfig']['propertyIds'] =
  [
    // @ts-expect-error Preview scopes are property references, not poll references.
    PollId.parse('poll'),
  ];
// @ts-expect-error Preview weights must preserve their voting unit.
const rawPreviewWeight: PreviewPollWeightConfigOutput['addedParticipants'][number]['newWeight'] = 1;
// @ts-expect-error Preview totals cannot be individual voting weights.
const wrongPreviewTotal: PreviewPollWeightConfigOutput['totalWeight'] =
  VotingWeight.parse(1);
// @ts-expect-error Poll references cannot substitute for uploaded attachment references.
const wrongFile: AddPollAttachmentOutput['id'] = PollId.parse('poll');
// @ts-expect-error Open-preview attachment references remain validated.
const rawPreviewFile: OpenPollPreview['attachmentIds'] = ['file'];
// @ts-expect-error Public previews retain validated organization names until serialization.
const rawPreviewOrganization: OpenPollPreview['organizationName'] = '';
// @ts-expect-error Progress counts questions, not selections.
const wrongQuestionCount: GetUserVotingProgressResult['totalQuestions'] =
  VoteCount.parse(1);

const rawConsentingPhone: ProtocolSignWillingnessEntry = {
  userId: person.userId,
  firstName: 'Ivan',
  lastName: 'Petrov',
  middleName: null,
  willingToSignProtocol: true,
  // @ts-expect-error Consenting contacts retain validated phone numbers before serialization.
  phoneNumber: '+79161234567',
};

type PollSnapshot = ReturnType<Poll['toJSON']>;
type QuestionSnapshot = PollSnapshot['questions'][number];
type AnswerSnapshot = QuestionSnapshot['answers'][number];
// @ts-expect-error Serialized poll identities still distinguish polls from other entities.
const rawSnapshotId: PollSnapshot['id'] = 'poll';
// @ts-expect-error A question ID cannot identify a serialized answer.
const wrongSnapshotAnswer: AnswerSnapshot['id'] = QuestionId.parse('question');
// @ts-expect-error Serialized pages remain validated page numbers.
const rawSnapshotPage: QuestionSnapshot['page'] = 0;
// @ts-expect-error Serialized poll kinds are closed alternatives.
const unknownSnapshotKind: PollSnapshot['pollType'] = 'other';
