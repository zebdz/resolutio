/** Exact weight arithmetic for sealed tallies, including sums above a database row's limit. */
import { describe, expect, it } from 'vitest';
import { Weight } from '../Weight';

it('compares weights by value, including independently constructed sums', () => {
  const one = Weight.fromDecimalString('1.000000');
  const two = Weight.fromDecimalString('2.000000');
  expect(one.add(one).equals(two)).toBe(true);
  expect(one.equals(two)).toBe(false);
  expect(one.equals(Weight.fromDecimalString('1.000000'))).toBe(true);
});

describe('Weight', () => {
  it('adds participant weights without rounding or limiting the tally to one row', () => {
    const weight = Weight.fromDecimalString('999999999.999999');
    const total = weight.add(Weight.fromDecimalString('0.000001'));
    expect(total.toDecimalString()).toBe('1000000000.000000');
    expect(weight.toDecimalString()).toBe('999999999.999999');
  });

  it.each([
    '-1.000000',
    '1',
    '01.000000',
    '0.0000001',
    '1e-6',
    'NaN',
    '1000000000.000000',
  ])('rejects noncanonical or out-of-range row weight %s', (value) => {
    expect(() => Weight.fromDecimalString(value)).toThrow(
      'domain.seal.invalidWeight'
    );
  });
});
