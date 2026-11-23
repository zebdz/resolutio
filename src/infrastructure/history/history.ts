/** Authorized, source-independent reads shared by organization feeds, results and downloads.
 * The database filters the viewer's audience before returning content or named votes. */
import { prisma } from '@/infrastructure/database/prisma';
import { cache } from 'react';
import { Prisma } from '@/generated/prisma/client';
import type { UserId } from '@/domain/shared/EntityIds';
import type {
  HistoricalPollId,
  HistoricalQuestionId,
  HistoricalAssetKey,
} from '@/domain/history/HistoryIds';

type Viewer = UserId | null;
type Asset = {
  key: string;
  path: string;
  caption: string | null;
  kind: string;
};
type Entry = { id: string; title: string; collection: string | null };
export type HistoryFilters = {
  orgIds?: string[];
  search?: string;
  status?: string;
  boardId?: string;
  createdFrom?: string;
  createdTo?: string;
  startFrom?: string;
  startTo?: string;
};

// Ordinary installations have only native records. The importer installs optional
// read-only views for source evidence in the same transaction as its checkpoint.
const hasEvidence = cache(async () => {
  const [row] = await prisma.$queryRaw<{ available: boolean }[]>`
    select to_regclass('historical_imports') is not null as available`;

  return row.available;
});

export async function listHistory(
  viewer: Viewer,
  kind: 'poll' | 'report',
  filters: HistoryFilters = {}
) {
  if (!(await hasEvidence())) {
    return [];
  }

  // Compose the entire statement with one SQL tag. A client retained across
  // Next.js bundles can otherwise bind a nested SQL fragment as a JSON value.
  const conditions = [];

  if (filters.orgIds?.length) {
    conditions.push(
      Prisma.sql`i.organization_id in (${Prisma.join(filters.orgIds)})`
    );
  }

  if (kind === 'poll') {
    if (filters.status && filters.status.toUpperCase() !== 'FINISHED') {
      return [];
    }

    if (filters.boardId) {
      conditions.push(
        filters.boardId === '__org_wide__'
          ? Prisma.sql`p.board_id is null`
          : Prisma.sql`p.board_id=${filters.boardId}`
      );
    }

    for (const [day, field, inclusive] of [
      [filters.createdFrom, 'created', true],
      [filters.createdTo, 'created', false],
      [filters.startFrom, 'started', true],
      [filters.startTo, 'started', false],
    ] as const) {
      if (!day) {
        continue;
      }

      const iso = new Date(day + 'T00:00:00Z');

      if (!Number.isFinite(+iso) || iso.toISOString().slice(0, 10) !== day) {
        return [];
      }

      const column =
        field === 'created' ? Prisma.sql`p.created` : Prisma.sql`p.started`;
      conditions.push(
        inclusive
          ? Prisma.sql`${column} >= ${iso}`
          : Prisma.sql`${column} < ${new Date(+iso + 86400000)}`
      );
    }

    if (filters.search) {
      conditions.push(
        Prisma.sql`strpos(lower(p.title),lower(${filters.search}))>0`
      );
    }

    conditions.push(
      Prisma.sql`p.native_poll_id is null and p.kind in ('meeting','proposal') and historical_can_poll(${viewer},p.id)`
    );

    return prisma.$queryRaw<
      Entry[]
    >(Prisma.sql`select p.id,p.title,null::text collection from historical_polls p join historical_imports i on i.id=p.batch_id
      where ${Prisma.join(conditions, ' and ')} order by p.created desc nulls last,p.id`);
  }

  conditions.push(
    Prisma.sql`q.native_report_id is null and q.report and historical_can_question(${viewer},q.id)`
  );

  return prisma.$queryRaw<
    Entry[]
  >(Prisma.sql`select q.id,q.title,case when p.kind='collection' then p.title end collection
    from historical_questions q join historical_polls p on p.id=q.poll_id join historical_imports i on i.id=p.batch_id
    where ${Prisma.join(conditions, ' and ')} order by p.created desc nulls last,p.id,q.position nulls last,q.id`);
}

