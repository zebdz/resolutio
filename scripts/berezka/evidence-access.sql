-- Scope supplementary evidence to the viewer without scanning ballot or attachment contents.
-- Indexed opaque keys are shared by the importer and existing private evidence links.
CREATE FUNCTION berezka.evidence_id(kind text, source_id text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT 'hist_' || left(encode(sha256(convert_to('decision.community/berezka/' || kind || '/' || source_id,'UTF8')),'hex'),32)
$$;
CREATE INDEX evidence_poll_key ON berezka.source (berezka.evidence_id('poll', id::text)) WHERE kind='polls';
CREATE INDEX evidence_question_key ON berezka.source (berezka.evidence_id('question', id::text)) WHERE kind='questions';
CREATE INDEX evidence_asset_key ON berezka.assets (berezka.evidence_id('asset',key));

CREATE FUNCTION historical_can_poll(viewer text, parent text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT FROM berezka.polls p
 JOIN public.organization_users m ON m.organization_id='berezka-company-1' AND m.user_id=viewer AND m.status='accepted'
 JOIN public.organizations org ON org.id=m.organization_id AND org.archived_at IS NULL
 WHERE berezka.evidence_id('poll',p.id::text)=parent AND (p.type<>6 OR EXISTS(SELECT FROM public.organization_admin_users a
 WHERE a.organization_id=m.organization_id AND a.user_id=viewer) OR EXISTS(SELECT FROM berezka.questions q
 JOIN berezka.accounts a ON a.legacy_id=q.author WHERE q.poll_id=p.id AND (NOT q.editing OR a.user_id=viewer))))
$$;
CREATE FUNCTION historical_can_question(viewer text, question text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT FROM berezka.questions q WHERE berezka.evidence_id('question',q.id::text)=question
 AND public.historical_can_poll(viewer,berezka.evidence_id('poll',q.poll_id::text)))
$$;
CREATE FUNCTION historical_can_asset(viewer text, asset text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT EXISTS(SELECT FROM berezka.assets a JOIN berezka.polls p ON p.id=a.poll_id
 WHERE berezka.evidence_id('asset',a.key)=asset AND a.kind NOT IN ('unassigned','alternate')
 AND public.historical_can_poll(viewer,berezka.evidence_id('poll',p.id::text))
 AND (p.type<>2 OR EXISTS(SELECT FROM public.board_users b JOIN public.boards br ON br.id=b.board_id
 WHERE b.board_id='berezka-board' AND br.archived_at IS NULL AND b.user_id=viewer AND b.removed_at IS NULL)
 OR EXISTS(SELECT FROM public.organization_admin_users u WHERE u.organization_id='berezka-company-1' AND u.user_id=viewer)))
$$;
CREATE FUNCTION historical_profiles_for(viewer text, org_id text)
RETURNS TABLE(user_id text,display_name text,ownership text,job text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT p.user_id,p.display_name,p.ownership,p.job FROM public.historical_profiles p
 JOIN public.historical_imports i ON i.id=p.batch_id WHERE i.organization_id=org_id AND
 (p.user_id=viewer OR EXISTS(SELECT FROM public.organization_admin_users a
 JOIN public.organization_users m USING(organization_id,user_id) JOIN public.organizations o ON o.id=m.organization_id
 WHERE a.organization_id=org_id AND a.user_id=viewer AND m.status='accepted' AND o.archived_at IS NULL))
$$;
REVOKE ALL ON FUNCTION historical_profiles_for(text,text) FROM PUBLIC;
