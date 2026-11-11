/** Full record client contract: frozen sections, exact tallies and explicit consent. */
import { expect, it } from 'vitest';
import fixture from './fixtures/record-v1.json';
import { SealedRecordBuilder } from '../SealedRecordBuilder';
import { SealInput } from '../SealInput';
import { LeafCount } from '../SealValues';
import { registerEntrySchema, registerEntryData } from '../RecordFormat';

export function sampleInput(): SealInput {
  return structuredClone(fixture.input) as SealInput;
}

export function buildSample() {
  const result = SealedRecordBuilder.build(
    sampleInput(),
    new Date(fixture.sealedAt)
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}

it('exports only register fields even when typed input carries private participant and holding data', () => {
  const original = JSON.parse(fixture.record.sections.register)[0];
  const entry = registerEntrySchema.parse(original);
  const privateParticipant = {
    ...entry,
    receiptSecret: fixture.input.participants[2].receiptSecret,
    phoneNumber: '+70000000001',
    willingToSignProtocol: true,
    holdings: entry.holdings.map((holding) => ({
      ...holding,
      privateNote: 'private',
    })),
  };
  expect(registerEntryData(privateParticipant)).toEqual(original);
});

it('seals a complete snapshot into the independently calculated five-section record', () => {
  const seal = buildSample();
  expect(seal.record).toEqual(fixture.record);
  expect(seal.pollId).toBe('poll1');
  expect(seal.rootDigest).toBe(fixture.record.rootDigest);
  expect(seal.activeAnchor()).toBeNull();
  expect(JSON.stringify(seal.record)).not.toContain(
    fixture.input.participants[2].receiptSecret
  );
});

it.each<[string, (input: SealInput) => void, string]>([
  [
    'unfinished poll',
    (s) => {
      s.state = 'ACTIVE';
    },
    'pollNotFinished',
  ],
  [
    'legacy finished poll',
    (s) => {
      s.poll.finishedAt = null;
    },
    'pollNotFinished',
  ],
  [
    'missing secret',
    (s) => {
      s.participants[2].receiptSecret = null;
    },
    'missingReceiptSecret',
  ],
  [
    'unknown voter',
    (s) => {
      s.votes[0].userId = 'outsider';
    },
    'inconsistentRecord',
  ],
  [
    'wrong poll',
    (s) => {
      s.votes[0].pollId = 'another';
    },
    'inconsistentRecord',
  ],
  [
    'unknown question',
    (s) => {
      s.votes[0].questionId = 'unknown';
    },
    'inconsistentRecord',
  ],
  [
    'wrong answer',
    (s) => {
      s.votes[0].answerId = 'a1';
    },
    'inconsistentRecord',
  ],
  [
    'archived answer',
    (s) => {
      s.votes[1].answerId = 'a9';
    },
    'inconsistentRecord',
  ],
  [
    'archived question',
    (s) => {
      s.votes[0].questionId = 'q0';
      s.votes[0].answerId = 'old';
    },
    'inconsistentRecord',
  ],
  [
    'duplicate vote',
    (s) => {
      s.votes.push({ ...s.votes[0] });
    },
    'inconsistentRecord',
  ],
  [
    'duplicate participant',
    (s) => {
      s.participants.push({ ...s.participants[0] });
    },
    'inconsistentRecord',
  ],
  [
    'duplicate question id',
    (s) => {
      s.poll.questions.push({ ...s.poll.questions[0] });
    },
    'inconsistentRecord',
  ],
  [
    'duplicate answer id',
    (s) => {
      s.poll.questions[2].answers.push({ ...s.poll.questions[0].answers[0] });
    },
    'inconsistentRecord',
  ],
  [
    'changed weight',
    (s) => {
      s.votes[0].weight = '3.000000';
    },
    'inconsistentRecord',
  ],
  [
    'partial ballot',
    (s) => {
      s.votes.shift();
    },
    'inconsistentRecord',
  ],
  [
    'multiple single choices',
    (s) => {
      s.poll.questions[2].questionType = 'single-choice';
    },
    'inconsistentRecord',
  ],
  [
    'vote after finish',
    (s) => {
      s.votes[0].castAt = '2026-09-12T00:00:00.000Z';
    },
    'inconsistentRecord',
  ],
  [
    'capture before finish',
    (s) => {
      s.poll.metadataCapturedAt = '2026-09-10T00:00:00.000Z';
    },
    'inconsistentRecord',
  ],
  [
    'unpaired board name',
    (s) => {
      s.poll.boardName = 'Board';
    },
    'inconsistentRecord',
  ],
  [
    'invalid share precision',
    (s) => {
      s.participants[2].holdings[0].share = '0.123456';
    },
    'inconsistentRecord',
  ],
  [
    'unexpected input field',
    (s) => {
      (s.poll as any).other = 1;
    },
    'inconsistentRecord',
  ],
])('refuses %s', (_, change, code) => {
  const input = sampleInput();
  change(input);
  expect(SealedRecordBuilder.build(input, new Date(fixture.sealedAt))).toEqual({
    success: false,
    error: `domain.seal.${code}`,
  });
});

it('normalizes text once, orders collections deterministically and freezes all returned data', () => {
  const input = sampleInput();
  input.poll.title = 'Cafe\u0301';
  input.participants.reverse();
  input.votes.reverse();
  input.poll.questions.reverse();
  input.poll.questions.forEach((q) => q.answers.reverse());
  input.poll.attachments.reverse();
  input.poll.propertyIds.reverse();
  const built = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));
  expect(built.success).toBe(true);

  if (!built.success) {
    return;
  }

  expect(built.value.record).toEqual(fixture.record);
  input.poll.title = 'Changed';
  built.value.record.sections.signers = '[]';
  built.value.record.votes[0].preimage.weight = '0.000000';
  built.value.manifest.sections.votes.leafCount = LeafCount.parse(0);
  expect(built.value.record).toEqual(fixture.record);
});

