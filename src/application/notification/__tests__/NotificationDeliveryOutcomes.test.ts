/** Notification production distinguishes unavailable recipient facts from a legitimate no-op.
 * A failed lookup or invalid batch member must not become a successful partial delivery. */
import { expect, it, vi } from 'vitest';
import { failure, success } from '@/domain/shared/Result';
import { PropertyClaimId, PollId, UserId } from '@/domain/shared/EntityIds';
import { NotifyPropertyClaimApprovedUseCase } from '../NotifyPropertyClaimApprovedUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '../NotifyPropertyClaimDeniedUseCase';
import { NotifyPropertyClaimSubmittedUseCase } from '../NotifyPropertyClaimSubmittedUseCase';
import { NotifyPollActivatedUseCase } from '../NotifyPollActivatedUseCase';
import { notificationTestInputs } from './notificationTestValues';

it.each([
  NotifyPropertyClaimApprovedUseCase,
  NotifyPropertyClaimDeniedUseCase,
  NotifyPropertyClaimSubmittedUseCase,
])(
  'reports failed claim facts through the delivery outcome',
  async (UseCase) => {
    const save = vi.fn();
    const useCase = new UseCase({
      ...notificationTestInputs,
      claimRepository: {
        findById: async () => failure('common.errors.unexpected'),
        getOrgAdminUserIds: async () => failure('common.errors.unexpected'),
      },
      notificationRepository: { save, saveBatch: save },
    });
    expect(
      await useCase.execute({ claimId: PropertyClaimId.parse('claim-1') })
    ).toEqual(failure('common.errors.unexpected'));
    expect(save).not.toHaveBeenCalled();
  }
);
it('does not silently drop an invalid recipient from a publication batch', async () => {
  const saveBatch = vi.fn().mockResolvedValue(success(undefined));
  const useCase = new NotifyPollActivatedUseCase({
    ...notificationTestInputs,
    notificationRepository: {
      saveBatch,
      save: async (notification) => success(notification),
    },
  });
  expect(
    await useCase.execute({
      pollId: PollId.parse('poll-1'),
      pollTitle: 'Poll',
      // @ts-expect-error Runtime defense against an unchecked caller supplying a raw invalid recipient.
      recipientUserIds: [UserId.parse('user-1'), ''],
    })
  ).toEqual(failure('domain.notification.invalidData'));
  expect(saveBatch).not.toHaveBeenCalled();
});
