-- DropForeignKey
ALTER TABLE "property_asset_ownerships" DROP CONSTRAINT "property_asset_ownerships_user_id_fkey";

-- AlterTable: add size_unit as NULLABLE, backfill existing rows (condo demo = m²), then enforce NOT NULL
ALTER TABLE "organization_properties" ADD COLUMN "size_unit" TEXT;
UPDATE "organization_properties" SET "size_unit" = 'SQUARE_METERS' WHERE "size_unit" IS NULL;
ALTER TABLE "organization_properties" ALTER COLUMN "size_unit" SET NOT NULL;

-- AlterTable
ALTER TABLE "property_asset_ownerships" ADD COLUMN     "external_owner_label" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "property_claims" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "denied_reason" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_claims_organization_id_status_idx" ON "property_claims"("organization_id", "status");

-- CreateIndex
CREATE INDEX "property_claims_user_id_idx" ON "property_claims"("user_id");

-- CreateIndex
CREATE INDEX "property_claims_asset_id_idx" ON "property_claims"("asset_id");

-- AddForeignKey
ALTER TABLE "property_asset_ownerships" ADD CONSTRAINT "property_asset_ownerships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_claims" ADD CONSTRAINT "property_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_claims" ADD CONSTRAINT "property_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_claims" ADD CONSTRAINT "property_claims_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "property_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_claims" ADD CONSTRAINT "property_claims_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce exactly one of user_id or external_owner_label is set on property_asset_ownerships
ALTER TABLE "property_asset_ownerships"
  ADD CONSTRAINT "property_asset_ownerships_owner_repr_chk"
  CHECK (
    ( ("user_id" IS NOT NULL)::int + ("external_owner_label" IS NOT NULL)::int ) = 1
  );
