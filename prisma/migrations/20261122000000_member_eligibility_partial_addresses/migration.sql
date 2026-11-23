-- Voting eligibility and incomplete imported addresses belong to their native records.
ALTER TABLE organization_users ADD COLUMN voting_eligible boolean NOT NULL DEFAULT true;
ALTER TABLE addresses ALTER COLUMN building DROP NOT NULL, ALTER COLUMN is_private_house DROP NOT NULL,
 ADD CONSTRAINT address_completeness CHECK (
 (is_private_house IS NULL AND nullif(btrim(one_line),'') IS NOT NULL AND apartment IS NULL AND flat_fias_id IS NULL)
 OR (is_private_house IS NOT NULL AND building IS NOT NULL));
