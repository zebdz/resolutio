-- Block old and new vote/finish writers at their shared database. Ordinary
-- rollouts keep the hold across process exits until the fleet is acknowledged.
CREATE OR REPLACE FUNCTION resolutio_ops.hold_poll_writes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'poll_participants' AND TG_OP = 'UPDATE'
     AND current_user = (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='resolutio_ops')
     AND to_jsonb(OLD)->>'receipt_secret' IS NULL
     AND to_jsonb(NEW)->>'receipt_secret' ~ '^[0-9a-f]{64}$'
     AND to_jsonb(OLD)-'receipt_secret' = to_jsonb(NEW)-'receipt_secret' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'poll seal rollout hold' USING ERRCODE='55000';
END $$;
