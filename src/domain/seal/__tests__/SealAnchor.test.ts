/** Aggregate-owned anchor lifecycle. Proof bytes here are test doubles for provider-validated evidence;
 * actual OTS parsing and Bitcoin verification belong to the Phase 4 adapter contract tests. */
import { expect, it } from 'vitest';
import fixture from './fixtures/record-v1.json';
import { PollSeal } from '../PollSeal';
import {
  AnchorId,
  AnchorProof,
  AnchorFailureCode,
  BitcoinHeight,
  Digest,
  UtcTimestamp,
} from '../SealValues';

function seal() {
  return PollSeal.fromRecord(fixture.record);
}

const at = UtcTimestamp.parse('2026-09-11T11:06:00.000Z');
const later = (minutes: number) =>
  UtcTimestamp.fromDate(new Date(Date.parse(at) + minutes * 60000));
const pending = () => ({
  kind: 'pending' as const,
  rootDigest: Digest.parse(fixture.record.rootDigest),
  proof: AnchorProof.parse(new Uint8Array([1, 2, 3])),
});

it('recovers an initial failed submission without inventing a proof or submission time', () => {
  const record = seal();
  expect(
    record.failAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      error: AnchorFailureCode.parse('calendar_unavailable'),
      at,
    }).success
  ).toBe(true);
  expect(record.activeAnchor()).toMatchObject({
    id: AnchorId.parse('anchor1'),
    status: 'FAILED',
    attempts: 1,
    pendingProof: null,
    submittedAt: null,
    nextAttemptAt: later(5),
  });
  expect(
    record.submitAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      evidence: pending(),
      at: later(4),
    }).success
  ).toBe(false);
  expect(
    record.submitAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      evidence: pending(),
      at: later(5),
    }).success
  ).toBe(true);
  expect(record.activeAnchor()).toMatchObject({
    status: 'SUBMITTED',
    attempts: 2,
    lastError: null,
    submittedAt: later(5),
  });
  expect(record.record).toEqual(fixture.record);
});

it('confirms only matching verified Bitcoin evidence after a real submission', () => {
  const record = seal();
  const evidence = {
    kind: 'bitcoin' as const,
    rootDigest: record.rootDigest,
    proof: AnchorProof.parse(new Uint8Array([4, 5])),
    bitcoinHeight: BitcoinHeight.parse(900000),
    bitcoinTime: later(60),
  };
  expect(record.confirmAnchor(evidence, later(61)).success).toBe(false);
  const proof = pending();
  expect(
    record.submitAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      evidence: proof,
      at,
    }).success
  ).toBe(true);
  proof.proof[0] = 99;
  expect(record.activeAnchor()!.pendingProof![0]).toBe(1);
  const before = record.anchors;

  for (const invalid of [
    pending(),
    { ...evidence, rootDigest: Digest.parse('00'.repeat(32)) },
    { ...evidence, bitcoinHeight: 0 },
    { ...evidence, bitcoinTime: '2026-02-30T00:00:00.000Z' },
    { ...evidence, proof: new Uint8Array() },
  ]) {
    expect(record.confirmAnchor(invalid as any, later(61)).success).toBe(false);
    expect(record.anchors).toEqual(before);
  }

  expect(record.confirmAnchor(evidence, later(61)).success).toBe(true);
  expect(record.activeAnchor()).toMatchObject({
    status: 'CONFIRMED',
    bitcoinHeight: BitcoinHeight.parse(900000),
    bitcoinTime: later(60),
    confirmedAt: later(61),
    nextAttemptAt: null,
  });
  expect(record.confirmAnchor(evidence, later(62)).success).toBe(false);
  expect(
    record.failAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      error: AnchorFailureCode.parse('later_failure'),
      at: later(70),
    }).success
  ).toBe(false);
  const simulated = seal();
  simulated.submitAnchor({
    id: AnchorId.parse('stub1'),
    provider: 'stub',
    evidence: { ...pending(), kind: 'simulated' },
    at,
  });
  expect(simulated.confirmAnchor(evidence, later(61)).success).toBe(false);
});

