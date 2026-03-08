-- CreateTable
CREATE TABLE "rate_limit_events" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "limiter_label" TEXT NOT NULL,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_block_statuses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blocked_by_superadmin_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_block_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_events_key_idx" ON "rate_limit_events"("key");

-- CreateIndex
CREATE INDEX "rate_limit_events_user_id_idx" ON "rate_limit_events"("user_id");

-- CreateIndex
CREATE INDEX "rate_limit_events_limiter_label_idx" ON "rate_limit_events"("limiter_label");

-- CreateIndex
CREATE INDEX "rate_limit_events_created_at_idx" ON "rate_limit_events"("created_at");

-- CreateIndex
CREATE INDEX "user_block_statuses_user_id_idx" ON "user_block_statuses"("user_id");

-- CreateIndex
CREATE INDEX "user_block_statuses_user_id_created_at_idx" ON "user_block_statuses"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "rate_limit_events" ADD CONSTRAINT "rate_limit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block_statuses" ADD CONSTRAINT "user_block_statuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block_statuses" ADD CONSTRAINT "user_block_statuses_blocked_by_superadmin_id_fkey" FOREIGN KEY ("blocked_by_superadmin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
