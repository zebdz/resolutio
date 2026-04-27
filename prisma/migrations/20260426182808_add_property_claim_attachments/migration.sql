-- CreateTable
CREATE TABLE "property_claim_attachments" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_claim_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_claim_attachments_claim_id_idx" ON "property_claim_attachments"("claim_id");

-- AddForeignKey
ALTER TABLE "property_claim_attachments" ADD CONSTRAINT "property_claim_attachments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "property_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