it('caps failure backoff at one day and refuses early retries without changing state', () => {
  const record = seal();
  let now = at;

  for (const minutes of [5, 15, 60, 360, 1440, 1440]) {
    expect(
      record.failAnchor({
        id: AnchorId.parse('anchor1'),
        provider: 'opentimestamps',
        error: AnchorFailureCode.parse('unavailable'),
        at: now,
      }).success
    ).toBe(true);
    const next = UtcTimestamp.fromDate(
      new Date(Date.parse(now) + minutes * 60000)
    );
    expect(record.activeAnchor()!.nextAttemptAt).toBe(next);
    const before = record.anchors;
    expect(
      record.failAnchor({
        id: AnchorId.parse('anchor1'),
        provider: 'opentimestamps',
        error: AnchorFailureCode.parse('early'),
        at: now,
      }).success
    ).toBe(false);
    expect(record.anchors).toEqual(before);
    now = next;
  }
});

it('atomically supersedes a stale pending anchor even when its replacement failed submission', () => {
  const record = seal();
  record.submitAnchor({
    id: AnchorId.parse('anchor1'),
    provider: 'opentimestamps',
    evidence: pending(),
    at,
  });
  const replacement = {
    id: AnchorId.parse('anchor2'),
    provider: 'opentimestamps' as const,
    error: AnchorFailureCode.parse('unavailable'),
    at: later(4321),
  };
  expect(
    record.supersedeAnchor({ ...replacement, at: later(4320) }).success
  ).toBe(false);
  expect(
    record.supersedeAnchor({ ...replacement, id: AnchorId.parse('anchor1') })
      .success
  ).toBe(false);
  expect(record.supersedeAnchor(replacement).success).toBe(true);
  expect(record.anchors.map((a) => [a.id, a.status])).toEqual([
    ['anchor1', 'SUPERSEDED'],
    ['anchor2', 'FAILED'],
  ]);
  expect(record.anchors[0].nextAttemptAt).toBeNull();
  expect(
    record.submitAnchor({
      id: AnchorId.parse('anchor3'),
      provider: 'opentimestamps',
      evidence: pending(),
      at: later(4330),
    }).success
  ).toBe(false);
  const state = record.anchors;
  expect(PollSeal.reconstitute(record.record, state).success).toBe(true);
  const invalidState = state.map((anchor) => ({
    ...anchor,
    status: 'SUBMITTED',
  }));
  expect(PollSeal.reconstitute(record.record, invalidState).success).toBe(
    false
  );
});

it('rejects invalid persisted anchor evidence and keeps read snapshots detached', () => {
  const record = seal();
  record.submitAnchor({
    id: AnchorId.parse('anchor1'),
    provider: 'opentimestamps',
    evidence: pending(),
    at,
  });
  const saved = record.anchors;
  record.activeAnchor()!.pendingProof![0] = 99;
  expect(record.anchors).toEqual(saved);

  for (const changed of [
    { pendingProof: null },
    { submittedAt: null },
    { attempts: 0 },
    { provider: 'unknown' },
    { status: 'CONFIRMED' },
    { status: 'SUPERSEDED' },
    { createdAt: later(60) },
  ]) {
    const result = PollSeal.reconstitute(record.record, [
      { ...saved[0], ...changed },
    ] as any);
    expect(result.success).toBe(false);
  }

  expect(PollSeal.reconstitute(record.record, saved).success).toBe(true);
});

it('upgrades pending proof and throttles another nudge without changing submission age', () => {
  const record = seal();
  record.submitAnchor({
    id: AnchorId.parse('anchor1'),
    provider: 'opentimestamps',
    evidence: pending(),
    at,
  });
  expect(
    record.refreshAnchor(
      { ...pending(), proof: AnchorProof.parse(new Uint8Array([7, 8])) },
      later(9)
    ).success
  ).toBe(false);
  expect(
    record.refreshAnchor(
      { ...pending(), proof: AnchorProof.parse(new Uint8Array([7, 8])) },
      later(10)
    ).success
  ).toBe(true);
  expect(record.activeAnchor()).toMatchObject({
    status: 'SUBMITTED',
    pendingProof: new Uint8Array([7, 8]),
    submittedAt: at,
    nextAttemptAt: later(20),
  });
  const snapshot = record.anchors;
  expect(
    record.refreshAnchor(
      { ...pending(), rootDigest: Digest.parse('00'.repeat(32)) },
      later(20)
    ).success
  ).toBe(false);
  expect(record.anchors).toEqual(snapshot);
});

