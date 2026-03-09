-- Delete old OTP records without a user_id (ephemeral data, safe to remove)
DELETE FROM "otp_verifications" WHERE "user_id" IS NULL;

-- DropForeignKey
ALTER TABLE "otp_verifications" DROP CONSTRAINT "otp_verifications_user_id_fkey";

-- AlterTable
ALTER TABLE "otp_verifications" ALTER COLUMN "user_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
