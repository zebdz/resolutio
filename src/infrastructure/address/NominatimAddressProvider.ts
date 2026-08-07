import type { AddressProvider, AddressSuggestion } from './types';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimRow {
  display_name: string;
  address: Record<string, string | undefined>;
}

type Fetch = typeof fetch;

export class NominatimAddressProvider implements AddressProvider {
  // fetch is injected so tests never touch the network
  constructor(private readonly fetchFn: Fetch = fetch) {}

  async suggestAddress(query: string): Promise<AddressSuggestion[]> {
    if (!query.trim()) {
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
    });

    try {
      const res = await this.fetchFn(`${SEARCH_URL}?${params}`, {
        headers: {
          // Russian for consistency with DaData — stored addresses are always Russian
          'Accept-Language': 'ru',
          'User-Agent': 'resolutio/1.0 (address autocomplete)',
        },
      });

      if (!res.ok) {
        return [];
      }

      const rows = (await res.json()) as NominatimRow[];

      return rows.map((row) => ({
        label: row.display_name,
        // Deliberately blank, not row.display_name. Elsewhere in the app the
        // presence of oneLine is read as "this address came from DaData"
        // (design doc, Data model: "presence of oneLine already implies a
        // DaData selection"). An OSM display_name is a structurally
        // different string (comma-joined, no postal-code-first ordering,
        // sometimes English) — feeding it back into DaData's suggest
        // resolves to nothing or the wrong address, so it must never be
        // stored as if it were a DaData unrestricted_value.
        oneLine: '',
        country: row.address.country ?? '',
        region: row.address.state ?? '',
        city: row.address.city ?? row.address.town ?? row.address.village ?? '',
        street: row.address.road ?? '',
        building: row.address.house_number ?? '',
        postalCode: row.address.postcode ?? '',
        // Nominatim has no ГАР ids — flats can never be suggested for these
        houseFiasId: undefined,
      }));
    } catch {
      // Caller (resolver) treats this the same as "no results"
      return [];
    }
  }
}
