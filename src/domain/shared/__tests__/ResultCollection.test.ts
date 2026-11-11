/** A batch consumer receives every successful value or an explicit failure.
 * Failed construction cannot silently become a smaller successful publication batch. */
import { expect, it } from 'vitest';
import { success, failure, collectResults } from '../Result';

it('collects ordered successful values and preserves an empty batch', () => {
  expect(collectResults([success('first'), success('second')])).toEqual(
    success(['first', 'second'])
  );
  expect(collectResults([])).toEqual(success([]));
});
it('returns a failure instead of dropping invalid members', () => {
  const error = { code: 'invalid-notification', recipient: 'recipient-2' };
  expect(
    collectResults([success('first'), failure(error), success('third')])
  ).toEqual(failure(error));
});
