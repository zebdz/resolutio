import type { LegalCheckRepository } from '@/domain/ai/LegalCheckRepository';

/**
 * Called after any poll content mutation (title, description, questions,
 * answers). Marks the existing legal check as stale so the UI can show
 * a "results may be outdated" banner.
 *
 * No-op if the poll has no legal check.
 */
export async function onPollContentChanged(
  pollId: string,
  legalCheckRepo: Pick<LegalCheckRepository, 'markStale'>
): Promise<void> {
  await legalCheckRepo.markStale(pollId);
}
