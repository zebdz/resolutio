-- DropIndex
DROP INDEX "boards_organization_id_is_general_idx";

-- AlterTable
ALTER TABLE "boards" DROP COLUMN "is_general";
