-- Backfills existing drafts into SUBMITTED.
--
-- Every poll in flight predates the submit step, so leaving them in DRAFT
-- would strand each one until its author found a button they have never seen.
-- Treating them as already handed over keeps admins working on the polls they
-- are working on today; an author who is in fact still writing can recall.
--
-- Must stay a separate migration from the ALTER TYPE that adds the label —
-- see 20260811090000_add_poll_submitted_state.

-- Backfill
UPDATE "polls" SET "state" = 'SUBMITTED' WHERE "state" = 'DRAFT';
