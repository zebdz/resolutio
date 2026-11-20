-- Persist lazy-worker admission across releases, restarts and server instances.
ALTER TABLE seal_work_claims ADD COLUMN last_nudged_at TIMESTAMP(3);
