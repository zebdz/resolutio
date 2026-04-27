-- Hard guarantee: at most one ACTIVE (effective_until IS NULL) ownership row
-- per (asset_id, user_id). Two rows for the same user on one asset would
-- double-count their voting weight in the snapshot and break the
-- "shares sum to 1.0 per asset" invariant.
--
-- External-owner placeholders (user_id IS NULL) are deliberately allowed in
-- multiples — an asset can legitimately have several external owners
-- recorded by name.
--
-- Prisma 7 doesn't support partial unique indexes via @@unique, so this
-- migration creates the index directly. The schema.prisma model carries a
-- doc comment so future devs are aware.

CREATE UNIQUE INDEX "property_asset_ownerships_active_user_unique"
  ON "property_asset_ownerships" ("asset_id", "user_id")
  WHERE "effective_until" IS NULL AND "user_id" IS NOT NULL;
