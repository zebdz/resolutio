/** Explicit test clocks and IDs for report/upload application clients.
 * The test clock follows fake timers when a suite controls wall-clock time. */
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { Instant } from '../../shared/Instant';
let nextId = 0;
export const testIds: IdGenerator = {
  generate: (schema) => schema.parse(`generated-${++nextId}`),
};
export const testClock: Clock = { now: () => Instant.fromDate(new Date()) };
