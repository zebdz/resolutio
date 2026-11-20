-- Include voters missing their entire participant row. Count each ballot once.
WITH ballots AS (
  SELECT DISTINCT p.id, v.user_id FROM public.polls p
  JOIN public.questions q ON q.poll_id=p.id JOIN public.votes v ON v.question_id=q.id
  WHERE p.state IN ('ACTIVE','READY')
)
SELECT count(*)::integer AS ballots,
       count(*) FILTER (WHERE pp.receipt_secret IS NULL)::integer AS missing
FROM ballots b LEFT JOIN public.poll_participants pp ON (pp.poll_id,pp.user_id)=(b.id,b.user_id);
