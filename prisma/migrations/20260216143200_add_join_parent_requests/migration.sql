-- CreateTable
CREATE TABLE "organization_join_parent_requests" (
    "id" TEXT NOT NULL,
    "child_org_id" TEXT NOT NULL,
    "parent_org_id" TEXT NOT NULL,
    "requesting_admin_id" TEXT NOT NULL,
    "handling_admin_id" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "organization_join_parent_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_join_parent_requests_child_org_id_idx" ON "organization_join_parent_requests"("child_org_id");

-- CreateIndex
CREATE INDEX "organization_join_parent_requests_parent_org_id_idx" ON "organization_join_parent_requests"("parent_org_id");

-- CreateIndex
CREATE INDEX "organization_join_parent_requests_requesting_admin_id_idx" ON "organization_join_parent_requests"("requesting_admin_id");

-- CreateIndex
CREATE INDEX "organization_join_parent_requests_handling_admin_id_idx" ON "organization_join_parent_requests"("handling_admin_id");

-- AddForeignKey
ALTER TABLE "organization_join_parent_requests" ADD CONSTRAINT "organization_join_parent_requests_child_org_id_fkey" FOREIGN KEY ("child_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_join_parent_requests" ADD CONSTRAINT "organization_join_parent_requests_parent_org_id_fkey" FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_join_parent_requests" ADD CONSTRAINT "organization_join_parent_requests_requesting_admin_id_fkey" FOREIGN KEY ("requesting_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_join_parent_requests" ADD CONSTRAINT "organization_join_parent_requests_handling_admin_id_fkey" FOREIGN KEY ("handling_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
