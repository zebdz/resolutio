/** Distinct query units for positive page/limit inputs and nonnegative result totals.
 * Values retain numeric arithmetic while rejecting impossible counts and offsets. */
import { z } from 'zod';
export const PageNumber = z.number().int().positive().brand<'PageNumber'>();
export type PageNumber = z.infer<typeof PageNumber>;
export const PageSize = z.number().int().positive().brand<'PageSize'>();
export type PageSize = z.infer<typeof PageSize>;
export const ResultLimit = z.number().int().positive().brand<'ResultLimit'>();
export type ResultLimit = z.infer<typeof ResultLimit>;
export const ResultCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'ResultCount'>();
export type ResultCount = z.infer<typeof ResultCount>;
