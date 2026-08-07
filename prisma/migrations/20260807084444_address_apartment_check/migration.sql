-- Normalise first: treat blank/whitespace apartments as private houses, matching
-- Address.create's own `!props.apartment?.trim()` test. Idempotent and safe to re-run.
UPDATE "addresses"
   SET "is_private_house" = true
 WHERE btrim(coalesce("apartment", '')) = '';

-- Then make the state the domain rejects impossible to store at all.
ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_apartment_required"
  CHECK ("is_private_house" OR btrim(coalesce("apartment", '')) <> '');
