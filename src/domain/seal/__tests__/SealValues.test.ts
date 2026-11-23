/** Boundary values reject malformed external data while retaining exact wire representations.
 * Brands add compile-time distinctions; these checks cover the runtime half of that contract. */
import { expect, it } from 'vitest';
import {
  AnchorProof,
  AttemptCount,
  BitcoinHeight,
  Digest,
  FencingToken,
  PollId,
  ReceiptSecret,
  UtcTimestamp,
  OwnershipShare,
} from '../SealValues';
import { OwnershipShare as OrganizationShare } from '../../organization/PropertyValues';
import { sealResult } from '../SealDomainCodes';

it('keeps organization zero shares separate from positive sealed holding rows', () => {
  const zero = OrganizationShare.parse(0);
  expect(zero).toBe(0);
  expect(sealResult(() => OwnershipShare.parse(zero.toFixed(8))).success).toBe(
    false
  );
  const positive = OrganizationShare.parse(0.00000001);
  expect(OwnershipShare.parse(positive.toFixed(8))).toBe('0.00000001');
});

it.each([
  () => PollId.parse(''),
  () => PollId.parse('question:answer'),
  () => PollId.parse('x'.repeat(257)),
  () => ReceiptSecret.parse('ab'.repeat(31)),
  () => Digest.parse('AB'.repeat(32)),
  () => UtcTimestamp.parse('2026-09-11'),
  () => UtcTimestamp.parse('2026-02-30T00:00:00.000Z'),
  () => UtcTimestamp.fromDate(new Date(NaN)),
  () => BitcoinHeight.parse(0),
  () => BitcoinHeight.parse(1.5),
  () => AttemptCount.parse(Number.MAX_SAFE_INTEGER + 1),
  () => FencingToken.parse(BigInt(-1)),
  () => AnchorProof.parse(new Uint8Array()),
])('rejects invalid domain value %# through the Result boundary', (parse) => {
  expect(sealResult<unknown>(parse).success).toBe(false);
});

it('preserves valid values and owns proof bytes supplied by an adapter', () => {
  const secret = 'ab'.repeat(32);
  expect(ReceiptSecret.parse(secret)).toBe(secret);
  expect(Digest.parse(secret)).toBe(secret);
  const date = new Date('2026-09-11T00:00:00.000Z');
  const time = UtcTimestamp.fromDate(date);
  date.setUTCFullYear(2027);
  expect(time).toBe('2026-09-11T00:00:00.000Z');
  const source = Buffer.from([1, 2, 3]);
  const proof = AnchorProof.parse(source);
  source[0] = 99;
  expect(proof).toEqual(new Uint8Array([1, 2, 3]));
});
