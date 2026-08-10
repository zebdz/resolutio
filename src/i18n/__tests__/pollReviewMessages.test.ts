import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

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

/**
 * Copy for the admin's read-only path onto the poll page — the only place the
 * AI legality check is reachable. A missing key here renders the raw key name
 * on screen, which is how the affordance goes quiet again.
 */
describe('poll review messages', () => {
  it('names the read-only entry point in both locales', () => {
    expect(en.poll.viewPoll).toBeTruthy();
    expect(ru.poll.viewPoll).toBeTruthy();
    expect(en.poll.viewPoll).not.toBe(en.poll.editPoll);
  });

  it('explains why a new legality check is unavailable outside READY', () => {
    expect(en.legalCheck.readyOnly).toBeTruthy();
    expect(ru.legalCheck.readyOnly).toBeTruthy();
  });

  it('legalCheck block has identical keys in en and ru', () => {
    expect(Object.keys(en.legalCheck).sort()).toEqual(
      Object.keys(ru.legalCheck).sort()
    );
  });

  it('keeps the reasons an admin sees a poll read-only', () => {
    for (const key of [
      'notPollCreator',
      'cannotModifyActive',
      'cannotModifyFinished',
      'cannotModifyHasVotes',
    ]) {
      expect(en.poll.errors[key]).toBeTruthy();
      expect(ru.poll.errors[key]).toBeTruthy();
    }
  });
});
