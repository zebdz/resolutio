-- AlterTable
ALTER TABLE "organization_users" ADD COLUMN     "accepted_by_user_id" TEXT,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by_user_id" TEXT,
ADD COLUMN     "rejection_reason" TEXT;

-- CreateIndex
CREATE INDEX "organization_users_accepted_by_user_id_idx" ON "organization_users"("accepted_by_user_id");

-- CreateIndex
CREATE INDEX "organization_users_rejected_by_user_id_idx" ON "organization_users"("rejected_by_user_id");

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_rejected_by_user_id_fkey" FOREIGN KEY ("rejected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