export async function readPoll(viewer: Viewer, id: HistoricalPollId) {
  if (!(await hasEvidence())) {
    return null;
  }

  const [poll] = await prisma.$queryRaw<
    {
      id: string;
      organization_id: string;
      source: string;
      native_poll_id: string | null;
      title: string;
      started: Date | null;
      finished: Date;
      finish_from_import: boolean;
      denominator: number | null;
      attendance: number;
    }[]
  >`
    select p.id,p.native_poll_id,i.organization_id,i.source,p.title,p.started,p.finished,p.finish_from_import,p.denominator,p.attendance
    from historical_polls p join historical_imports i on i.id=p.batch_id where p.id=${id} and historical_can_poll(${viewer},p.id)`;

  if (!poll) {
    return null;
  }

  const [questions, assets] = await Promise.all([
    prisma.$queryRaw<
      { id: string; title: string }[]
    >`select id,title from historical_questions where poll_id=${id} and historical_can_poll(${viewer},poll_id) order by position nulls last,id`,
    prisma.$queryRaw<
      Asset[]
    >`select key,path,caption,kind from historical_assets where poll_id=${id} and question_id is null and historical_can_asset(${viewer},key) order by kind,key`,
  ]);

  return { ...poll, questions, assets };
}

export async function readQuestion(
  viewer: Viewer,
  id: HistoricalQuestionId,
  projection: boolean
) {
  if (!(await hasEvidence())) {
    return null;
  }

  const [q] = await prisma.$queryRaw<
    {
      id: string;
      organization_id: string;
      title: string;
      body: string;
      author: string;
      created: Date | null;
      parent: string | null;
      native_report_id: string | null;
      report: boolean;
      score: number | null;
    }[]
  >`
    select q.id,i.organization_id,q.title,q.body,q.author,q.created,case when historical_can_poll(${viewer},q.poll_id) then coalesce(p.native_poll_id,q.poll_id) end parent,q.native_report_id,q.report,q.score
    from historical_questions q join historical_polls p on p.id=q.poll_id join historical_imports i on i.id=p.batch_id
    where q.id=${id} and historical_can_question(${viewer},q.id) and (not ${projection} or q.report)`;

  if (!q) {
    return null;
  }

  const [answers, assets, votes] = await Promise.all([
    prisma.$queryRaw<
      {
        id: string;
        label: string;
        ballots: number;
        weight: string;
        percent: string;
      }[]
    >`select id,label,ballots,weight::text,percent::text from historical_answers
      where question_id=${id} and historical_can_question(${viewer},question_id) order by position`,
    prisma.$queryRaw<
      Asset[]
    >`select key,path,caption,kind from historical_assets where question_id=${id} and historical_can_asset(${viewer},key) order by key`,
    projection || !q.parent
      ? []
      : prisma.$queryRaw<
          {
            id: string;
            user_id: string;
            name: string;
            label: string;
            cast_at: Date;
            cast_from_import: boolean;
            updated_at: Date | null;
          }[]
        >`
      select v.id,v.user_id,v.name,a.label,v.cast_at,v.cast_from_import,v.updated_at from historical_votes v join historical_answers a on a.id=v.answer_id
      join historical_questions q on q.id=v.question_id where v.question_id=${id} and historical_can_poll(${viewer},q.poll_id) order by v.cast_at,v.id`,
  ]);

  return { ...q, answers, assets, votes };
}

export async function readAsset(viewer: Viewer, id: HistoricalAssetKey) {
  if (!(await hasEvidence())) {
    return undefined;
  }

  const [asset] = await prisma.$queryRaw<
    { path: string; mime: string; bytes: Uint8Array }[]
  >`
  select a.path,a.mime,b.bytes from historical_assets a join historical_blobs b using(sha256) where a.key=${id} and historical_can_asset(${viewer},a.key)`;

  return asset;
}

export async function readProfiles(viewer: UserId, orgId: string) {
  if (!(await hasEvidence())) {
    return [];
  }

  return prisma.$queryRaw<
    {
      user_id: string;
      display_name: string;
      ownership: string | null;
      job: string | null;
    }[]
  >`select * from historical_profiles_for(${viewer},${orgId}) order by display_name,user_id`;
}

export async function hasProfileAccess(viewer: UserId, orgId: string) {
  if (!(await hasEvidence())) {
    return false;
  }

  const [row] = await prisma.$queryRaw<
    { available: boolean }[]
  >`select exists(select from historical_profiles_for(${viewer},${orgId})) available`;

  return row.available;
}