it('recovers a seal with only historical anchors without reusing their identities', () => {
  const original = seal();
  original.submitAnchor({
    id: AnchorId.parse('anchor1'),
    provider: 'opentimestamps',
    evidence: pending(),
    at,
  });
  const historical = {
    ...original.anchors[0],
    status: 'SUPERSEDED' as const,
    nextAttemptAt: null,
  };
  const restored = PollSeal.reconstitute(original.record, [historical]);
  expect(restored.success).toBe(true);

  if (!restored.success) {
    return;
  }

  expect(
    restored.value.submitAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      evidence: pending(),
      at: later(5000),
    }).success
  ).toBe(false);
  expect(
    restored.value.failAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      error: AnchorFailureCode.parse('unavailable'),
      at: later(5000),
    }).success
  ).toBe(false);
  expect(
    restored.value.submitAnchor({
      id: AnchorId.parse('anchor2'),
      provider: 'opentimestamps',
      evidence: pending(),
      at: later(5000),
    }).success
  ).toBe(true);
  expect(restored.value.anchors[0]).toEqual(historical);
});

it('owns proof bytes even when a Node adapter supplies Buffer views', () => {
  const record = seal();
  const submitted = Buffer.from([1, 2, 3]);
  record.submitAnchor({
    id: AnchorId.parse('anchor1'),
    provider: 'opentimestamps',
    evidence: { ...pending(), proof: submitted as unknown as AnchorProof },
    at,
  });
  submitted[0] = 99;
  expect(record.activeAnchor()!.pendingProof![0]).toBe(1);
  const refreshed = Buffer.from([4, 5, 6]);
  record.refreshAnchor(
    { ...pending(), proof: refreshed as unknown as AnchorProof },
    later(10)
  );
  refreshed[0] = 99;
  expect(record.activeAnchor()!.pendingProof![0]).toBe(4);
  const confirmed = Buffer.from([7, 8, 9]);
  record.confirmAnchor(
    {
      kind: 'bitcoin',
      rootDigest: record.rootDigest,
      proof: confirmed as unknown as AnchorProof,
      bitcoinHeight: BitcoinHeight.parse(900000),
      bitcoinTime: later(60),
    },
    later(61)
  );
  confirmed[0] = 99;
  expect(record.activeAnchor()!.confirmedProof![0]).toBe(7);
});

it('rehydrates failed submissions with paired proof and time, preserving both on retry', () => {
  const original = seal();
  original.submitAnchor({
    id: AnchorId.parse('anchor1'),
    provider: 'opentimestamps',
    evidence: pending(),
    at,
  });
  const failed = {
    ...original.anchors[0],
    status: 'FAILED',
    lastError: 'calendar_unavailable',
    nextAttemptAt: later(5),
  };
  const restored = PollSeal.reconstitute(original.record, [failed]);
  expect(restored.success).toBe(true);

  if (!restored.success) {
    return;
  }

  expect(
    restored.value.failAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      error: AnchorFailureCode.parse('calendar_unavailable'),
      at: later(5),
    }).success
  ).toBe(true);
  expect(restored.value.activeAnchor()).toMatchObject({
    status: 'FAILED',
    submittedAt: at,
    pendingProof: pending().proof,
    attempts: 2,
  });
  expect(
    PollSeal.reconstitute(original.record, [{ ...failed, submittedAt: null }])
      .success
  ).toBe(false);
  expect(
    PollSeal.reconstitute(original.record, [{ ...failed, pendingProof: null }])
      .success
  ).toBe(false);
});
