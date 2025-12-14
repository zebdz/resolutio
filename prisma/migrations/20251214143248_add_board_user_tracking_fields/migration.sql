/*
  Warnings:

  - The primary key for the `board_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[board_id,user_id]` on the table `board_users` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `board_users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "board_users" DROP CONSTRAINT "board_users_pkey",
ADD COLUMN     "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "added_by" TEXT,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "removed_at" TIMESTAMP(3),
ADD COLUMN     "removed_by" TEXT,
ADD COLUMN     "removed_reason" TEXT,
ADD CONSTRAINT "board_users_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "board_users_added_by_idx" ON "board_users"("added_by");

-- CreateIndex
CREATE INDEX "board_users_removed_by_idx" ON "board_users"("removed_by");

-- CreateIndex
CREATE UNIQUE INDEX "board_users_board_id_user_id_key" ON "board_users"("board_id", "user_id");

-- AddForeignKey
ALTER TABLE "board_users" ADD CONSTRAINT "board_users_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_users" ADD CONSTRAINT "board_users_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
