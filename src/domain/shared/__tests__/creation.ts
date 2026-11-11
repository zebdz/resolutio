/** Explicit deterministic creation inputs for domain client fixtures.
 * Tests choose identities; production factories never invent missing values. */
import { EntityCreation } from '../EntityCreation';
import { Instant } from '../Instant';

export function testCreation<Id extends string>(
  schema: { parse(value: unknown): Id },
  id: string
): EntityCreation<Id> {
  return {
    id: schema.parse(id),
    now: Instant.parse('2026-01-01T00:00:00.000Z'),
  };
}
