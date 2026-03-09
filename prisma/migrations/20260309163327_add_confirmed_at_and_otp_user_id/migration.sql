-- AlterTable
ALTER TABLE "otp_verifications" ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "confirmed_at" TIMESTAMP(3);

-- Backfill: existing users are confirmed
UPDATE "users" SET "confirmed_at" = "created_at" WHERE "confirmed_at" IS NULL;

-- CreateIndex
CREATE INDEX "otp_verifications_user_id_idx" ON "otp_verifications"("user_id");

-- RenameForeignKey
ALTER TABLE "user_block_statuses" RENAME CONSTRAINT "user_block_statuses_blocked_by_superadmin_id_fkey" TO "user_block_statuses_status_changed_by_superadmin_id_fkey";

-- AddForeignKey
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
