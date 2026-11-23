/** Verify durable identity records before accepting them as evidence on a later run. */
import { it, expect } from 'vitest';
import { preflight } from './preflight.mjs';
it('checks every user and flags a persisted mapping that disagrees with the approved import', async () => {
  const data = {
    rows: {
      users: [
        {
          id: 1,
          phone: '9990000000',
          name: 'Sample User',
          permissions: 'admin',
        },
      ],
      companies: [{ title: 'Berezka' }],
      users_additional_fields: [],
      organizers: [],
    },
  };
  const db = {
    query: async (sql) => {
      let rows = [];

      if (sql.includes('from users order by')) {
        rows = [
          {
            id: 'incorrect',
            nickname: 'existing',
            phone_number: '+79990000000',
            full_name: 'Sample User',
            confirmed_at: '2020-01-01',
          },
        ];
      }

      if (sql.includes('to_regclass')) {
        rows = [{ accounts: 'berezka.accounts' }];
      }

      if (sql.includes('from berezka.accounts')) {
        rows = [{ legacy_id: 1, user_id: 'incorrect', created: false }];
      }

      if (sql.includes('from berezka.import')) {
        rows = [
          {
            published_at: '2026-01-01',
            identity_plan: [
              { legacyId: 1, targetId: 'correct', action: 'reuse' },
            ],
          },
        ];
      }

      return { rows };
    },
  };
  expect((await preflight(db, data, {})).counts.review).toBe(1);
});

it('requires every recorded voter to have unit weight before mapping to EQUAL distribution', async () => {
  const { checkEqualDistribution } = await import('./preflight.mjs');
  const rows = {
    rights: [{ id: 1, type_of_right: 1, weight: 1, number_of_share: 1 }],
    right_user: [{ user_id: 7, right_id: 1 }],
    votes: [{ user_id: 7 }, { user_id: 7 }],
  };
  expect(checkEqualDistribution(rows)).toEqual({ distributionType: 'EQUAL' });
  expect(
    checkEqualDistribution({ ...rows, votes: [{ user_id: 8 }] })
  ).toHaveProperty('error');
  expect(
    checkEqualDistribution({
      ...rows,
      right_user: [...rows.right_user, ...rows.right_user],
    })
  ).toHaveProperty('error');
});
