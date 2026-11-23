/** Test clients must check a Result before accessing its selected alternative.
 * These helpers fail immediately with the unexpected result instead of using casts. */
import { Result } from '../Result';

export function expectSuccess<T, E>(result: Result<T, E>): T {
  if (!result.success) {
    throw new Error(
      `Expected success, received error: ${String(result.error)}`
    );
  }

  return result.value;
}

export function expectFailure<T, E>(result: Result<T, E>): E {
  if (result.success) {
    throw new Error('Expected failure, received success');
  }

  return result.error;
}
