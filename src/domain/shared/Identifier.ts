/** Builds a distinct identity schema using the owning type's validation contract.
 * The factory supplies branding only; callers choose the accepted representation. */
import { z } from 'zod';

export function identifier<const Brand extends string>(
  brand: Brand,
  pattern: RegExp
) {
  return z.string().regex(pattern).brand(brand);
}
