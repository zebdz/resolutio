/** Exercise native evidence ownership and byte fidelity in a rolled-back transaction on the pinned rehearsal. */
import { expect, it } from 'vitest';
import pg from 'pg';
import { readPackage } from './preflight.mjs';

it.skipIf(!process.env.BEREZKA_REHEARSAL_URL || !process.env.BEREZKA_PACKAGE)(
  'publishes finished named meetings, member reports and source-backed report links with no public projections',
  async () => {
    const { data } = await readPackage(process.env.BEREZKA_PACKAGE);
    const db = new pg.Client({
      connectionString: process.env.BEREZKA_REHEARSAL_URL,
    });
    await db.connect();

    try {
      await db.query('begin');
      const { publishNative, verifyNative, restoreQuestionOwners } =
        await import('./native-import.mjs');
      const {
        rows: [{ history_version }],
      } = await db.query('select history_version from berezka.import');

      if (history_version < 3) {
        expect(await publishNative(db, data)).toEqual({ published: true });
      }

      if (history_version === 3) {
        expect(await restoreQuestionOwners(db, data)).toEqual({
          published: true,
        });
      }

      const counts =
        await db.query(`select sum(n)::int files,count(*)::int questions,max(n)::int maximum, count(*) filter (where n>3)::int grandfathered
        from (select a.question_id,count(*) n from poll_attachments a join polls p on p.id=a.poll_id
          where p.organization_id='berezka-company-1' and a.question_id is not null group by a.question_id) q`);
      expect(counts.rows[0]).toEqual({
        files: 343,
        questions: 103,
        maximum: 15,
        grandfathered: 35,
      });
      expect(await verifyNative(db, data)).toMatchObject({
        meetings: 26,
        meetingVotes: 5601,
        meetingQuestions: 165,
        meetingAnswers: 502,
        contentReports: 339,
        protocolReports: 25,
        reportMeetingLinks: 15,
      });
    } finally {
      await db.query('rollback');
      await db.end();
    }
  },
  120000
);
