import type {
  AddressProvider,
  AddressSuggestion,
  FlatSuggestion,
} from './types';

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

export class DaDataAddressProvider implements AddressProvider {
  // fetch is injected so tests never touch the network
  constructor(private readonly fetchFn: Fetch = fetch) {}

  private async query(query: string, count: number): Promise<DaDataRow[]> {
    const token = process.env.DADATA_API_KEY;

    if (!token || !query.trim()) {
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
    const rows = await this.query(query, HOUSE_COUNT);

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
      FLAT_COUNT
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
