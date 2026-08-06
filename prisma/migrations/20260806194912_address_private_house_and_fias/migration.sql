-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "flat_fias_id" TEXT,
ADD COLUMN     "house_fias_id" TEXT,
ADD COLUMN     "is_private_house" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "one_line" TEXT;

-- Existing apartment-less addresses are treated as private houses.
-- Without this, they violate the new domain invariant and throw on load
-- (PrismaUserRepository calls Address.create() during reconstitution).
UPDATE "addresses" SET "is_private_house" = true WHERE "apartment" IS NULL;
