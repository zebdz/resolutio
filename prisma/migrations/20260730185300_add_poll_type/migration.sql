-- CreateEnum
CREATE TYPE "PollType" AS ENUM ('ORGANIZATION', 'OPEN');

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "poll_type" "PollType" NOT NULL DEFAULT 'ORGANIZATION';
