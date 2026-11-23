/** A bad poll cannot prevent independent work, including deferred bundle discovery. */
import { expect, it, vi } from 'vitest';
import { UpgradeAnchorsUseCase } from '../UpgradeAnchorsUseCase';
import { SealLeaseSeconds } from '../SealWorkRepository';
import { PollId } from '@/domain/seal/SealValues';
import { success, failure } from '@/domain/shared/Result';

it('continues past a rejected seal and scans for deliveries even when anchors are idle', async () => {
  const broken = PollId.parse('broken');
  const ready = PollId.parse('ready');
  const reader = {
    discover: vi.fn(async () =>
      success([
        { kind: 'seal' as const, pollId: broken },
        { kind: 'anchor' as const, pollId: ready },
      ])
    ),
  };
  const seal = {
    execute: vi.fn(async () => failure('poll.errors.pollNotFound' as const)),
  };
  const anchor = { execute: vi.fn(async () => success('idle' as const)) };
  const deliveries = vi.fn(async () => success(2));
  const recovery = new UpgradeAnchorsUseCase(
    reader,
    seal,
    anchor,
    { generate: (type) => type.parse('worker') },
    SealLeaseSeconds.parse(60),
    deliveries
  );
  const report = vi.fn();
  const result = await recovery.execute(report);
  expect(report).toHaveBeenCalledWith({
    pollId: broken,
    operation: 'seal',
    code: 'poll.errors.pollNotFound',
  });
  expect(result).toMatchObject({
    success: true,
    value: { idle: 1, errors: 1, deliveries: 2 },
  });
  expect(anchor.execute).toHaveBeenCalledOnce();
  reader.discover.mockResolvedValueOnce(success([]));
  expect(await recovery.execute()).toMatchObject({
    success: true,
    value: { idle: 0, errors: 0, deliveries: 2 },
  });
  expect(deliveries).toHaveBeenCalledTimes(2);
});
