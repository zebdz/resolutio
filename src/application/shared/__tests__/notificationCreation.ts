/** Deterministic dependencies for application flows that arrange notifications.
 * Domain notification creation always receives an explicit identity and instant. */
import { IdGenerator, Clock } from '../EntityCreation';
import { Instant } from '@/domain/shared/Instant';

let nextId = 1;
export const notificationIds: IdGenerator = {
  generate: (schema) => schema.parse(`notification-fixture-${nextId++}`),
};
export const notificationClock: Clock = {
  now: () => Instant.parse('2026-10-26T12:00:00.000Z'),
};
