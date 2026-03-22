-- DropForeignKey
ALTER TABLE "otp_verifications" DROP CONSTRAINT "otp_verifications_user_id_fkey";

-- AddForeignKey
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
