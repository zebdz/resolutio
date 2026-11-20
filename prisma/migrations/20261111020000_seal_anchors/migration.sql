-- Anchor attempts may fail before receiving proof. Only one non-superseded
-- anchor exists per seal, including failed initial/replacement submissions.
CREATE TABLE seal_anchors (
  id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]+$' AND length(id) BETWEEN 1 AND 256),
  poll_id TEXT NOT NULL REFERENCES poll_seals(poll_id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('opentimestamps','stub')),
  status TEXT NOT NULL CHECK (status IN ('SUBMITTED','CONFIRMED','FAILED','SUPERSEDED')),
  pending_proof BYTEA,
  confirmed_proof BYTEA,
  bitcoin_height INTEGER,
  bitcoin_time TIMESTAMP(3),
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  last_error TEXT,
  next_attempt_at TIMESTAMP(3),
  submitted_at TIMESTAMP(3),
  confirmed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL,
  CHECK ((pending_proof IS NULL) = (submitted_at IS NULL)),
  CHECK (pending_proof IS NULL OR octet_length(pending_proof) > 0),
  CHECK (submitted_at IS NULL OR submitted_at >= created_at),
  CHECK (last_error IS NULL OR length(last_error) > 0),
  CONSTRAINT seal_anchor_state CHECK (
    (status = 'CONFIRMED' AND provider = 'opentimestamps'
      AND pending_proof IS NOT NULL AND confirmed_proof IS NOT NULL AND octet_length(confirmed_proof) > 0
      AND bitcoin_height IS NOT NULL AND bitcoin_height > 0 AND bitcoin_time IS NOT NULL
      AND confirmed_at IS NOT NULL AND confirmed_at >= submitted_at
      AND last_error IS NULL AND next_attempt_at IS NULL)
    OR (status <> 'CONFIRMED' AND confirmed_proof IS NULL AND bitcoin_height IS NULL
      AND bitcoin_time IS NULL AND confirmed_at IS NULL AND (
        (status = 'SUBMITTED' AND pending_proof IS NOT NULL AND next_attempt_at IS NOT NULL AND next_attempt_at > submitted_at)
        OR (status = 'FAILED' AND last_error IS NOT NULL AND next_attempt_at IS NOT NULL AND next_attempt_at > COALESCE(submitted_at,created_at))
        OR (status = 'SUPERSEDED' AND pending_proof IS NOT NULL AND next_attempt_at IS NULL)
      ))
  )
);
CREATE UNIQUE INDEX seal_anchors_one_active ON seal_anchors(poll_id) WHERE status <> 'SUPERSEDED';
CREATE INDEX seal_anchors_due ON seal_anchors(next_attempt_at);
