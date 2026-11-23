-- Exercise the optional evidence views on a published native rehearsal without modifying any rows.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$ DECLARE board_file text; board_viewer text; member_viewer text;
BEGIN
 SELECT user_id INTO STRICT board_viewer FROM berezka.accounts WHERE legacy_id=5;
 SELECT user_id INTO STRICT member_viewer FROM berezka.accounts WHERE legacy_id=94;
 SELECT a.key INTO STRICT board_file FROM historical_assets a JOIN historical_polls p ON p.id=a.poll_id
 WHERE p.board_id IS NOT NULL AND a.kind='protocol' LIMIT 1;
 IF historical_can_asset(NULL,board_file) OR historical_can_asset(member_viewer,board_file)
    OR NOT historical_can_asset(board_viewer,board_file)
    OR EXISTS(SELECT FROM historical_questions q WHERE q.public AND historical_can_question(NULL,q.id))
 THEN RAISE EXCEPTION 'Evidence audience differs from native membership'; END IF;
END $$;
ROLLBACK;
