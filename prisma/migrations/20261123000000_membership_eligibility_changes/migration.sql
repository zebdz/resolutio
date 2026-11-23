-- Record decisions separately from membership links so departures retain the audit trail.
CREATE TABLE membership_eligibility_changes (
  id bigserial PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  member_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  was_eligible boolean NOT NULL,
  eligible boolean NOT NULL CHECK (eligible <> was_eligible),
  reason varchar(500) NOT NULL CHECK (reason ~ '[^[:space:]]'),
  changed_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX membership_eligibility_changes_organization_id_id_idx ON membership_eligibility_changes(organization_id,id);
