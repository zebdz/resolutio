-- Delete stale rate_limit_events with old limiter labels from before the split
DELETE FROM rate_limit_events WHERE limiter_label IN ('middleware', 'serverAction');
