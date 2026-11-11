/** Compile-only action clients retain validated poll references and closed voting decisions.
 * Checked by the complete production/test TypeScript build without loading web I/O in domain tests. */
import { canUserVoteAction } from '../poll/vote';
import {
  getPollByIdAction,
  getUserPollsAction,
  getPollsByBoardIdAction,
  searchPollsAction,
  createPollAction,
  addQuestionAction,
  createAnswerAction,
} from '../poll/poll';
import type { PollAttachmentSummary } from '../poll/pollAttachments';
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import {
  getParticipantsAction,
  getWeightHistoryAction,
} from '../organization/participant';
import type { ComponentProps } from 'react';
import type { WeightConfigEditor } from '@/web/components/polls/participants/WeightConfigEditor';
import type ParticipantManagement from '@/web/components/polls/participants/ParticipantManagement';
import type { VotingProgressView } from '../poll/VotingProgressView';
import type { PollResultsData } from '../poll/PollResultsView';
import { VotingWeight } from '@/domain/poll/VotingWeight';

// @ts-expect-error The result's poll reference remains distinct from an organization reference.
const wrongResultPoll: PollResultsData['pollId'] = OrganizationId.parse('org');
// @ts-expect-error Voter references retain the user identity contract.
const wrongResultVoter: PollResultsData['questions'][number]['answers'][number]['voters'][number]['userId'] =
  OrganizationId.parse('org');
// @ts-expect-error Individual weights cannot stand in for aggregate result weights.
const individualResultTotal: PollResultsData['totalWeight'] =
  VotingWeight.parse(1);
// @ts-expect-error Voter participation remains a validated participant count.
const rawResultParticipants: PollResultsData['votedParticipants'] = -1;
// @ts-expect-error A participant who declined signing consent cannot expose a phone number.
const declinedResultSigner: PollResultsData['protocolSignWillingness'][number] =
  {
    userId: UserId.parse('user'),
    firstName: 'A',
    lastName: 'B',
    middleName: null,
    willingToSignProtocol: false,
    phoneNumber: '+79001234567',
  };

// @ts-expect-error Voting progress preserves the poll's validated identity.
const rawProgressPoll: VotingProgressView['poll']['id'] = 'poll';
// @ts-expect-error Attachment references remain distinct from organization identities.
const wrongProgressAttachment: VotingProgressView['poll']['attachmentIds'][number] =
  OrganizationId.parse('org');
// @ts-expect-error A draft answer reference cannot be a question or organization identity.
const wrongDraftAnswer: VotingProgressView['drafts'][number]['answerId'] =
  OrganizationId.parse('org');
// @ts-expect-error Question positions keep their validated page unit.
const rawQuestionPage: VotingProgressView['poll']['questions'][number]['page'] =
  -1;
// @ts-expect-error Progress counts remain distinct from page positions and other numbers.
const rawProgressCount: VotingProgressView['totalQuestions'] = -1;

type CreatedPoll = Extract<
  Awaited<ReturnType<typeof createPollAction>>,
  { success: true }
>['data'];
type CreatedQuestion = Extract<
  Awaited<ReturnType<typeof addQuestionAction>>,
  { success: true }
>['data'];
type CreatedAnswer = Extract<
  Awaited<ReturnType<typeof createAnswerAction>>,
  { success: true }
>['data'];
// @ts-expect-error Created polls retain their identity type across the action boundary.
const wrongCreatedPoll: CreatedPoll['pollId'] = OrganizationId.parse('org');
// @ts-expect-error Created questions cannot become organization references.
const wrongCreatedQuestion: CreatedQuestion['questionId'] =
  OrganizationId.parse('org');
// @ts-expect-error Created answers retain their distinct identity.
const wrongCreatedAnswer: CreatedAnswer['answerId'] =
  OrganizationId.parse('org');
// @ts-expect-error Listed attachment identities cannot be organization references.
const wrongAttachmentId: PollAttachmentSummary['id'] =
  OrganizationId.parse('org');
