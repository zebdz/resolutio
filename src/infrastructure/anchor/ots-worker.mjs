/** Isolate the OTS library's console output, mutable globals and uncancellable HTTP calls.
 * The parent terminates this worker at the deadline, closing outstanding calendar requests. */
import ots from 'opentimestamps/index.js';

const { parentPort, workerData } = process.getBuiltinModule('worker_threads');

async function run({ action, digest, proof, config }) {
  const original = ots.DetachedTimestampFile.fromHash(
    new ots.Ops.OpSHA256(),
    Buffer.from(digest, 'hex')
  );
  const stamped = proof
    ? ots.DetachedTimestampFile.deserialize(proof)
    : original;

  if (
    !(stamped.fileHashOp instanceof ots.Ops.OpSHA256) ||
    Buffer.from(stamped.fileDigest()).toString('hex') !== digest
  ) {
    return { kind: 'invalid' };
  }

  // 0.4.9 passes the top-level options directly to its Esplora constructor.
  const options = {
    calendars: config.calendars,
    url: config.esploraUrl,
    timeout: config.timeoutMs,
    ignoreBitcoinNode: true,
  };
  // The client suppresses calendar failures and otherwise returns the same value
  // for a 404 and a network outage. This override is private to this one worker.
  let reachable = false;
  const deadline = Math.max(
    1,
    config.timeoutMs - Math.min(1000, config.timeoutMs / 2)
  );
  const Calendar = ots.Calendar.RemoteCalendar;
  ots.Calendar.RemoteCalendar = class extends Calendar {
    constructor(url) {
      super(url);
      this.timeout = deadline;
    }
    async getTimestamp(commitment) {
      try {
        const updated = await super.getTimestamp(commitment);
        reachable = true;

        return updated;
      } catch (error) {
        if (error instanceof ots.Calendar.CommitmentNotFoundError) {
          reachable = true;
        }

        throw error;
      }
    }
  };

  if (action === 'submit') {
    await ots.stamp(stamped, options);
  } else if (action === 'upgrade' && !stamped.timestamp.isTimestampComplete()) {
    await ots.upgrade(stamped, options);

    if (!reachable) {
      return { kind: 'unavailable' };
    }
  }

  const attestations = [...stamped.timestamp.getAttestations()];
  const hasBitcoin = attestations.some(
    (att) => att instanceof ots.Notary.BitcoinBlockHeaderAttestation
  );

  if (
    (!hasBitcoin || action === 'submit') &&
    !attestations.some((att) => att instanceof ots.Notary.PendingAttestation)
  ) {
    return { kind: 'invalid' };
  }

  const bytes = Uint8Array.from(stamped.serializeToBytes());

  if (action === 'verify') {
    // verify() performs another calendar upgrade. Verify exactly the bytes we retained.
    const result = await ots.verifyTimestamp(stamped.timestamp, options);

    if (result.bitcoin) {
      return {
        kind: 'bitcoin',
        height: result.bitcoin.height,
        time: result.bitcoin.timestamp,
        proof: bytes,
      };
    }
  }

  return { kind: 'pending', proof: bytes, hasBitcoin };
}

run(workerData).then(
  (result) => parentPort.postMessage(result),
  () => parentPort.postMessage({ kind: 'invalid' })
);
