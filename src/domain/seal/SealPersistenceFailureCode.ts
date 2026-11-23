/** Opaque persistence failure codes owned by the seal port. Adapters translate
 * storage failures into nonempty codes without coupling the core to a database. */
import { z } from 'zod';
import { requireSeal } from './SealDomainCodes';

const schema = z.string().min(1).brand<'SealPersistenceFailureCode'>();
export type SealPersistenceFailureCode = z.output<typeof schema>;

export const SealPersistenceFailureCode = {
  schema,
  parse(input: unknown): SealPersistenceFailureCode {
    const parsed = schema.safeParse(input);
    requireSeal(parsed.success);

    return parsed.data;
  },
};
