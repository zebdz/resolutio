/*
  Warnings:

  - A unique constraint covering the columns `[question_id,user_id,answer_id]` on the table `votes` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "votes_question_id_user_id_key";

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "question_type" TEXT NOT NULL DEFAULT 'single-choice';

-- CreateIndex
CREATE INDEX "boards_organization_id_is_general_idx" ON "boards"("organization_id", "is_general");

-- CreateIndex
CREATE UNIQUE INDEX "votes_question_id_user_id_answer_id_key" ON "votes"("question_id", "user_id", "answer_id");
