-- CreateTable
CREATE TABLE "organization_member_removals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "removed_by_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_member_removals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_member_removals_organization_id_idx" ON "organization_member_removals"("organization_id");

-- CreateIndex
CREATE INDEX "organization_member_removals_user_id_idx" ON "organization_member_removals"("user_id");

-- AddForeignKey
ALTER TABLE "organization_member_removals" ADD CONSTRAINT "organization_member_removals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member_removals" ADD CONSTRAINT "organization_member_removals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_member_removals" ADD CONSTRAINT "organization_member_removals_removed_by_user_id_fkey" FOREIGN KEY ("removed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
