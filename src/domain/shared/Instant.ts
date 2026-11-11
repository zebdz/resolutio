/** Immutable UTC instants with exact millisecond precision. Dates are converted
 * at boundaries; callers never receive a reference to mutable internal state. */
import { z } from 'zod';

const schema = z.iso
  .datetime({ precision: 3 })
  .refine((value) => {
    const date = new Date(value);

    return Number.isFinite(date.getTime()) && date.toISOString() === value;
  })
  .brand<'Instant'>();

export type Instant = z.infer<typeof schema>;
export const Instant = {
  schema,
  parse(value: unknown): Instant {
    return schema.parse(value);
  },
  safeParse(value: unknown) {
    return schema.safeParse(value);
  },
  fromDate(value: Date): Instant {
    return schema.parse(value.toISOString());
  },
  toDate(value: Instant): Date {
    return new Date(value);
  },
};
