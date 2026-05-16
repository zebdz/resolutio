-- CreateEnum
CREATE TYPE "report_visibility_enum" AS ENUM ('PUBLIC_ANON', 'PUBLIC_AUTH', 'WITHIN_ORG_ONLY', 'WITHIN_ORG_ANCESTORS', 'WITHIN_ORG_DESCENDANTS', 'WITHIN_ORG_TREE', 'WITHIN_BOARDS');

-- CreateEnum
CREATE TYPE "report_state_enum" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "report_visibility_enum" NOT NULL,
    "state" "report_state_enum" NOT NULL DEFAULT 'DRAFT',
    "published_by_id" TEXT,
    "last_published_at" TIMESTAMP(3),
    "notify_audience" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_boards" (
    "report_id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,

    CONSTRAINT "report_boards_pkey" PRIMARY KEY ("report_id","board_id")
);

-- CreateTable
CREATE TABLE "report_polls" (
    "report_id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,

    CONSTRAINT "report_polls_pkey" PRIMARY KEY ("report_id","poll_id")
);

-- CreateIndex
CREATE INDEX "reports_organization_id_idx" ON "reports"("organization_id");

-- CreateIndex
CREATE INDEX "reports_created_by_id_idx" ON "reports"("created_by_id");

-- CreateIndex
CREATE INDEX "reports_state_archived_at_idx" ON "reports"("state", "archived_at");

-- CreateIndex
CREATE INDEX "reports_visibility_state_last_published_at_idx" ON "reports"("visibility", "state", "last_published_at");

-- CreateIndex
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments"("report_id");

-- CreateIndex
CREATE INDEX "report_boards_board_id_idx" ON "report_boards"("board_id");

-- CreateIndex
CREATE INDEX "report_polls_poll_id_idx" ON "report_polls"("poll_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_boards" ADD CONSTRAINT "report_boards_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_boards" ADD CONSTRAINT "report_boards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_polls" ADD CONSTRAINT "report_polls_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_polls" ADD CONSTRAINT "report_polls_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
