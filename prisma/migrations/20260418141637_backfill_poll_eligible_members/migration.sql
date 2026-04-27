-- Backfill poll_eligible_members from poll_participants for pre-feature polls.
INSERT INTO "poll_eligible_members" ("id", "poll_id", "user_id", "snapshot_at", "created_at")
SELECT
  concat('bk_', pp."id") AS id,
  pp."poll_id",
  pp."user_id",
  pp."snapshot_at",
  NOW()
FROM "poll_participants" pp
ON CONFLICT ("poll_id", "user_id") DO NOTHING;
