-- CreateTable
CREATE TABLE "ip_block_statuses" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "status_changed_by_superadmin_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_block_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ip_block_statuses_ip_address_idx" ON "ip_block_statuses"("ip_address");

-- CreateIndex
CREATE INDEX "ip_block_statuses_ip_address_created_at_idx" ON "ip_block_statuses"("ip_address", "created_at");

-- AddForeignKey
ALTER TABLE "ip_block_statuses" ADD CONSTRAINT "ip_block_statuses_status_changed_by_superadmin_id_fkey" FOREIGN KEY ("status_changed_by_superadmin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
