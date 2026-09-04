-- DropIndex
DROP INDEX "otp_verifications_identifier_channel_idx";

-- AlterTable
ALTER TABLE "otp_verifications" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'phone_confirmation';

-- CreateIndex
CREATE INDEX "otp_verifications_identifier_channel_purpose_idx" ON "otp_verifications"("identifier", "channel", "purpose");

