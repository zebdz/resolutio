-- CreateTable
CREATE TABLE "poll_attachments" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "poll_attachments_poll_id_idx" ON "poll_attachments"("poll_id");

-- AddForeignKey
ALTER TABLE "poll_attachments" ADD CONSTRAINT "poll_attachments_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
