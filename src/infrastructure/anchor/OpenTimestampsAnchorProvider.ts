/** Submits raw SHA-256 commitments and validates detached OpenTimestamps evidence.
 * Upgrade and Bitcoin verification have independent deadlines so an explorer outage
 * cannot discard newly obtained proof bytes. */
import { join } from 'node:path';
import { z } from 'zod';
import { AnchorProvider } from '@/domain/seal/AnchorProvider';
import {
  Digest,
  AnchorProof,
  AnchorFailureCode,
  BitcoinHeight,
  UtcTimestamp,
} from '@/domain/seal/SealValues';
import { success, failure } from '@/domain/shared/Result';

export interface OpenTimestampsConfig {
  readonly calendars: readonly string[];
  readonly esploraUrl: string;
  readonly timeoutMs: number;
}
const response = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pending'),
    proof: AnchorProof.schema,
    hasBitcoin: z.boolean(),
  }),
  z.object({
    kind: z.literal('bitcoin'),
    proof: AnchorProof.schema,
    height: BitcoinHeight.schema,
    time: z.number().int().positive().max(253402300799),
  }),
  z.object({ kind: z.literal('invalid') }),
  z.object({ kind: z.literal('unavailable') }),
]);
type Response = z.output<typeof response>;
export class OpenTimestampsAnchorProvider implements AnchorProvider {
  readonly name = 'opentimestamps' as const;
  constructor(private readonly config: OpenTimestampsConfig) {}
  async submit(rootDigest: Digest): ReturnType<AnchorProvider['submit']> {
    const result = await this.call('submit', rootDigest);

    if (result.kind !== 'pending') {
      return failure(
        AnchorFailureCode.parse('seal.errors.anchorSubmissionFailed')
      );
    }

    return success({ kind: 'pending', rootDigest, proof: result.proof });
  }
  async upgrade(
    rootDigest: Digest,
    proof: AnchorProof
  ): ReturnType<AnchorProvider['upgrade']> {
    const result = await this.call('upgrade', rootDigest, proof);

    if (result.kind !== 'pending') {
      return failure(
        AnchorFailureCode.parse(
          result.kind === 'unavailable'
            ? 'seal.errors.anchorUpgradeFailed'
            : 'domain.seal.invalidProof'
        )
      );
    }

    if (result.hasBitcoin) {
      const verified = await this.call('verify', rootDigest, result.proof);

      if (verified.kind === 'bitcoin') {
        return success({
          kind: 'bitcoin',
          rootDigest,
          proof: verified.proof,
          bitcoinHeight: verified.height,
          bitcoinTime: UtcTimestamp.fromDate(new Date(verified.time * 1000)),
        });
      }

      return success({
        kind: 'pending',
        rootDigest,
        proof: result.proof,
        verificationError: AnchorFailureCode.parse(
          'seal.errors.anchorVerificationFailed'
        ),
      });
    }

    return success({ kind: 'pending', rootDigest, proof: result.proof });
  }

  private call(
    action: 'submit' | 'upgrade' | 'verify',
    digest: Digest,
    proof?: AnchorProof
  ): Promise<Response> {
    // Next 16.0.7's NFT tracer treats a statically imported Worker as a file.
    const { Worker } = process.getBuiltinModule('worker_threads');
    const worker = new Worker(
      // The deployment archive ships this native Node entry point verbatim.
      join(process.cwd(), 'src/infrastructure/anchor/ots-worker.mjs'),
      {
        workerData: { action, digest, proof, config: this.config },
        stdout: true,
        stderr: true,
        resourceLimits: { maxOldGenerationSizeMb: 96 },
      }
    );
    worker.stdout.resume();
    worker.stderr.resume();

    return new Promise((resolve) => {
      const finish = (result: Response) => {
        clearTimeout(timer);
        resolve(result);
        void worker.terminate();
      };

      const timer = setTimeout(
        () => finish({ kind: 'unavailable' }),
        this.config.timeoutMs
      );
      worker.once('error', () => finish({ kind: 'invalid' }));
      worker.once('exit', () => finish({ kind: 'invalid' }));
      worker.once('message', (value) => {
        const decoded = response.safeParse(value);
        finish(decoded.success ? decoded.data : { kind: 'invalid' });
      });
    });
  }
}
