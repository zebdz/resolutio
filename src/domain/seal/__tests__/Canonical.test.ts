/** Canonical bytes are the public format: preprocessing must never repair received evidence. */
import { describe, expect, it } from 'vitest';
import { canonical, prepareNfc, parseCanonical, isoDate } from '../Canonical';

describe('canonical record bytes', () => {
  it('prepares NFC explicitly and sorts keys recursively by UTF-16, including numeric keys', () => {
    const input = { z: [{ '2': 'e\u0301', '10': 'é' }], a: 'e\u0301' };
    expect(canonical(prepareNfc(input))).toBe(
      '{"a":"é","z":[{"10":"é","2":"é"}]}'
    );
    expect(canonical(input)).toContain('e\u0301');
    expect(input.a).toBe('e\u0301');
  });

  it('rejects unsupported inputs instead of silently losing data', () => {
    const cyclic: any = {};
    cyclic.self = cyclic;

    for (const value of [
      undefined,
      NaN,
      Infinity,
      BigInt(1),
      () => 1,
      Symbol('x'),
      new Date(),
      new Map(),
      { a: undefined },
      [, 1],
      '\ud800',
      '\udc00',
      cyclic,
      { [Symbol('x')]: 1 },
    ]) {
      expect(() => canonical(value)).toThrow('domain.seal.invalidCanonical');
      expect(() => prepareNfc(value)).toThrow('domain.seal.invalidCanonical');
    }

    expect(() => prepareNfc({ 'e\u0301': 1, é: 2 })).toThrow(
      'domain.seal.invalidCanonical'
    );
  });

  it('accepts only exact canonical NFC UTF-8 bytes', () => {
    expect(parseCanonical(new TextEncoder().encode('{"a":"é"}'))).toEqual({
      a: 'é',
    });

    for (const text of [
      ' {"a":1}',
      '{"b":1,"a":2}',
      '{"a":1,"a":1}',
      '{"a":1.0}',
      '{"a":-0}',
      '{"a":"e\\u0301"}',
      '{"a":"e\u0301"}',
      '{"a":"\\ud800"}',
      '\ufeff{}',
    ]) {
      expect(() => parseCanonical(text)).toThrow(
        'domain.seal.invalidCanonical'
      );
    }

    expect(() => parseCanonical(new Uint8Array([0xff]))).toThrow(
      'domain.seal.invalidCanonical'
    );
  });

  it('uses ECMAScript numeric serialization and exact UTC millisecond dates', () => {
    expect(canonical([1e30, 4.5, 2e-3, 1e-27, -0])).toBe(
      '[1e+30,4.5,0.002,1e-27,0]'
    );
    expect(isoDate(new Date('2026-10-25T01:02:03.004Z'))).toBe(
      '2026-10-25T01:02:03.004Z'
    );

    for (const date of [
      '2026-10-25',
      '2026-02-30T00:00:00.000Z',
      '2026-10-25T00:00:00Z',
      '2026-10-25T03:00:00.000+03:00',
      new Date(NaN),
    ]) {
      expect(() => isoDate(date)).toThrow('domain.seal.inconsistentRecord');
    }
  });
});
