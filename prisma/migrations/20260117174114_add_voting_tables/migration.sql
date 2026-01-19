-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "participants_snapshot_taken" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weight_criteria" TEXT;

-- CreateTable
CREATE TABLE "poll_participants" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_weight" DECIMAL(10,2) NOT NULL DEFAULT 1.0,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_weight_history" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_weight" DECIMAL(10,2) NOT NULL,
    "new_weight" DECIMAL(10,2) NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_weight_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_drafts" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "poll_participants_poll_id_idx" ON "poll_participants"("poll_id");

-- CreateIndex
CREATE INDEX "poll_participants_user_id_idx" ON "poll_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_participants_poll_id_user_id_key" ON "poll_participants"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "participant_weight_history_participant_id_idx" ON "participant_weight_history"("participant_id");

-- CreateIndex
CREATE INDEX "participant_weight_history_poll_id_idx" ON "participant_weight_history"("poll_id");

-- CreateIndex
CREATE INDEX "participant_weight_history_user_id_idx" ON "participant_weight_history"("user_id");

-- CreateIndex
CREATE INDEX "participant_weight_history_changed_by_idx" ON "participant_weight_history"("changed_by");

-- CreateIndex
CREATE INDEX "vote_drafts_poll_id_idx" ON "vote_drafts"("poll_id");

-- CreateIndex
CREATE INDEX "vote_drafts_question_id_idx" ON "vote_drafts"("question_id");

-- CreateIndex
CREATE INDEX "vote_drafts_user_id_idx" ON "vote_drafts"("user_id");

-- CreateIndex
CREATE INDEX "vote_drafts_poll_id_user_id_idx" ON "vote_drafts"("poll_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vote_drafts_poll_id_question_id_user_id_answer_id_key" ON "vote_drafts"("poll_id", "question_id", "user_id", "answer_id");

-- AddForeignKey
ALTER TABLE "poll_participants" ADD CONSTRAINT "poll_participants_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_participants" ADD CONSTRAINT "poll_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_weight_history" ADD CONSTRAINT "participant_weight_history_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "poll_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_weight_history" ADD CONSTRAINT "participant_weight_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_drafts" ADD CONSTRAINT "vote_drafts_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_drafts" ADD CONSTRAINT "vote_drafts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_drafts" ADD CONSTRAINT "vote_drafts_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_drafts" ADD CONSTRAINT "vote_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
