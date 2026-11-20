/** Public list projection. Anchor status carries only the evidence metadata required for display. */
import type { SealAnchor } from '@/domain/seal/SealAnchor';
import type { Digest } from '@/domain/seal/SealValues';

type ActiveAnchorSummary = {
  [K in SealAnchor['status']]: Pick<
    Extract<SealAnchor, { status: K }>,
    'status' | 'provider' | 'bitcoinHeight' | 'bitcoinTime'
  >;
}[SealAnchor['status']];

export function publicAnchorStatus(anchor: ActiveAnchorSummary | null) {
  if (!anchor) {
    return { kind: 'awaitingSubmission' } as const;
  }

  if (anchor.status === 'CONFIRMED') {
    return {
      kind: 'bitcoin',
      height: anchor.bitcoinHeight,
      time: anchor.bitcoinTime,
    } as const;
  }

  if (anchor.status === 'FAILED') {
    return { kind: 'failed', provider: anchor.provider } as const;
  }

  return {
    kind: anchor.provider === 'stub' ? 'simulated' : 'pending',
  } as const;
}

export type SealStatus =
  | ReturnType<typeof publicAnchorStatus>
  | { kind: 'unsealed' | 'sealing' };
export interface SealSummary {
  rootDigest: Digest;
  status: ReturnType<typeof publicAnchorStatus>;
}
