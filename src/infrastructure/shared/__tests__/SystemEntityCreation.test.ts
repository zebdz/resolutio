/** Production creation adapters generate UUID identities and canonical instants.
 * Validation remains owned by the requested identity type at the boundary. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { identifier } from '@/domain/shared/Identifier';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { CryptoIdGenerator, SystemClock } from '../SystemEntityCreation';

afterEach(() => {
  vi.useRealTimers();
});

describe('system entity creation', () => {
  it('generates distinct UUIDs validated as the requested identity type', () => {
    const ids = new CryptoIdGenerator();
    const first = ids.generate(UserId);
    const second = ids.generate(UserId);

    expect(z.uuidv4().safeParse(first).success).toBe(true);
    expect(UserId.parse(first)).toBe(first);
    expect(first).not.toBe(second);
  });

  it('honors a rejecting identity schema rather than manufacturing a brand', () => {
    const RestrictedId = identifier('RestrictedTestId', /^reserved_identity$/);

    expect(() => new CryptoIdGenerator().generate(RestrictedId)).toThrow();
  });

  it('reads system time as an immutable canonical instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T10:00:00.123Z'));
    const clock = new SystemClock();
    const first = clock.now();
    vi.setSystemTime(new Date('2026-10-26T10:00:00.456Z'));

    expect(first).toBe(Instant.parse('2026-10-26T10:00:00.123Z'));
    expect(clock.now()).toBe(Instant.parse('2026-10-26T10:00:00.456Z'));
  });
});
