import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getPollControlLabelKeys } from '@/src/web/components/polls/pollControlLabels';

function loadMessages(locale: string): Record<string, any> {
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'messages', `${locale}.json`),
      'utf-8'
    )
  );
}

const en = loadMessages('en');
const ru = loadMessages('ru');

const OPEN_POLL_CONTROL_KEYS = [
  'markReady',
  'markingReady',
  'markedReady',
  'confirmMarkReady',
  'backToReview',
  'returningToReview',
  'returnedToReview',
  'confirmBackToReview',
  'readyHint',
];

describe('open poll control messages', () => {
  it('poll.type block has identical keys in en and ru', () => {
    expect(Object.keys(en.poll.type).sort()).toEqual(
      Object.keys(ru.poll.type).sort()
    );
  });

  it.each(OPEN_POLL_CONTROL_KEYS)(
    'defines poll.type.%s in both locales',
    (key) => {
      expect(en.poll.type[key]).toBeTruthy();
      expect(ru.poll.type[key]).toBeTruthy();
    }
  );

  it('keeps the organization-poll snapshot copy untouched', () => {
    expect(en.poll.takeSnapshot).toBe('Freeze participants');
    expect(ru.poll.takeSnapshot).toBe('Зафиксировать участников');
  });

  it('drops the unused confirmTakeSnapshotDescription key', () => {
    expect(en.poll.confirmTakeSnapshotDescription).toBeUndefined();
    expect(ru.poll.confirmTakeSnapshotDescription).toBeUndefined();
  });
});

/**
 * The tests above hardcode their key list, so a typo inside
 * pollControlLabels.ts would slip past them and surface in the UI as a raw
 * key. These resolve what the module actually returns.
 */
describe('pollControlLabels keys resolve to real messages', () => {
  // Keys are relative to the `poll` namespace, which is what both
  // PollControls and PollCard pass to useTranslations.
  function resolve(messages: Record<string, any>, key: string): unknown {
    return key
      .split('.')
      .reduce<any>((node, segment) => node?.[segment], messages.poll);
  }

  it('resolves a real key and rejects a bogus one', () => {
    expect(resolve(en, 'type.markReady')).toBe('Mark as ready');
    expect(resolve(en, 'type.markReay')).toBeUndefined();
  });

  it.each([true, false])(
    'every key returned for isOpenPoll=%s exists in both locales',
    (isOpenPoll) => {
      const keys = Object.values(getPollControlLabelKeys(isOpenPoll));

      expect(keys).toHaveLength(8);

      for (const key of keys) {
        expect(resolve(en, key), `en is missing poll.${key}`).toBeTruthy();
        expect(resolve(ru, key), `ru is missing poll.${key}`).toBeTruthy();
      }
    }
  );
});
