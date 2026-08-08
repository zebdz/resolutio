import { Result, success, failure } from '../Result';
import { extractAttachmentIds } from './extractAttachmentIds';

// Text may only reference attachments belonging to its own aggregate. This
// prevents leaks where pasting a URL from another (private) report or poll
// would render fine for the author but 404 for everyone else.
export function validateAttachmentRefs(
  text: string,
  apiPrefix: string,
  ownIds: string[],
  errorCode: string
): Result<void, string> {
  const refIds = extractAttachmentIds(text, apiPrefix);

  if (refIds.length === 0) {
    return success(undefined);
  }

  const ownSet = new Set(ownIds);

  for (const id of refIds) {
    if (!ownSet.has(id)) {
      return failure(errorCode);
    }
  }

  return success(undefined);
}
