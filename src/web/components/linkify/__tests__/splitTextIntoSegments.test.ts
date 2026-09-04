import { describe, it, expect } from 'vitest';
import { splitTextIntoSegments } from '../splitTextIntoSegments';

describe('splitTextIntoSegments', () => {
  it('returns a single text segment when there is no link', () => {
    expect(splitTextIntoSegments('A union of local growers.')).toEqual([
      { kind: 'text', value: 'A union of local growers.' },
    ]);
  });

  it('splits an https link out of the surrounding text', () => {
    expect(
      splitTextIntoSegments('Charter at https://example.org/charter for all')
    ).toEqual([
      { kind: 'text', value: 'Charter at ' },
      { kind: 'link', value: 'https://example.org/charter' },
      { kind: 'text', value: ' for all' },
    ]);
  });

  it('leaves trailing sentence punctuation out of the link', () => {
    expect(splitTextIntoSegments('See https://example.org/charter.')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', value: 'https://example.org/charter' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('leaves an unbalanced closing bracket out of the link', () => {
    expect(splitTextIntoSegments('(https://example.org/charter)')).toEqual([
      { kind: 'text', value: '(' },
      { kind: 'link', value: 'https://example.org/charter' },
      { kind: 'text', value: ')' },
    ]);
  });

  it('keeps a balanced closing bracket inside the link', () => {
    expect(splitTextIntoSegments('https://example.org/Foo_(Bar)')).toEqual([
      { kind: 'link', value: 'https://example.org/Foo_(Bar)' },
    ]);
  });

  it('links a mailto address', () => {
    expect(splitTextIntoSegments('Write to mailto:info@example.org.')).toEqual([
      { kind: 'text', value: 'Write to ' },
      { kind: 'link', value: 'mailto:info@example.org' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('links every occurrence, including one that ends the text', () => {
    expect(
      splitTextIntoSegments('https://example.org/a then https://example.org/b')
    ).toEqual([
      { kind: 'link', value: 'https://example.org/a' },
      { kind: 'text', value: ' then ' },
      { kind: 'link', value: 'https://example.org/b' },
    ]);
  });

  it('leaves a javascript: URL as plain text', () => {
    expect(splitTextIntoSegments('javascript:alert(1)')).toEqual([
      { kind: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('leaves a plain http:// URL as text', () => {
    expect(splitTextIntoSegments('http://example.org/charter')).toEqual([
      { kind: 'text', value: 'http://example.org/charter' },
    ]);
  });
});
