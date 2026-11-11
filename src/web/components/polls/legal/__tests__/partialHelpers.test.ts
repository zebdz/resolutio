/** Streaming annotations remain displayable before optional prose arrives,
 * while IDs and counts must be valid before values enter typed presentation state. */
import { expect, it } from 'vitest';
import { tryCompleteAnnotation, tryCompleteSummary } from '../partialHelpers';
it('rejects nonfinite or fractional streamed issue counts', () => {
  for (const totalIssues of [NaN, Infinity, -1, 1.5]) {
    expect(
      tryCompleteSummary({
        totalIssues,
        overallRisk: 'low',
        recommendation: 'Waiting',
      })
    ).toBeNull();
  }
});
it('keeps existing incomplete prose presentation semantics', () => {
  expect(
    tryCompleteAnnotation({
      questionId: 'q-1',
      severity: 'warning',
      issue: 'Issue',
    })
  ).toEqual({
    questionId: 'q-1',
    answerId: null,
    severity: 'warning',
    issue: 'Issue',
    explanation: '',
    legalBasis: '',
  });
});
