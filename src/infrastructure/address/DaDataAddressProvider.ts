import type {
  AddressProvider,
  AddressSuggestion,
  FlatSuggestion,
} from './types';
import type { AddressQuotaLogger } from './AddressQuotaLogger';

const SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

// DaData returns at most 20; we show far fewer
const HOUSE_COUNT = 7;
const FLAT_COUNT = 10;

interface DaDataRow {
  value: string;
  unrestricted_value: string;
  data: Record<string, string | null>;
}

type Fetch = typeof fetch;
type Route = 'suggest' | 'flats';

export class DaDataAddressProvider implements AddressProvider {
  // fetch is injected so tests never touch the network
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly quotaLogger?: AddressQuotaLogger
  ) {}

  private async query(
    query: string,
    count: number,
    route: Route
  ): Promise<DaDataRow[]> {
    const token = process.env.DADATA_API_KEY;

    // Misconfiguration must fail loudly. An empty array is the resolver's signal
    // to fall back to Nominatim, which has NO apartment data — so silently
    // returning [] here would route all Russian traffic to a provider that
    // cannot do the one thing this feature exists for, with no operator signal.
    // Thrown BEFORE the try/catch below so it propagates rather than being
    // swallowed into an empty result.
    if (!token) {
      throw new Error(
        'DADATA_API_KEY is not configured — address suggestions cannot work'
      );
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const res = await this.fetchFn(SUGGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          query,
          count,
          // Addresses feed Russian legal documents — always store Russian
          language: 'ru',
          // Without this every non-RU query returns zero results
          locations: [{ country: '*' }],
        }),
      });

      // 429 is DaData telling us the account quota is exhausted — the authoritative
      // signal, versus our own cap which is only an estimate. Logged distinctly so a
      // superadmin can tell "our guard fired" from "we actually ran out".
      if (res.status === 429) {
        await this.quotaLogger?.logQuotaRejected({ route, statusCode: 429 });

        return [];
      }

      if (!res.ok) {
        return [];
      }

      const json = (await res.json()) as { suggestions?: DaDataRow[] };

      return json.suggestions ?? [];
    } catch {
      // Caller falls back to Nominatim
      return [];
    }
  }

  async suggestAddress(query: string): Promise<AddressSuggestion[]> {
    const rows = await this.query(query, HOUSE_COUNT, 'suggest');

    return rows.map((row) => ({
      label: row.value,
      oneLine: row.unrestricted_value,
      country: row.data.country ?? '',
      region: row.data.region_with_type ?? '',
      city: row.data.city ?? '',
      street: row.data.street_with_type ?? '',
      building: row.data.house ?? '',
      postalCode: row.data.postal_code ?? '',
      houseFiasId: row.data.house_fias_id ?? undefined,
    }));
  }

  async suggestFlats(
    houseLabel: string,
    fragment: string
  ): Promise<FlatSuggestion[]> {
    // Scoping by locations[{fias_id}] returns zero results, and
    // to_bound:{value:'flat'} does not filter — plain text query is the only
    // approach that works. See readmes/2026-08-06-address-dadata-design.md
    const rows = await this.query(
      `${houseLabel} кв ${fragment}`.trim(),
      FLAT_COUNT,
      'flats'
    );

    return rows
      .filter((row) => row.data.flat)
      .map((row) => ({
        label: row.value,
        flat: row.data.flat as string,
        oneLine: row.unrestricted_value,
        flatFiasId: row.data.flat_fias_id ?? undefined,
      }));
  }
}
