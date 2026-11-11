-- Preserve original cast evidence without inventing evidence for legacy votes.
ALTER TABLE "polls" ADD COLUMN "finished_at" TIMESTAMP(3);
ALTER TABLE "polls" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE "poll_participants" ADD COLUMN "receipt_secret" TEXT,
  ADD COLUMN "ballot_snapshot" JSONB;
ALTER TABLE "polls" ADD CONSTRAINT "poll_finished_at_state"
  CHECK (finished_at IS NULL OR state = 'FINISHED');
ALTER TABLE "poll_participants" ADD CONSTRAINT "participant_receipt_secret_format"
  CHECK (receipt_secret IS NULL OR receipt_secret ~ '^[0-9a-f]{64}$');

-- Increment even for narrow alternate writers, so stale full-row saves fail.
CREATE FUNCTION advance_poll_revision() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_immutable_mutation', true) IS DISTINCT FROM 'on' THEN
    IF OLD.state = 'FINISHED' AND (NEW.state <> OLD.state OR NEW.finished_at IS DISTINCT FROM OLD.finished_at) THEN
      RAISE EXCEPTION 'a finished poll cannot reopen or change its finish time';
    END IF;
    IF OLD.state <> 'FINISHED' AND NEW.state = 'FINISHED' AND NEW.finished_at IS NULL THEN
      RAISE EXCEPTION 'finishing requires a timestamp';
    END IF;
  END IF;
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER poll_revision BEFORE UPDATE ON polls
  FOR EACH ROW EXECUTE FUNCTION advance_poll_revision();

-- Alternative insert paths obey the same cutoff and parent-row lock.
CREATE FUNCTION guard_vote_insert() RETURNS trigger AS $$
DECLARE poll_state "PollState"; poll_archived TIMESTAMP(3); question_archived TIMESTAMP(3);
BEGIN
  IF current_setting('app.allow_immutable_mutation', true) = 'on' THEN RETURN NEW; END IF;
  SELECT p.state, p.archived_at, q.archived_at INTO poll_state, poll_archived, question_archived
    FROM polls p JOIN questions q ON q.poll_id = p.id
    WHERE q.id = NEW.question_id FOR UPDATE OF p;
  IF NOT FOUND OR poll_state <> 'ACTIVE' OR poll_archived IS NOT NULL OR question_archived IS NOT NULL THEN
    RAISE EXCEPTION 'votes require an active, unarchived poll and question';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM answers WHERE id = NEW.answer_id AND question_id = NEW.question_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'answer does not belong to the active question';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER votes_insert_guard BEFORE INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION guard_vote_insert();

CREATE FUNCTION reject_row_mutation() RETURNS trigger AS $$
BEGIN
  -- Operator convention only; this setting is not an authorization boundary.
  IF current_setting('app.allow_immutable_mutation', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'rows in % are immutable', TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER votes_immutable BEFORE UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION reject_row_mutation();

CREATE FUNCTION protect_cast_receipt() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_immutable_mutation', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.receipt_secret IS NOT NULL OR EXISTS (
      SELECT 1 FROM votes v JOIN questions q ON q.id = v.question_id WHERE q.poll_id = OLD.poll_id AND v.user_id = OLD.user_id
    ) THEN RAISE EXCEPTION 'a voter participant cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.receipt_secret IS NOT NULL AND NEW.receipt_secret IS DISTINCT FROM OLD.receipt_secret THEN
    RAISE EXCEPTION 'receipt secrets are set once';
  END IF;
  IF OLD.ballot_snapshot IS NOT NULL AND (
    NEW.ballot_snapshot IS DISTINCT FROM OLD.ballot_snapshot OR
    NEW.poll_id <> OLD.poll_id OR NEW.user_id <> OLD.user_id OR
    NEW.user_weight <> OLD.user_weight OR NEW.snapshot_at <> OLD.snapshot_at OR
    NEW.willing_to_sign_protocol IS DISTINCT FROM OLD.willing_to_sign_protocol
  ) THEN RAISE EXCEPTION 'cast receipt data is immutable'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER participant_cast_receipt BEFORE UPDATE OR DELETE ON poll_participants
  FOR EACH ROW EXECUTE FUNCTION protect_cast_receipt();
