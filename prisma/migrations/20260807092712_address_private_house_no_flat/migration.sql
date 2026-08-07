-- Normalise existing contradictions first, or ADD CONSTRAINT will fail on them.
-- This mirrors exactly what Address.create already does in memory for a private
-- house: it forces both apartment and flatFiasId to undefined. So this discards
-- nothing the domain would have kept.
UPDATE "addresses"
   SET "apartment" = NULL,
       "flat_fias_id" = NULL
 WHERE "is_private_house"
   AND (btrim(coalesce("apartment", '')) <> '' OR "flat_fias_id" IS NOT NULL);

-- A private house has no flat. Together with the existing
-- addresses_apartment_required constraint this makes the domain's rule a real
-- biconditional at the database level, rather than something every write path
-- has to remember.
ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_private_house_no_flat"
  CHECK (
    NOT "is_private_house"
    OR (btrim(coalesce("apartment", '')) = '' AND "flat_fias_id" IS NULL)
  );
