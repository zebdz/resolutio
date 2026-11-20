-- Operational lease rows survive release to retain monotonically increasing fencing tokens.
CREATE TABLE seal_work_claims (
  poll_id TEXT PRIMARY KEY REFERENCES polls(id) ON DELETE CASCADE,
  owner TEXT NOT NULL CHECK (owner ~ '^[A-Za-z0-9_-]+$' AND length(owner) BETWEEN 1 AND 256),
  lease_until TIMESTAMP(3) NOT NULL,
  fencing_token BIGINT NOT NULL CHECK (fencing_token > 0)
);
CREATE INDEX seal_work_claims_lease_until_idx ON seal_work_claims(lease_until);
