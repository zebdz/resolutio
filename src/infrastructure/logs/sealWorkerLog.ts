/** Append private seal diagnostics alongside the scheduler's run summaries.
 * Only poll IDs, operation names and application error codes enter this log. */
import { appendFile } from 'node:fs/promises';
import type { SealRecoveryIssue } from '@/application/seal/UpgradeAnchorsUseCase';
import { resolveLogPath, sealWorkerLog } from './logSources';

export async function writeSealRecoveryIssue(
  source: 'cron' | 'page',
  { pollId, operation, code }: SealRecoveryIssue
) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    source,
    level: 'error',
    pollId,
    operation,
    code,
  });

  try {
    await appendFile(resolveLogPath(sealWorkerLog), line + '\n', {
      mode: 0o600,
    });
  } catch {
    // A filesystem failure must not prevent independent polls from being processed.
    console.error('Could not append to seal-worker.log', line);
  }
}
