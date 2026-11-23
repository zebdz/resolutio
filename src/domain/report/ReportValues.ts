/** Validated report text preserves the existing length and nonblank policies.
 * Text remains unescaped Markdown; rendering and profanity policies are separate. */
import { z } from 'zod';
export const REPORT_TITLE_MAX_LENGTH = 200;
export const REPORT_BODY_MAX_LENGTH = 50_000;
export const ReportTitle = z
  .string()
  .max(REPORT_TITLE_MAX_LENGTH)
  .refine((text) => text.trim().length > 0)
  .brand<'ReportTitle'>();
export type ReportTitle = z.infer<typeof ReportTitle>;
export const ReportBody = z
  .string()
  .max(REPORT_BODY_MAX_LENGTH)
  .refine((text) => text.trim().length > 0)
  .brand<'ReportBody'>();
export type ReportBody = z.infer<typeof ReportBody>;
