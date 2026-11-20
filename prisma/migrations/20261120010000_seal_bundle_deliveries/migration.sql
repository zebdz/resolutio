-- One first delivery for each voter and immutable seal. An interrupted SMTP
-- handoff has an unknown outcome and can never be claimed a second time.
CREATE TABLE seal_bundle_deliveries (
 poll_id text NOT NULL REFERENCES poll_seals(poll_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 status text NOT NULL DEFAULT 'PENDING',
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_selected_at timestamp(3), attempt_started_at timestamp(3), completed_at timestamp(3), last_error text,
 PRIMARY KEY (poll_id,user_id),
 CHECK (
  (status='PENDING' AND attempt_started_at IS NULL AND completed_at IS NULL AND last_error IS NULL) OR
  (status='SENDING' AND attempt_started_at IS NOT NULL AND completed_at IS NULL AND last_error IS NULL) OR
  (status='SENT' AND attempt_started_at IS NOT NULL AND completed_at IS NOT NULL AND last_error IS NULL) OR
  (status IN ('FAILED','UNKNOWN') AND attempt_started_at IS NOT NULL AND completed_at IS NOT NULL AND last_error IS NOT NULL)
 )
);
CREATE INDEX seal_bundle_delivery_work ON seal_bundle_deliveries(status, attempt_started_at, created_at);
