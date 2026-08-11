/**
 * DRAFT → SUBMITTED → READY → ACTIVE → FINISHED
 *
 * SUBMITTED is the author handing the poll over: until they do, an admin has
 * nothing to act on. Freezing participants or activating a poll its author is
 * still writing was possible before this state existed, and the author had no
 * way to say they were finished.
 */
export enum PollState {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  READY = 'READY',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}
