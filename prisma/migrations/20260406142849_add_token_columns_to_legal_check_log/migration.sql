-- AlterTable
ALTER TABLE "poll_legal_check_logs" ADD COLUMN     "input_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "output_tokens" INTEGER NOT NULL DEFAULT 0;
