/** Rehydration is an aggregate boundary: saved bytes cannot bypass commitment invariants. */
import { expect, it } from 'vitest';
import fixture from './fixtures/record-v1.json';
import { PollSeal } from '../PollSeal';
import { canonical } from '../Canonical';
import { hashText } from '../Hash';
import { SealedRecord } from '../RecordFormat';

function rehash(record: SealedRecord) {
  const manifest = JSON.parse(record.manifest);

  for (const key of ['poll', 'tallies', 'register', 'signers'] as const) {
    manifest.sections[key].hash = hashText(record.sections[key]);
  }

  record.manifest = canonical(manifest);
  record.rootDigest = hashText(record.manifest);
}

it('rehydrates exactly the immutable record, without sharing mutable references', () => {
  const record = structuredClone(fixture.record);
  const result = PollSeal.reconstitute(record);
  expect(result.success).toBe(true);

  if (!result.success) {
    return;
  }

  record.votes[0].hash = '00'.repeat(32);
  expect(result.value.record).toEqual(fixture.record);
});

it.each<[string, (record: SealedRecord) => void, string]>([
  [
    'digest',
    (r) => {
      r.rootDigest = '00'.repeat(32);
    },
    'inconsistentRecord',
  ],
  [
    'section',
    (r) => {
      r.sections.signers = '[]';
    },
    'inconsistentRecord',
  ],
  [
    'version',
    (r) => {
      const m = JSON.parse(r.manifest);
      m.version = 2;
      r.manifest = canonical(m);
    },
    'versionUnsupported',
  ],
  [
    'algorithm',
    (r) => {
      const m = JSON.parse(r.manifest);
      m.algorithm = 'md5';
      r.manifest = canonical(m);
    },
    'algorithmUnsupported',
  ],
  [
    'manifest whitespace',
    (r) => {
      r.manifest += '\n';
    },
    'invalidCanonical',
  ],
  [
    'leaf',
    (r) => {
      r.votes[0].preimage.weight = '0.000000';
    },
    'inconsistentRecord',
  ],
  [
    'missing leaf',
    (r) => {
      r.votes.pop();
    },
    'inconsistentRecord',
  ],
  [
    'reordered leaves',
    (r) => {
      r.votes.reverse();
    },
    'inconsistentRecord',
  ],
  [
    'reordered register',
    (r) => {
      r.sections.register = canonical(
        JSON.parse(r.sections.register).reverse()
      );
      rehash(r);
    },
    'inconsistentRecord',
  ],
  [
    'invented tally',
    (r) => {
      const t = JSON.parse(r.sections.tallies);
      t.totalParticipantWeight = '99.000000';
      r.sections.tallies = canonical(t);
      rehash(r);
    },
    'inconsistentRecord',
  ],
  [
    'unconsented phone',
    (r) => {
      const s = JSON.parse(r.sections.signers);
      s[1].phoneNumber = '+70000000002';
      r.sections.signers = canonical(s);
      rehash(r);
    },
    'inconsistentRecord',
  ],
])('refuses persisted %s', (_, mutate, code) => {
  const record = structuredClone(fixture.record);
  mutate(record);
  const result = PollSeal.reconstitute(record);
  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error).toBe(`domain.seal.${code}`);
  }
});

it('detects a change to every committed scalar in the complete golden record', () => {
  function mutations(value: any): any[] {
    if (value === null) {
      return ['changed'];
    }

    if (typeof value === 'string') {
      return [`${value}x`];
    }

    if (typeof value === 'number') {
      return [value + 1];
    }

    if (typeof value === 'boolean') {
      return [!value];
    }

    return Object.keys(value).flatMap((key) =>
      mutations(value[key]).map((changed) => {
        const copy = structuredClone(value);
        copy[key] = changed;

        return copy;
      })
    );
  }

  for (const section of ['poll', 'tallies', 'register', 'signers'] as const) {
    for (const changed of mutations(
      JSON.parse(fixture.record.sections[section])
    )) {
      const record = structuredClone(fixture.record);
      record.sections[section] = canonical(changed);
      expect(PollSeal.reconstitute(record).success).toBe(false);
    }
  }

  for (const changed of mutations(JSON.parse(fixture.record.manifest))) {
    expect(
      PollSeal.reconstitute({ ...fixture.record, manifest: canonical(changed) })
        .success
    ).toBe(false);
  }

  for (const changed of mutations(fixture.record.votes)) {
    expect(
      PollSeal.reconstitute({ ...fixture.record, votes: changed }).success
    ).toBe(false);
  }
});
