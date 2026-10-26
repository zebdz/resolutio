/** Independent decoded-key HMAC and prefixed-leaf vectors protect the wire format. */
import { expect, it } from 'vitest';
import vectors from './fixtures/crypto-v1.json';
import {
  deriveSalt,
  hashLeaf,
  parseVotePreimage,
  votePreimageData,
} from '../VoteLeaf';
import { AnswerId, QuestionId, ReceiptSecret } from '../SealValues';

it('parses a vote into validated domain values and exports the original bytes', () => {
  const source = vectors.leaves[0];
  const vote = parseVotePreimage(source.preimage);
  expect(vote.weight.toDecimalString()).toBe(source.preimage.weight);
  expect(votePreimageData(vote)).toEqual(source.preimage);
  expect(hashLeaf(vote)).toBe(source.hash);
});

it('exports only committed vote fields even when a typed client supplies extra private data', () => {
  const source = vectors.leaves[0];
  const voteWithSecret = {
    ...parseVotePreimage(source.preimage),
    receiptSecret: ReceiptSecret.parse(vectors.secret),
  };
  expect(votePreimageData(voteWithSecret)).toEqual(source.preimage);
  expect(hashLeaf(voteWithSecret)).toBe(source.hash);
});

it('recreates the original salted vote from the participant secret and exact persisted timestamp', () => {
  for (const leaf of vectors.leaves) {
    expect(
      deriveSalt(
        ReceiptSecret.parse(vectors.secret),
        QuestionId.parse(leaf.preimage.questionId),
        AnswerId.parse(leaf.preimage.answerId)
      )
    ).toBe(leaf.preimage.salt);
    expect(hashLeaf(parseVotePreimage(leaf.preimage))).toBe(leaf.hash);
  }
});

it('refuses ambiguous ids, noncanonical weights, dates, salts and extra preimage fields', () => {
  const original = vectors.leaves[0].preimage;

  for (const change of [
    { weight: '1.0' },
    { castAt: '2026-09-11' },
    { salt: 'AA'.repeat(32) },
    { userId: '' },
    { extra: true },
    { userId: 'e\u0301' },
  ]) {
    expect(() => parseVotePreimage({ ...original, ...change })).toThrow();
  }

  expect(() => QuestionId.parse('q:a')).toThrow();
  expect(() => ReceiptSecret.parse('short')).toThrow();
});
