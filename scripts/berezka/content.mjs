/** Convert archived Draft.js to escaped Markdown and rewrite links through scoped source keys. */
import { createHash } from 'node:crypto';

/** Scope original keys to this import; only the opaque destination key reaches product routes. */
export function historyKey(kind, id) {
  return (
    'hist_' +
    createHash('sha256')
      .update('decision.community/berezka/' + kind + '/' + id)
      .digest('hex')
      .slice(0, 32)
  );
}

const escapeText = (s) => s.replace(/[\\`*_{}\[\]<>#!|~]/g, '\\$&');
const prefix = {
  'header-one': '# ',
  'header-two': '## ',
  'header-three': '### ',
  blockquote: '> ',
  'unordered-list-item': '- ',
  'ordered-list-item': '1. ',
};
const styles = { BOLD: '**', ITALIC: '_', STRIKETHROUGH: '~~', CODE: '`' };
export const assetKey = (asset) =>
  asset.kind === 'question_file'
    ? 'file-' + asset.file
    : asset.kind === 'inline'
      ? asset.path.replaceAll('/', '-')
      : asset.kind + '-' + asset.poll + '-' + asset.sha256.slice(0, 16);

export function questionContent(question, rows, assets) {
  const issues = [];
  const raw = question.text;
  let draft;

  try {
    draft = JSON.parse(raw);
  } catch {
    return {
      title: raw.split('\n')[0].slice(0, 250),
      body: plainLinks(raw),
      issues,
    };
  }

  function plainLinks(value) {
    const parts = [];
    let end = 0;

    for (const match of value.matchAll(
      /https?:\/\/berezka\.decision\.community(?:\/[^\s<>"\])]+)?/gi
    )) {
      const label = escapeText(match[0].replace(/^https?:\/\//i, ''));
      const target = link(match[0]);
      parts.push(
        escapeText(value.slice(end, match.index)),
        target ? '[' + label + '](' + target + ')' : label
      );
      end = match.index + match[0].length;
    }

    parts.push(escapeText(value.slice(end)));

    return parts.join('');
  }

  function link(value) {
    if (!value || value.startsWith('data:')) {
      return null;
    }

    const url = URL.canParse(value, 'https://berezka.decision.community')
      ? new URL(value, 'https://berezka.decision.community')
      : null;

    if (
      !url ||
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    if (url.hostname !== 'berezka.decision.community') {
      return url.href.replace(/[()]/g, (c) => (c === '(' ? '%28' : '%29'));
    }

    if (url.pathname === '/') {
      return '/organizations/berezka-company-1';
    }

    const questionId = url.pathname.match(
      /^\/polls\/view\/question\/(\d+)(?:\/|$)/
    )?.[1];

    if (questionId && rows.questions.some((q) => q.id === Number(questionId))) {
      return '/polls/questions/' + historyKey('question', questionId);
    }

    const pollId = url.pathname.match(/^\/polls\/(\d+)(?:\/results)?\/?$/)?.[1];

    if (pollId && rows.polls.some((p) => p.id === Number(pollId))) {
      return '/polls/' + historyKey('poll', pollId) + '/results';
    }

    const path = url.pathname
      .replace(/^\/storage\/storage\//, 'storage/')
      .replace(/^\//, '');
    const asset = assets.find(
      (a) =>
        a.path === path && a.kind !== 'unassigned' && a.kind !== 'alternate'
    );

    if (asset) {
      return (
        '/api/historical-attachments/' + historyKey('asset', assetKey(asset))
      );
    }

    issues.push({ kind: 'unresolved', url: value });

    return null;
  }

  const blocks = draft.blocks.map((block) => {
    const text = Array.from(block.text);
    const ranges = [
      ...(block.inlineStyleRanges ?? []),
      ...(block.entityRanges ?? []),
    ];
    const bounds = [
      ...new Set([
        0,
        text.length,
        ...ranges.flatMap((r) => [r.offset, r.offset + r.length]),
      ]),
    ].sort((a, b) => a - b);
    let body = '';

    for (let i = 1; i < bounds.length; i++) {
      const at = bounds[i - 1];
      const rawSegment = text.slice(at, bounds[i]).join('');
      const marked = ranges.filter(
        (r) => at >= r.offset && at < r.offset + r.length
      );
      let segment = marked.some((r) => r.key !== undefined)
        ? escapeText(
            rawSegment.replace(
              /https?:\/\/(?=berezka\.decision\.community)/gi,
              ''
            )
          )
        : plainLinks(rawSegment);

      for (const r of marked) {
        if (styles[r.style]) {
          segment = styles[r.style] + segment + styles[r.style];
        }

        if (r.key === undefined) {
          continue;
        }

        const entity = draft.entityMap[r.key];
        const asset = assets.find(
          (a) => a.path === 'inline/' + question.id + '/' + r.key
        );
        const url = asset
          ? '/api/historical-attachments/' +
            historyKey('asset', assetKey(asset))
          : link(entity?.data?.url ?? entity?.data?.src);

        if (!url) {
          continue;
        }

        if (
          entity.type === 'EMBEDDED_LINK' ||
          (entity.type === 'IMAGE' && !asset)
        ) {
          issues.push({ kind: 'external-media', url });
        }

        segment = asset
          ? '![](' + url + ')'
          : '[' + (segment.trim() || escapeText(url)) + '](' + url + ')';
      }

      body += segment;
    }

    return (prefix[block.type] ?? '') + body;
  });

  return {
    title:
      draft.blocks
        .map((b) => b.text.trim())
        .find(Boolean)
        ?.slice(0, 250) ?? String(question.id),
    body: blocks.join('\n\n'),
    issues,
  };
}
