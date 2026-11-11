/** Poll application failures retain known domain, boundary and adapter codes.
 * A single widened operation would allow the invalid client assignment below. */
import { ActivatePollUseCase } from '../../../application/poll/ActivatePollUseCase';
import { AddPollAttachmentUseCase } from '../../../application/poll/AddPollAttachmentUseCase';
import { AddQuestionUseCase } from '../../../application/poll/AddQuestionUseCase';
import { CreateAnswerUseCase } from '../../../application/poll/CreateAnswerUseCase';
import { CreatePollUseCase } from '../../../application/poll/CreatePollUseCase';
import { DeactivatePollUseCase } from '../../../application/poll/DeactivatePollUseCase';
import { DeleteAnswerUseCase } from '../../../application/poll/DeleteAnswerUseCase';
import { DeleteQuestionUseCase } from '../../../application/poll/DeleteQuestionUseCase';
import { DiscardSnapshotUseCase } from '../../../application/poll/DiscardSnapshotUseCase';
import { FinishPollUseCase } from '../../../application/poll/FinishPollUseCase';
import { FinishVotingUseCase } from '../../../application/poll/FinishVotingUseCase';
import { GetOpenPollPreviewUseCase } from '../../../application/poll/GetOpenPollPreviewUseCase';
import { GetParticipantsUseCase } from '../../../application/poll/GetParticipantsUseCase';
import { GetUserVotingProgressUseCase } from '../../../application/poll/GetUserVotingProgressUseCase';
import { GetWeightHistoryUseCase } from '../../../application/poll/GetWeightHistoryUseCase';
import { PreviewPollWeightConfigUseCase } from '../../../application/poll/PreviewPollWeightConfigUseCase';
import { RemoveParticipantUseCase } from '../../../application/poll/RemoveParticipantUseCase';
import { RemovePollAttachmentUseCase } from '../../../application/poll/RemovePollAttachmentUseCase';
import { ReturnPollToDraftUseCase } from '../../../application/poll/ReturnPollToDraftUseCase';
import { SubmitDraftUseCase } from '../../../application/poll/SubmitDraftUseCase';
import { SubmitPollToAdminUseCase } from '../../../application/poll/SubmitPollToAdminUseCase';
import { TakeSnapshotUseCase } from '../../../application/poll/TakeSnapshotUseCase';
import { UpdateAnswerUseCase } from '../../../application/poll/UpdateAnswerUseCase';
import { UpdateParticipantWeightUseCase } from '../../../application/poll/UpdateParticipantWeightUseCase';
import { UpdatePollUseCase } from '../../../application/poll/UpdatePollUseCase';
import { UpdatePollWeightConfigUseCase } from '../../../application/poll/UpdatePollWeightConfigUseCase';
import { UpdateQuestionOrderUseCase } from '../../../application/poll/UpdateQuestionOrderUseCase';
import { UpdateQuestionUseCase } from '../../../application/poll/UpdateQuestionUseCase';
type Operations =
  | ActivatePollUseCase
  | AddPollAttachmentUseCase
  | AddQuestionUseCase
  | CreateAnswerUseCase
  | CreatePollUseCase
  | DeactivatePollUseCase
  | DeleteAnswerUseCase
  | DeleteQuestionUseCase
  | DiscardSnapshotUseCase
  | FinishPollUseCase
  | FinishVotingUseCase
  | GetOpenPollPreviewUseCase
  | GetParticipantsUseCase
  | GetUserVotingProgressUseCase
  | GetWeightHistoryUseCase
  | PreviewPollWeightConfigUseCase
  | RemoveParticipantUseCase
  | RemovePollAttachmentUseCase
  | ReturnPollToDraftUseCase
  | SubmitDraftUseCase
  | SubmitPollToAdminUseCase
  | TakeSnapshotUseCase
  | UpdateAnswerUseCase
  | UpdateParticipantWeightUseCase
  | UpdatePollUseCase
  | UpdatePollWeightConfigUseCase
  | UpdateQuestionOrderUseCase
  | UpdateQuestionUseCase;
type FailureOf<T> = T extends { success: false; error: infer E } ? E : never;
type OperationFailure = FailureOf<Awaited<ReturnType<Operations['execute']>>>;
// @ts-expect-error Arbitrary messages cannot cross a poll application contract.
const arbitraryError: OperationFailure = 'arbitrary failure';
