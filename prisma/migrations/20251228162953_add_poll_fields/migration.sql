/*
  Warnings:

  - Added the required column `created_by` to the `polls` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "finished" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "details" TEXT,
ADD COLUMN     "page" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "polls_created_by_idx" ON "polls"("created_by");

-- CreateIndex
CREATE INDEX "questions_poll_id_page_order_idx" ON "questions"("poll_id", "page", "order");

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