// @ts-expect-error Listed attachment sizes retain validated byte units.
const rawAttachmentBytes: PollAttachmentSummary['sizeBytes'] = -1;
// @ts-expect-error Poll evidence accepts only the domain's supported MIME alternatives.
const unknownAttachmentMime: PollAttachmentSummary['mimeType'] = 'unknown';
// @ts-expect-error Poll search totals retain their validated count unit.
const rawPollSearchCount: import('../poll/PollQueryViews').PollSearchView['totalCount'] =
  -1;

type Editor = ComponentProps<typeof WeightConfigEditor>;
type Management = ComponentProps<typeof ParticipantManagement>;
// @ts-expect-error A selected distribution is one of the domain's supported choices.
const unknownDistribution: Editor['initialConfig']['distributionType'] =
  'unknown';
// @ts-expect-error A selected aggregation is one of the domain's supported choices.
const unknownAggregation: Management['weightConfig']['propertyAggregation'] =
  'unknown';
// @ts-expect-error Organization and poll references cannot be substituted in the editor.
const wrongEditorPoll: Editor['pollId'] = OrganizationId.parse('org');
// @ts-expect-error Selected properties retain their own identity type.
const wrongEditorProperty: Editor['initialConfig']['propertyIds'][number] =
  OrganizationId.parse('org');
// @ts-expect-error The editor cannot treat an arbitrary state as editable.
const unknownEditorState: Editor['pollState'] = 'unknown';
type EditorPreview = Extract<
  Awaited<ReturnType<Editor['previewAction']>>,
  { success: true }
>['data'];
// @ts-expect-error A preview retains validated participant weights.
const rawPreviewWeight: EditorPreview['addedParticipants'][number]['newWeight'] =
  -1;

type Participants = Extract<
  Awaited<ReturnType<typeof getParticipantsAction>>,
  { success: true }
>['data'];
type History = Extract<
  Awaited<ReturnType<typeof getWeightHistoryAction>>,
  { success: true }
>['data'];
// @ts-expect-error Participant references stay distinct from organization references.
const wrongParticipantId: Participants['participants'][number]['participant']['id'] =
  OrganizationId.parse('org');
type PublicParticipant = Participants['participants'][number]['participant'];
// @ts-expect-error The public participant payload has no receipt credentials.
type ExposedSecret = PublicParticipant['receiptSecret'];
// @ts-expect-error History weights retain their validated unit.
const rawHistoryWeight: History[number]['newWeight'] = -1;
type VotingActionResult = Awaited<ReturnType<typeof canUserVoteAction>>;
type VotingDecisionView = Extract<
  VotingActionResult,
  { success: true }
>['data'];
// @ts-expect-error A denied vote must always explain why.
const unexplainedDenial: VotingDecisionView = { canVote: false };
const unknownDenial: VotingDecisionView = {
  canVote: false,
  // @ts-expect-error Voting denial reasons must be known localized keys.
  reasonCode: 'unknown',
};
const allowedWithReason: VotingDecisionView = {
  canVote: true,
  // @ts-expect-error An allowed vote cannot carry a denial reason.
  reasonCode: 'cannotVote',
};

type Detail = Extract<
  Awaited<ReturnType<typeof getPollByIdAction>>,
  { success: true }
>['data'];
type UserPolls = Extract<
  Awaited<ReturnType<typeof getUserPollsAction>>,
  { success: true }
>['data'];
type BoardPolls = Extract<
  Awaited<ReturnType<typeof getPollsByBoardIdAction>>,
  { success: true }
>['data'];
type Search = Extract<
  Awaited<ReturnType<typeof searchPollsAction>>,
  { success: true }
>['data'];
// @ts-expect-error A plain poll detail retains its validated poll identity.
const wrongDetailId: Detail['id'] = OrganizationId.parse('org');
// @ts-expect-error User-list voting status is a boolean, not an arbitrary value.
const invalidUserVotingFlag: UserPolls[number]['canVote'] = 'yes';
// @ts-expect-error Board-list poll state is closed.
const invalidBoardPollState: BoardPolls[number]['state'] = 'unknown';
// @ts-expect-error Search results retain the organization's typed identity.
const rawSearchOrganization: Search['polls'][number]['organizationId'] = 'org';
