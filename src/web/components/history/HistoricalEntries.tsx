/** List authorized historical items directly in the ordinary poll and report feeds. */
import { getTranslations } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';
import { listHistory } from '@/infrastructure/history/history';

export async function HistoricalEntries({
  items,
  kind,
}: {
  items: Awaited<ReturnType<typeof listHistory>>;
  kind: 'poll' | 'report';
}) {
  if (!items.length) {
    return null;
  }

  const t = await getTranslations('history');
  const groups = Map.groupBy(items, (e) => e.collection);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">
        {t(kind === 'poll' ? 'meetings' : 'reports')}
      </h2>
      {[...groups].map(([collection, entries]) => {
        const links = (
          <ul className="space-y-1">
            {entries.map((e) => (
              <li key={e.id}>
                <Link
                  className="cursor-pointer underline"
                  href={
                    kind === 'poll'
                      ? '/polls/' + e.id + '/results'
                      : '/reports/' + e.id
                  }
                >
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        );

        return collection ? (
          <details key={'collection-' + collection}>
            <summary className="cursor-pointer">{collection}</summary>
            {links}
          </details>
        ) : (
          <div key="ungrouped">{links}</div>
        );
      })}
    </section>
  );
}
