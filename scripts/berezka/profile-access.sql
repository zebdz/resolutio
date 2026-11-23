-- Run against the published rehearsal. Only the owner and Berezka admins may see supplemental profiles.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$ DECLARE owner_id text; admin_id text; total int;
BEGIN
 SELECT user_id INTO admin_id FROM berezka.accounts WHERE legacy_id=1;
 SELECT a.user_id INTO owner_id FROM berezka.accounts a JOIN berezka.source s ON s.kind='users' AND s.id=a.legacy_id
 JOIN berezka.source f ON f.kind='users_additional_fields' AND f.id=(s.record->>'additional_id')::int
 WHERE a.legacy_id NOT IN(1,155,283) LIMIT 1;
 SELECT count(*) INTO total FROM historical_profiles_for(admin_id,'berezka-company-1');
 IF total<>69 OR (SELECT count(*) FROM historical_profiles_for(owner_id,'berezka-company-1'))<>1
 OR EXISTS(SELECT FROM historical_profiles_for(NULL,'berezka-company-1')) OR EXISTS(SELECT FROM historical_profiles_for('unknown-viewer','berezka-company-1'))
 THEN RAISE EXCEPTION 'restricted profile scope'; END IF;
END $$;
ROLLBACK;
