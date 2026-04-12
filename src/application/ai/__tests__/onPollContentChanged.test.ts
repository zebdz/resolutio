import { describe, it, expect, vi } from 'vitest';
import { onPollContentChanged } from '../onPollContentChanged';
import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';

describe('onPollContentChanged', () => {
  it('marks legal check as stale for the given pollId', async () => {
    const legalCheckRepo: Pick<LegalCheckRepository, 'markStale'> = {
      markStale: vi.fn().mockResolvedValue(undefined),
    };

    await onPollContentChanged('poll-1', legalCheckRepo);

    expect(legalCheckRepo.markStale).toHaveBeenCalledWith('poll-1');
    expect(legalCheckRepo.markStale).toHaveBeenCalledTimes(1);
  });

  it('does not throw if no legal check exists (markStale is a no-op)', async () => {
    const legalCheckRepo: Pick<LegalCheckRepository, 'markStale'> = {
      markStale: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      onPollContentChanged('poll-without-check', legalCheckRepo)
    ).resolves.not.toThrow();
  });
});
