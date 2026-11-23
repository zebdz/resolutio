/** Report clients decode constrained text before creation and mutation.
 * Decoding preserves Markdown bytes and domain profanity/error-code policy. */
import { expect, it } from 'vitest';
import { parseReportTitle, parseReportBody } from '../Report';
import { ReportDomainCodes as Codes } from '../ReportDomainCodes';

it('normalizes titles, preserves body bytes and retains existing content failures', () => {
  expect(parseReportTitle('  Title  ')).toEqual({
    success: true,
    value: 'Title',
  });
  const markdown = '  # Body\n\nText\n';
  expect(parseReportBody(markdown)).toEqual({ success: true, value: markdown });
  expect(parseReportTitle(' ')).toEqual({
    success: false,
    error: Codes.REPORT_TITLE_EMPTY,
  });
  expect(parseReportBody(' ')).toEqual({
    success: false,
    error: Codes.REPORT_BODY_EMPTY,
  });
  expect(parseReportTitle(' ' + 'x'.repeat(200))).toEqual({
    success: false,
    error: Codes.REPORT_TITLE_TOO_LONG,
  });
  expect(parseReportBody('x'.repeat(50001))).toEqual({
    success: false,
    error: Codes.REPORT_BODY_TOO_LONG,
  });
  const checker = {
    containsProfanity: (text: string) => text.includes('badword'),
    findProfaneWords: () => ['badword'],
  };
  expect(parseReportTitle(' badword ', checker)).toEqual({
    success: false,
    error: 'domain.shared.containsProfanityWithWords?words=badword',
  });
});
