/** Shared metadata constraints for uploaded evidence, independent of storage.
 * Context-specific MIME whitelists and size caps remain with each attachment model. */
import { z } from 'zod';

export const AttachmentFileName = z
  .string()
  .refine((name) => name.trim().length > 0)
  .brand<'AttachmentFileName'>();
export type AttachmentFileName = z.infer<typeof AttachmentFileName>;
export const AttachmentByteCount = z
  .number()
  .int()
  .nonnegative()
  .safe()
  .brand<'AttachmentByteCount'>();
export type AttachmentByteCount = z.infer<typeof AttachmentByteCount>;

/** Validated number of attachments; distinct from other count units. */
export const AttachmentCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'AttachmentCount'>();
export type AttachmentCount = z.infer<typeof AttachmentCount>;
