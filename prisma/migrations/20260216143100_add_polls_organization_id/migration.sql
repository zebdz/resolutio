-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "organization_id" TEXT NOT NULL,
ALTER COLUMN "board_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "polls_organization_id_idx" ON "polls"("organization_id");

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
