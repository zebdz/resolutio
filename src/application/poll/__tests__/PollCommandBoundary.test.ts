/** Request identities must be decoded before any domain repository is called.
 * The lifecycle path exercises validation before authorization or persistence. */
import { expect, it, vi } from 'vitest';
import { ActivatePollUseCase } from '../ActivatePollUseCase';
import { PollRepository } from '@/domain/poll/PollRepository';

it.each([
  { pollId: '', userId: 'user-1' },
  { pollId: 'poll-1', userId: 'invalid user' },
])(
  'rejects malformed lifecycle identities before reading storage',
  async (command) => {
    const repository = { getPollById: vi.fn() } as unknown as PollRepository;
    const useCase = new ActivatePollUseCase(
      repository,
      null!,
      null!,
      null!,
      null!,
      null!,
      null!,
      null!
    );
    await expect(useCase.execute(command)).resolves.toEqual({
      success: false,
      error: 'common.errors.validationFailed',
    });
    expect(repository.getPollById).not.toHaveBeenCalled();
  }
);
