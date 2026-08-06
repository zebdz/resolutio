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

describe('protocol signing messages', () => {
  it('protocolPdf block has identical keys in en and ru', () => {
    expect(Object.keys(en.poll.results.protocolPdf).sort()).toEqual(
      Object.keys(ru.poll.results.protocolPdf).sort()
    );
  });

  it('protocolPdf defines a phone column label in both locales', () => {
    expect(en.poll.results.protocolPdf.columnPhone).toBeTruthy();
    expect(ru.poll.results.protocolPdf.columnPhone).toBeTruthy();
  });

  it('voting consent copy names the phone number in both locales', () => {
    expect(en.poll.voting.willingToSignProtocolTitle).toMatch(/phone number/i);
    expect(ru.poll.voting.willingToSignProtocolTitle).toMatch(/телефон/i);
    expect(en.poll.voting.willingToSignProtocolDescription).toMatch(
      /phone number/i
    );
    expect(ru.poll.voting.willingToSignProtocolDescription).toMatch(/телефон/i);
  });
});
