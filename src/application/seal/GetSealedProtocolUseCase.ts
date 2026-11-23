/** Resolves current viewer access before projecting an immutable poll record.
 * Missing records have explicit coverage. Read failures never select live results. */
import { PollId, UserId } from '@/domain/seal/SealValues';
import type {
  PollId as ApplicationPollId,
  UserId as ApplicationUserId,
} from '@/domain/shared/EntityIds';
import { PollSealRepository } from '@/domain/seal/PollSealRepository';
import { PollDomainCodes, PollDomainCode } from '@/domain/poll/PollDomainCodes';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import {
  PollResultsPolicy,
  ResultsViewerFacts,
} from '@/domain/poll/PollResultsPolicy';
import { Result, failure, success } from '@/domain/shared/Result';
import { SealSummary, publicAnchorStatus } from './SealSummary';
import { FrozenProtocol } from './FrozenProtocol';

export interface ProtocolViewer {
  state: 'DRAFT' | 'SUBMITTED' | 'READY' | 'ACTIVE' | 'FINISHED';
  hasFinishedAt: boolean;
  isOpen: boolean;
  anonymous: boolean;
  facts: ResultsViewerFacts;
}
export interface ProtocolViewerReader {
  forProtocol(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<ProtocolViewer | null, 'common.errors.unexpected'>>;
}
type LiveCoverage = 'preliminary' | 'sealing' | 'unsealed';
export type ProtocolSource<T> =
  | {
      kind: 'live';
      coverage: LiveCoverage;
      canViewVoterNames: boolean;
      canViewSignWillingness: boolean;
    }
  | { kind: 'sealed'; seal: SealSummary; data: T };
export type ProtocolPurpose = 'page' | 'resultsPdf' | 'namedPdf' | 'signersPdf';
type ProtocolResponse<K extends ProtocolPurpose> = Promise<
  Result<ProtocolSource<ReturnType<FrozenProtocol[K]>>, ProtocolFailure>
>;
type ProtocolFailure =
  | PollDomainCode
  | SealPersistenceFailureCode
  | 'common.errors.validationFailed'
  | 'common.errors.unexpected'
  | 'poll.errors.pollNotFound';
export class GetSealedProtocolUseCase {
  constructor(
    private readonly viewers: ProtocolViewerReader,
    private readonly seals: Pick<PollSealRepository, 'findByPollId'>
  ) {}

  execute<K extends ProtocolPurpose>(
    pollId: ApplicationPollId,
    userId: ApplicationUserId,
    purpose: K
  ): ProtocolResponse<K>;
  async execute(
    rawPollId: ApplicationPollId,
    rawUserId: ApplicationUserId,
    purpose: ProtocolPurpose
  ): ProtocolResponse<ProtocolPurpose> {
    const pollId = PollId.schema.safeParse(rawPollId);
    const userId = UserId.schema.safeParse(rawUserId);

    if (!pollId.success || !userId.success) {
      return failure('common.errors.validationFailed' as const);
    }

    const viewer = await this.viewers.forProtocol(pollId.data, userId.data);

    if (!viewer.success) {
      return viewer;
    }

    if (!viewer.value) {
      return failure('poll.errors.pollNotFound' as const);
    }

    const { state, anonymous, isOpen, facts } = viewer.value;
    const poll = {
      isFinished: () => state === 'FINISHED',
      isActive: () => state === 'ACTIVE',
      isAnonymous: () => anonymous,
      isOpen: () => isOpen,
    };
    const allowed =
      purpose === 'namedPdf'
        ? PollResultsPolicy.canExportNamedProtocol(poll, facts)
        : purpose === 'resultsPdf'
          ? PollResultsPolicy.canExportProtocol(poll, facts)
          : PollResultsPolicy.canViewResults(poll, facts);

    if (
      purpose === 'signersPdf' &&
      !PollResultsPolicy.canViewSignWillingness(facts)
    ) {
      return failure(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
    }

    if (!allowed.success) {
      return allowed;
    }

    const canViewVoterNames = PollResultsPolicy.canViewVoterNames(poll, facts);
    const canViewSignWillingness =
      PollResultsPolicy.canViewSignWillingness(facts);
    const live = (coverage: LiveCoverage) =>
      success({
        kind: 'live' as const,
        coverage,
        canViewVoterNames,
        canViewSignWillingness,
      });

    if (state !== 'FINISHED') {
      return live('preliminary');
    }

    const stored = await this.seals.findByPollId(pollId.data);

    if (!stored.success) {
      return stored;
    }

    if (!stored.value) {
      return live(viewer.value.hasFinishedAt ? 'sealing' : 'unsealed');
    }

    const seal = stored.value;
    const frozen = new FrozenProtocol(seal);
    const summary = {
      rootDigest: seal.rootDigest,
      status: publicAnchorStatus(seal.activeAnchor()),
    };

    switch (purpose) {
      case 'page': {
        // A later change to a poll's anonymity flag cannot unmask its frozen ballots.
        const names =
          canViewVoterNames && (!frozen.poll.anonymous || facts.isAdmin);

        return success({
          kind: 'sealed' as const,
          seal: summary,
          data: frozen.page(userId.data, names, canViewSignWillingness),
        });
      }

      case 'namedPdf':
        if (frozen.poll.anonymous) {
          return failure(PollDomainCodes.POLL_IS_ANONYMOUS);
        }

        return success({
          kind: 'sealed' as const,
          seal: summary,
          data: frozen.namedPdf(),
        });
      case 'signersPdf':
        return success({
          kind: 'sealed' as const,
          seal: summary,
          data: frozen.signersPdf(),
        });
      case 'resultsPdf':
        return success({
          kind: 'sealed' as const,
          seal: summary,
          data: frozen.resultsPdf(),
        });
    }
  }
}
