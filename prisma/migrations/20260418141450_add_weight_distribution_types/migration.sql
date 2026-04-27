-- AlterTable
ALTER TABLE "participant_weight_history" ALTER COLUMN "old_weight" SET DATA TYPE DECIMAL(15,6),
ALTER COLUMN "new_weight" SET DATA TYPE DECIMAL(15,6);

-- AlterTable
ALTER TABLE "poll_participants" ALTER COLUMN "user_weight" SET DATA TYPE DECIMAL(15,6);

-- AlterTable
ALTER TABLE "polls" ADD COLUMN     "distribution_type" TEXT NOT NULL DEFAULT 'EQUAL',
ADD COLUMN     "property_aggregation" TEXT NOT NULL DEFAULT 'RAW_SUM';

-- AlterTable
ALTER TABLE "votes" ALTER COLUMN "user_weight" SET DATA TYPE DECIMAL(15,6);

-- CreateTable
CREATE TABLE "organization_properties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "organization_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_assets" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" DECIMAL(15,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "property_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_asset_ownerships" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "share" DECIMAL(9,8) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_asset_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_properties" (
    "poll_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,

    CONSTRAINT "poll_properties_pkey" PRIMARY KEY ("poll_id","property_id")
);

-- CreateTable
CREATE TABLE "poll_eligible_members" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_eligible_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_properties_organization_id_idx" ON "organization_properties"("organization_id");

-- CreateIndex
CREATE INDEX "property_assets_property_id_idx" ON "property_assets"("property_id");

-- CreateIndex
CREATE INDEX "property_asset_ownerships_asset_id_effective_until_idx" ON "property_asset_ownerships"("asset_id", "effective_until");

-- CreateIndex
CREATE INDEX "property_asset_ownerships_user_id_effective_until_idx" ON "property_asset_ownerships"("user_id", "effective_until");

-- CreateIndex
CREATE INDEX "poll_properties_poll_id_idx" ON "poll_properties"("poll_id");

-- CreateIndex
CREATE INDEX "poll_eligible_members_poll_id_idx" ON "poll_eligible_members"("poll_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_eligible_members_poll_id_user_id_key" ON "poll_eligible_members"("poll_id", "user_id");

-- AddForeignKey
ALTER TABLE "organization_properties" ADD CONSTRAINT "organization_properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_assets" ADD CONSTRAINT "property_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "organization_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_asset_ownerships" ADD CONSTRAINT "property_asset_ownerships_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "property_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_asset_ownerships" ADD CONSTRAINT "property_asset_ownerships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_properties" ADD CONSTRAINT "poll_properties_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_properties" ADD CONSTRAINT "poll_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "organization_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_eligible_members" ADD CONSTRAINT "poll_eligible_members_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_eligible_members" ADD CONSTRAINT "poll_eligible_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "property_assets" ADD CONSTRAINT "property_assets_size_positive_chk" CHECK ("size" > 0);
ALTER TABLE "property_asset_ownerships" ADD CONSTRAINT "property_asset_ownerships_share_range_chk" CHECK ("share" >= 0 AND "share" <= 1);
