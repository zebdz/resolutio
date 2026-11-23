/** Validates inline ownership using a namespace bound to its aggregate's ID type.
 * Extracted URL tokens stay untrusted strings until compared with validated owner IDs. */
import { Result, success, failure } from '../Result';
import { extractAttachmentIds } from './extractAttachmentIds';
import type { AttachmentReferenceScope } from './AttachmentReferenceScope';

// Text may only reference attachments belonging to its own aggregate. This
// prevents leaks where pasting a URL from another (private) report or poll
// would render fine for the author but 404 for everyone else.
export function validateAttachmentRefs<Code extends string>(
  text: string,
  scope: AttachmentReferenceScope,
  errorCode: Code
): Result<void, Code> {
  const refIds = extractAttachmentIds(text, scope.apiPrefix);

  if (refIds.length === 0) {
    return success(undefined);
  }

  const ownSet: ReadonlySet<string> = new Set<string>(scope.ownIds);

  for (const id of refIds) {
    if (!ownSet.has(id)) {
      return failure(errorCode);
    }
  }

  return success(undefined);
}
