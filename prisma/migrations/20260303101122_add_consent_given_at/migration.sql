-- AlterTable
ALTER TABLE "users" ADD COLUMN     "consent_given_at" TIMESTAMP(3);

-- Backfill existing users with current timestamp
UPDATE "users" SET "consent_given_at" = NOW() WHERE "consent_given_at" IS NULL;
