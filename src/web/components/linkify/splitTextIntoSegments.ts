export type TextSegment = { kind: 'text'; value: string };
export type LinkSegment = { kind: 'link'; value: string };
export type Segment = TextSegment | LinkSegment;

/**
 * Only the schemes `MarkdownRenderer`'s sanitizer allows through for `href`.
 * Plain `http://` is deliberately left as text.
 */
const LINK_PATTERN = /(?:https:\/\/|mailto:)\S+/g;

const BRACKET_PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function countChar(value: string, char: string): number {
  let count = 0;

  for (const c of value) {
    if (c === char) {
      count += 1;
    }
  }

  return count;
}

/**
 * A URL written inside prose usually ends up glued to the sentence's
 * punctuation (`see https://example.org/charter.`, `(https://example.org)`).
 * Those characters are almost never part of the address, so drop them from
 * the tail of a match.
 *
 * A closing bracket is only dropped when the URL has no opening bracket to
 * match it — otherwise Wikipedia-style addresses such as
 * `https://example.org/Foo_(Bar)` would lose their tail.
 */
function trimTrailingPunctuation(url: string): string {
  let result = url;

  // Trailing characters can interleave — `(https://example.org/charter).`
  // needs the period stripped before the paren becomes the last character.
  for (;;) {
    const last = result.at(-1);

    if (last === undefined) {
      return result;
    }

    if ('.,;:!?'.includes(last)) {
      result = result.slice(0, -1);
      continue;
    }

    const opening = BRACKET_PAIRS[last];

    if (opening && countChar(result, last) > countChar(result, opening)) {
      result = result.slice(0, -1);
      continue;
    }

    return result;
  }
}

export function splitTextIntoSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const start = match.index;
    const url = trimTrailingPunctuation(match[0]);

    if (start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, start) });
    }

    segments.push({ kind: 'link', value: url });
    cursor = start + url.length;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }

  return segments;
}
