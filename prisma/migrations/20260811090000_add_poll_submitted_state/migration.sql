-- Adds the SUBMITTED state: DRAFT → SUBMITTED → READY.
--
-- Kept apart from the backfill that follows it. PostgreSQL will not let a new
-- enum label be *used* by the same transaction that adds it, and Prisma runs
-- each migration in one transaction, so an UPDATE to 'SUBMITTED' here would
-- fail with "unsafe use of new value of enum type".

-- AlterEnum
ALTER TYPE "PollState" ADD VALUE 'SUBMITTED' AFTER 'DRAFT';
