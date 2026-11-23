/** Validate deployment settings before creating a timestamp provider.
 * Development simulations carry an explicit marker and only replay their own digest. */
import { z } from 'zod';
import { success, failure } from '@/domain/shared/Result';
import { AnchorProvider } from '@/domain/seal/AnchorProvider';
import {
  AnchorFailureCode,
  AnchorProof,
  Digest,
} from '@/domain/seal/SealValues';
import { OpenTimestampsAnchorProvider } from './OpenTimestampsAnchorProvider';

const defaultCalendars = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
  'https://ots.btc.catallaxy.com',
];
const bearer = z.string().regex(/^[A-Za-z0-9._~+/-]+=*$/);
const httpUrl = z.url({ protocol: /^https?$/ });

export function readAnchorConfig(
  env: Readonly<Record<string, string | undefined>>
) {
  const allowSimulation =
    env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
  const provider = z
    .enum(['opentimestamps', 'stub'])
    .safeParse(env.ANCHOR_PROVIDER ?? (allowSimulation ? 'stub' : undefined));

  if (!provider.success || (!allowSimulation && provider.data === 'stub')) {
    return failure('Invalid ANCHOR_PROVIDER' as const);
  }

  if (
    (!allowSimulation || env.ANCHOR_POLLER_SECRET !== undefined) &&
    !bearer.safeParse(env.ANCHOR_POLLER_SECRET).success
  ) {
    return failure('Invalid ANCHOR_POLLER_SECRET' as const);
  }

  const calendars = z
    .array(httpUrl)
    .min(1)
    .safeParse(
      env.OTS_CALENDAR_URLS?.split(',').map((s) => s.trim()) ?? defaultCalendars
    );
  const esplora = httpUrl.safeParse(
    env.OTS_ESPLORA_URL ?? 'https://blockstream.info/api'
  );
  const timeout = z.coerce
    .number()
    .int()
    .positive()
    .max(2147483647)
    .safeParse(env.OTS_TIMEOUT_MS ?? 15000);

  if (!calendars.success || !esplora.success || !timeout.success) {
    return failure('Invalid OpenTimestamps endpoint or timeout' as const);
  }

  return success({
    provider: provider.data,
    pollerSecret: env.ANCHOR_POLLER_SECRET,
    calendars: calendars.data,
    esploraUrl: esplora.data.replace(/\/$/, ''),
    timeoutMs: timeout.data,
  });
}

export function requiredAnchorConfig() {
  const config = readAnchorConfig(process.env);

  if (!config.success) {
    throw new Error(config.error);
  }

  return config.value;
}

function simulatedProof(rootDigest: Digest) {
  return AnchorProof.parse(Buffer.from('SIMULATED:' + rootDigest));
}

export function createAnchorProvider(
  config: ReturnType<typeof requiredAnchorConfig>
): AnchorProvider {
  if (config.provider === 'opentimestamps') {
    const { calendars, esploraUrl, timeoutMs } = config;

    return new OpenTimestampsAnchorProvider({
      calendars,
      esploraUrl,
      timeoutMs,
    });
  }

  return {
    name: 'stub',
    async submit(rootDigest) {
      return success({
        kind: 'simulated',
        proof: simulatedProof(rootDigest),
        rootDigest,
      });
    },
    async upgrade(rootDigest, proof) {
      if (!Buffer.from(proof).equals(simulatedProof(rootDigest))) {
        return failure(AnchorFailureCode.parse('domain.seal.invalidProof'));
      }

      return success({ kind: 'simulated', rootDigest, proof });
    },
  };
}