it('keeps signer consent separate, omits missing decisions/nonvoters, and hashes the empty list', () => {
  const input = sampleInput();
  input.participants.forEach((p) => {
    p.willingToSignProtocol = null;
  });
  const built = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));
  expect(built.success).toBe(true);

  if (!built.success) {
    return;
  }

  expect(built.value.record.sections.signers).toBe('[]');
  expect(built.value.manifest.sections.signers.hash).toBe(
    '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
  );
  expect(built.value.record.sections.register).not.toContain('phoneNumber');
  expect(built.value.record.sections.register).not.toContain(
    'willingToSignProtocol'
  );
});

it.each(['named', 'open', 'empty'] as const)(
  'covers %s polls with the same section commitments',
  (kind) => {
    const input = sampleInput();
    input.poll.anonymous = false;

    if (kind === 'open') {
      input.poll.pollType = 'OPEN';
      input.poll.distributionType = 'EQUAL';
      input.poll.propertyIds = [];
      input.participants = input.participants
        .filter((p) => p.receiptSecret !== null)
        .map((p) => ({ ...p, weight: '1.000000', holdings: [] }));
      input.votes.forEach((v) => {
        v.weight = '1.000000';
      });
    }

    if (kind === 'empty') {
      input.votes = [];
      input.participants.forEach((p) => {
        p.receiptSecret = null;
      });
    }

    const built = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));
    expect(built.success).toBe(true);

    if (!built.success) {
      return;
    }

    expect(Object.keys(built.value.manifest.sections).sort()).toEqual([
      'poll',
      'register',
      'signers',
      'tallies',
      'votes',
    ]);
    const register = JSON.parse(built.value.record.sections.register);

    if (kind === 'open') {
      expect(register).toHaveLength(2);
      expect(register.every((p: any) => p.voted)).toBe(true);
    }

    if (kind === 'empty') {
      expect(built.value.manifest.sections.votes).toEqual({
        leafCount: 0,
        root: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
    }
  }
);

it('preserves holding precision/order and a willing voter without a phone', () => {
  const input = sampleInput();
  const person = input.participants[2];
  person.phoneNumber = null;
  person.holdings.unshift({
    ...person.holdings[0],
    propertyId: 'property2',
    assetId: 'asset2',
    size: '999999999.999999',
    share: '0.00000001',
  });
  const first = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));
  person.holdings.reverse();
  const second = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));
  expect(first.success && second.success).toBe(true);

  if (!first.success || !second.success) {
    return;
  }

  expect(first.value.rootDigest).toBe(second.value.rootDigest);
  const register = JSON.parse(first.value.record.sections.register);
  expect(register[0].holdings[1]).toMatchObject({
    size: '999999999.999999',
    share: '0.00000001',
  });
  expect(JSON.parse(first.value.record.sections.signers)[0]).toMatchObject({
    willingToSignProtocol: true,
    phoneNumber: null,
  });
});

it('keeps exact tallies when totals exceed Decimal(15,6)', () => {
  const input = sampleInput();
  input.participants.forEach((p) => {
    p.weight = '999999999.999999';
  });
  input.votes.forEach((v) => {
    v.weight = '999999999.999999';
  });
  const result = SealedRecordBuilder.build(input, new Date(fixture.sealedAt));
  expect(result.success).toBe(true);

  if (!result.success) {
    return;
  }

  const tallies = JSON.parse(result.value.record.sections.tallies);
  expect(tallies.totalParticipantWeight).toBe('2999999999.999997');
  expect(tallies.questions[0]).toMatchObject({
    totalWeight: '2999999999.999997',
    participantWeight: '1999999999.999998',
  });
});
