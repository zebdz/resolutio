-- AlterTable
ALTER TABLE "organization_users" ADD COLUMN     "join_token_id" TEXT;

-- CreateTable
CREATE TABLE "organization_join_tokens" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "max_uses" INTEGER,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expired_at" TIMESTAMP(3),

    CONSTRAINT "organization_join_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_join_tokens_token_key" ON "organization_join_tokens"("token");

-- CreateIndex
CREATE INDEX "organization_join_tokens_organization_id_idx" ON "organization_join_tokens"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_join_token_id_fkey" FOREIGN KEY ("join_token_id") REFERENCES "organization_join_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_join_tokens" ADD CONSTRAINT "organization_join_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_join_tokens" ADD CONSTRAINT "organization_join_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
