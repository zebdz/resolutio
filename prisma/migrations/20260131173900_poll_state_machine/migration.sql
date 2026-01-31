-- CreateEnum
CREATE TYPE "PollState" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'FINISHED');

-- AlterTable: Add state column
ALTER TABLE "polls" ADD COLUMN "state" "PollState" NOT NULL DEFAULT 'DRAFT';

-- Migrate existing data based on old boolean fields
UPDATE "polls" SET "state" =
  CASE
    WHEN "finished" = true THEN 'FINISHED'::"PollState"
    WHEN "active" = true THEN 'ACTIVE'::"PollState"
    WHEN "participants_snapshot_taken" = true THEN 'READY'::"PollState"
    ELSE 'DRAFT'::"PollState"
  END;

-- Drop old columns
ALTER TABLE "polls" DROP COLUMN "active";
ALTER TABLE "polls" DROP COLUMN "finished";
ALTER TABLE "polls" DROP COLUMN "participants_snapshot_taken";

-- Drop old index and create new one
DROP INDEX IF EXISTS "polls_active_idx";
CREATE INDEX "polls_state_idx" ON "polls"("state");
