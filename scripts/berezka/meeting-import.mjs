/** Map the reviewed Berezka meetings to native poll periods, poll evidence and linked protocol reports.
 * All meeting dates in the pinned snapshot are Moscow wall times after 2014 (UTC+03). */
import { assetKey } from './content.mjs';

const recordedTime = (date) => Date.parse(date.replace(' ', 'T') + '+03:00');
const protocolKinds = new Set([
  'protocol',
  'protocol_doc',
  'blank_doc',
  'blank_with_answers_doc',
]);

export function planMeetings(data, importedAt) {
  const meetings = [];
  const questions = new Map(data.rows.questions.map((q) => [q.id, q]));

  for (const poll of data.rows.polls) {
    if (![1, 2].includes(poll.type_of_poll)) {
      continue;
    }

    const end = poll.finished ? recordedTime(poll.finished) : +importedAt;
    let start = +importedAt;
    let startSource = 'import';

    if (poll.start) {
      start = recordedTime(poll.start);
      startSource = 'recorded';
    } else if (poll.finished && end <= start) {
      start = end - 86400000;
      startSource = 'dayBeforeFinish';
    }

    if (!(start < end) || !Number.isFinite(end)) {
      return { error: 'Invalid native meeting period for poll ' + poll.id };
    }

    const assets = data.assets.filter((asset) => asset.poll === poll.id);
    const files = assets.filter((asset) =>
      ['question_file', 'inline'].includes(asset.kind)
    );
    const protocol = assets.filter((asset) => protocolKinds.has(asset.kind));

    if (
      files.some((asset) => questions.get(asset.question)?.poll_id !== poll.id)
    ) {
      return { error: 'Attachment does not belong to meeting ' + poll.id };
    }

    meetings.push({
      questionFiles: files.map((a) => ({
        key: assetKey(a),
        question: a.question,
      })),
      protocolReport: protocol.length
        ? {
            visibility:
              poll.type_of_poll === 2 ? 'WITHIN_BOARDS' : 'WITHIN_ORG_ONLY',
            files: protocol.map(assetKey),
          }
        : null,
      sourceId: poll.id,
      start: new Date(start).toISOString(),
      startSource,
      end: new Date(end).toISOString(),
      endSource: poll.finished ? 'recorded' : 'import',
    });
  }

  return { meetings };
}
