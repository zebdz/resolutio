-- Private operator checkpoint, account crosswalk and original supplemental evidence.
CREATE SCHEMA berezka;
REVOKE ALL ON SCHEMA berezka FROM PUBLIC;

CREATE TABLE berezka.import (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  history_version integer NOT NULL DEFAULT 1,
  identity_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  digest text NOT NULL, mapping_digest text NOT NULL, attestation text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE berezka.accounts (
  legacy_id integer PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES public.users(id),
  created boolean NOT NULL
);
CREATE TABLE berezka.source (
  kind text NOT NULL, id integer NOT NULL, record jsonb NOT NULL,
  PRIMARY KEY(kind,id), CHECK ((record->>'id')::int = id)
);
CREATE INDEX source_question ON berezka.source(kind, ((record->>'question_id')::int));
CREATE INDEX source_poll ON berezka.source(kind, ((record->>'poll_id')::int));
CREATE INDEX source_answer ON berezka.source(kind, ((record->>'answer_id')::int));
CREATE TABLE berezka.content (
  question_id integer PRIMARY KEY, title text NOT NULL, body text NOT NULL, issues jsonb NOT NULL
);
CREATE TABLE berezka.blobs (
  sha256 text PRIMARY KEY, bytes bytea NOT NULL,
  CHECK (encode(sha256(bytes),'hex')=sha256)
);
CREATE TABLE berezka.assets (
  key text PRIMARY KEY, poll_id integer NOT NULL, question_id integer,
  kind text NOT NULL, path text NOT NULL, caption text, mime text NOT NULL,
  sha256 text NOT NULL REFERENCES berezka.blobs
);
-- Names needed for historical attribution. Supplemental profiles and source credentials stay restricted.
CREATE VIEW berezka.names AS SELECT id, record->>'name' AS name FROM berezka.source WHERE kind='users';
CREATE VIEW berezka.polls AS
 SELECT id, record->>'name' title, (record->>'type_of_poll')::int type,
  (record->>'start')::timestamp AT TIME ZONE 'Europe/Moscow' started,
  (record->>'finished')::timestamp AT TIME ZONE 'Europe/Moscow' finished,
  (record->>'created_at')::timestamp AT TIME ZONE 'UTC' created,
  (record->>'potential_voters_number')::int denominator
 FROM berezka.source WHERE kind='polls';
CREATE VIEW berezka.questions AS
 SELECT id,(record->>'poll_id')::int poll_id,(record->>'author')::int author,
  (record->>'public')::int=1 public, (record->>'is_editing')::int=1 editing,
  (record->>'position_in_poll')::int position, (record->>'created_at')::timestamp AT TIME ZONE 'UTC' created
 FROM berezka.source WHERE kind='questions';
CREATE VIEW berezka.reports AS
 SELECT q.* FROM berezka.questions q JOIN berezka.polls p ON p.id=q.poll_id
 WHERE p.type IN (5,7);
CREATE VIEW berezka.answers AS
 SELECT id,(record->>'question_id')::int question_id, record->>'text' label FROM berezka.source WHERE kind='answers';
CREATE VIEW berezka.votes AS
 SELECT s.id,(s.record->>'question_id')::int question_id,(s.record->>'answer_id')::int answer_id,
 a.user_id,a.legacy_id,(s.record->>'created_at')::timestamp AT TIME ZONE 'UTC' cast_at,
 (s.record->>'updated_at')::timestamp AT TIME ZONE 'UTC' updated_at
 FROM berezka.source s JOIN berezka.accounts a ON a.legacy_id=(s.record->>'user_id')::int WHERE s.kind='votes';
CREATE VIEW berezka.weights AS
 SELECT (u.record->>'user_id')::int legacy_id,sum((r.record->>'weight')::numeric*(r.record->>'number_of_share')::numeric) weight
 FROM berezka.source u JOIN berezka.source r ON r.kind='rights' AND r.id=(u.record->>'right_id')::int
 WHERE u.kind='right_user' AND (r.record->>'type_of_right')::int=1 GROUP BY 1;
CREATE VIEW berezka.tallies AS
 WITH totals AS (SELECT a.id,a.question_id,a.label,count(v.id)::int ballots,coalesce(sum(w.weight),0) weight
 FROM berezka.answers a LEFT JOIN berezka.votes v ON v.answer_id=a.id AND v.question_id=a.question_id
 LEFT JOIN berezka.weights w USING(legacy_id) GROUP BY a.id,a.question_id,a.label)
 SELECT *,coalesce(round(100.0*ballots/nullif(sum(ballots) OVER(PARTITION BY question_id),0),2),0) percent
 FROM totals;
CREATE VIEW berezka.scores AS
 SELECT t.question_id,coalesce(round(sum(t.ballots*t.label::numeric)/nullif(sum(t.ballots),0)),0)::int score
 FROM berezka.tallies t JOIN berezka.questions q ON q.id=t.question_id JOIN berezka.polls p ON p.id=q.poll_id
 WHERE p.type=5 GROUP BY t.question_id;
