/** Poll content values preserve existing length and nonblank rules.
 * Factories normalize author input; rehydration validates stored text without rewriting it. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes as Codes, PollDomainCode } from './PollDomainCodes';
import { validateAttachmentRefs } from '../shared/attachments/validateAttachmentRefs';
import { POLL_ATTACHMENT_API_PREFIX } from './PollAttachment';

export const POLL_TITLE_MAX_LENGTH = 500;
export const POLL_DESCRIPTION_MAX_LENGTH = 10000;

export const PollTitle = z
  .string()
  .max(POLL_TITLE_MAX_LENGTH)
  .refine((text) => text.trim().length > 0)
  .brand<'PollTitle'>();
export type PollTitle = z.infer<typeof PollTitle>;
export const PollDescription = z
  .string()
  .max(POLL_DESCRIPTION_MAX_LENGTH)
  .refine((text) => text.trim().length > 0)
  .brand<'PollDescription'>();
export type PollDescription = z.infer<typeof PollDescription>;

/** Request normalization is separate from strict decoding of stored text. */
export function parsePollTitle(
  value: unknown
): Result<PollTitle, PollDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(Codes.POLL_TITLE_EMPTY);
  }

  if (value.length > POLL_TITLE_MAX_LENGTH) {
    return failure(Codes.POLL_TITLE_TOO_LONG);
  }

  return success(PollTitle.parse(value.trim()));
}

export function parsePollDescription(
  value: unknown
): Result<PollDescription, PollDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(Codes.POLL_DESCRIPTION_EMPTY);
  }

  if (value.length > POLL_DESCRIPTION_MAX_LENGTH) {
    return failure(Codes.POLL_DESCRIPTION_TOO_LONG);
  }

  return success(PollDescription.parse(value.trim()));
}

/** New polls have no attachments. Decode content before dates/kind so malformed
 * requests retain their established domain-error precedence. */
export function parseNewPollContent(
  title: unknown,
  description: unknown
): Result<
  Readonly<{ title: PollTitle; description: PollDescription }>,
  PollDomainCode
> {
  const titleValue = parsePollTitle(title);

  if (!titleValue.success) {
    return titleValue;
  }

  const descriptionValue = parsePollDescription(description);

  if (!descriptionValue.success) {
    return descriptionValue;
  }

  // No attachments exist for a brand-new poll, so any inline ref is
  // automatically foreign. Mirrors Report.create.
  const refs = validateAttachmentRefs(
    descriptionValue.value,
    { apiPrefix: POLL_ATTACHMENT_API_PREFIX, ownIds: [] },
    Codes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
  );

  if (!refs.success) {
    return refs;
  }

  return success({
    title: titleValue.value,
    description: descriptionValue.value,
  });
}
