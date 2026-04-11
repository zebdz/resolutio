-- CreateEnum
CREATE TYPE "overall_risk_enum" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "user_privacy_audit_log" ALTER COLUMN "allow_find_by_address" DROP DEFAULT;

-- CreateTable
CREATE TABLE "poll_legal_checks" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "annotations" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "overall_risk" "overall_risk_enum" NOT NULL,
    "total_issues" INTEGER NOT NULL,
    "checked_by" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_legal_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_legal_check_logs" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "checked_by" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_legal_check_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "poll_legal_checks_poll_id_key" ON "poll_legal_checks"("poll_id");

-- CreateIndex
CREATE INDEX "poll_legal_checks_poll_id_idx" ON "poll_legal_checks"("poll_id");

-- CreateIndex
CREATE INDEX "poll_legal_checks_checked_by_idx" ON "poll_legal_checks"("checked_by");

-- CreateIndex
CREATE INDEX "poll_legal_check_logs_checked_by_checked_at_idx" ON "poll_legal_check_logs"("checked_by", "checked_at");

-- CreateIndex
CREATE INDEX "poll_legal_check_logs_poll_id_idx" ON "poll_legal_check_logs"("poll_id");

-- AddForeignKey
ALTER TABLE "poll_legal_checks" ADD CONSTRAINT "poll_legal_checks_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_legal_checks" ADD CONSTRAINT "poll_legal_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_legal_check_logs" ADD CONSTRAINT "poll_legal_check_logs_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_legal_check_logs" ADD CONSTRAINT "poll_legal_check_logs_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
