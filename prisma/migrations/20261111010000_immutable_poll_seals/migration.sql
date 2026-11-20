-- Store canonical bytes as text, never reserialized JSON, and salted leaves in order.
CREATE TABLE poll_seals (
  poll_id TEXT PRIMARY KEY REFERENCES polls(id) ON DELETE RESTRICT,
  root_digest TEXT NOT NULL UNIQUE CHECK (root_digest ~ '^[0-9a-f]{64}$'),
  manifest TEXT NOT NULL,
  section_poll TEXT NOT NULL,
  section_tallies TEXT NOT NULL,
  section_register TEXT NOT NULL,
  section_signers TEXT NOT NULL,
  votes JSONB NOT NULL CHECK (jsonb_typeof(votes) = 'array'),
  sealed_at TIMESTAMP(3) NOT NULL
);
CREATE TRIGGER poll_seals_immutable BEFORE UPDATE OR DELETE ON poll_seals
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();
