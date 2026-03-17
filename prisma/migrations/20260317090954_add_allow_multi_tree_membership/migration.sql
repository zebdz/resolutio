-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "allow_multi_tree_membership" BOOLEAN DEFAULT false;

-- Set NULL for child orgs (inherited from root)
UPDATE "organizations" SET "allow_multi_tree_membership" = NULL WHERE "parent_id" IS NOT NULL;
