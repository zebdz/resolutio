-- Aggregate only. Released leases have an expiry too, so only count expired
-- claims when the poll still has outstanding, currently due recovery work.
SELECT
  count(*) FILTER (WHERE s.poll_id IS NULL) AS pending_seals,
  count(*) FILTER (WHERE s.poll_id IS NOT NULL AND a.id IS NULL) AS missing_anchors,
  count(*) FILTER (WHERE a.status='FAILED') AS failed_anchors,
  count(*) FILTER (WHERE a.next_attempt_at <= (now() AT TIME ZONE 'UTC')) AS due_anchors,
  count(*) FILTER (WHERE c.lease_until <= now() AND (a.id IS NULL OR a.next_attempt_at <= (now() AT TIME ZONE 'UTC'))) AS reclaimable
FROM public.polls p LEFT JOIN public.poll_seals s ON s.poll_id=p.id
LEFT JOIN public.seal_anchors a ON a.poll_id=p.id AND a.status <> 'SUPERSEDED'
LEFT JOIN public.seal_work_claims c ON c.poll_id=p.id
WHERE p.state='FINISHED' AND p.finished_at IS NOT NULL;
