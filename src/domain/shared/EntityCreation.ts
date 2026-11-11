/** Complete identity/time inputs supplied before a domain entity is constructed.
 * The domain owns this record; generating its values belongs outside the domain. */
import { Instant } from './Instant';

export interface EntityCreation<Id extends string> {
  readonly id: Id;
  readonly now: Instant;
}
