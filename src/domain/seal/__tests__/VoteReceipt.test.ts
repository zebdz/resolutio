/** Cast-time receipt evidence preserves original leaves, labels and the secret across replay. */
import { expect, it } from 'vitest';
import fixture from './fixtures/record-v1.json';
import { VoteReceipt } from '../VoteReceipt';

it('creates and reloads the independently calculated versioned receipt', () => {
  const input = fixture.input;
  const result = VoteReceipt.create({
    pollId: input.poll.id,
    userId: 'user1',
    receiptSecret: input.participants[2].receiptSecret!,
    pollTitle: input.poll.title,
    votes: input.votes
      .filter((v) => v.userId === 'user1')
      .map((v) => {
        const question = input.poll.questions.find(
          (q) => q.id === v.questionId
        )!;

        return {
          ...v,
          questionText: question.text,
          answerText: question.answers.find((a) => a.id === v.answerId)!.text,
        };
      }),
  });
  expect(result.success).toBe(true);

  if (!result.success) {
    return;
  }

  expect(result.value.bytes).toBe(fixture.receipt);
  const restored = VoteReceipt.parse(fixture.receipt);
  expect(restored.success).toBe(true);

  if (!restored.success) {
    return;
  }

  restored.value.data.leaves[0].preimage.weight = '0.000000';
  expect(restored.value.bytes).toBe(fixture.receipt);
});

it.each<[string, (r: any) => void, string]>([
  [
    'version',
    (r) => {
      r.version = 2;
    },
    'versionUnsupported',
  ],
  [
    'algorithm',
    (r) => {
      r.algorithm = 'sha512';
    },
    'algorithmUnsupported',
  ],
  [
    'secret',
    (r) => {
      r.receiptSecret = 'ff'.repeat(32);
    },
    'inconsistentRecord',
  ],
  [
    'hash',
    (r) => {
      r.leaves[0].hash = 'ff'.repeat(32);
    },
    'inconsistentRecord',
  ],
  [
    'salt',
    (r) => {
      r.leaves[0].preimage.salt = 'ff'.repeat(32);
    },
    'inconsistentRecord',
  ],
  [
    'poll',
    (r) => {
      r.pollId = 'another';
    },
    'inconsistentRecord',
  ],
  [
    'user',
    (r) => {
      r.userId = 'another';
    },
    'inconsistentRecord',
  ],
  [
    'ordering',
    (r) => {
      r.leaves.reverse();
    },
    'inconsistentRecord',
  ],
  [
    'duplicate leaf',
    (r) => {
      r.leaves.push(r.leaves[0]);
    },
    'inconsistentRecord',
  ],
  [
    'empty ballot',
    (r) => {
      r.leaves = [];
    },
    'inconsistentRecord',
  ],
  [
    'unexpected field',
    (r) => {
      r.other = 1;
    },
    'inconsistentRecord',
  ],
])('refuses invalid receipt %s', async (_, change, code) => {
  const { canonical } = await import('../Canonical');
  const receipt = JSON.parse(fixture.receipt);
  change(receipt);
  const result = VoteReceipt.parse(canonical(receipt));
  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error).toBe(`domain.seal.${code}`);
  }
});
