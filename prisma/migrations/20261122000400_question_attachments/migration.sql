-- A file can belong to the poll description or to a question in that same poll.
ALTER TABLE questions ADD CONSTRAINT questions_id_poll_id_key UNIQUE (id, poll_id);
ALTER TABLE poll_attachments ADD COLUMN question_id text;
ALTER TABLE poll_attachments ADD CONSTRAINT poll_attachments_question_id_poll_id_fkey
  FOREIGN KEY (question_id,poll_id) REFERENCES questions(id,poll_id) ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX poll_attachments_poll_id_question_id_idx ON poll_attachments(poll_id,question_id);
