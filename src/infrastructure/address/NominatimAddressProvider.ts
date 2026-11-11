/** Decodes Nominatim transport rows before mapping plain autocomplete suggestions.
 * Malformed responses use the same empty-result fallback as network failures. */
import { z } from 'zod';
import type { AddressProvider, AddressSuggestion } from './types';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

const optionalText = z.string().nullish();
const responseSchema = z.array(
  z.object({
    display_name: z.string(),
    address: z.object({
      country: optionalText,
      state: optionalText,
      city: optionalText,
      town: optionalText,
      village: optionalText,
      road: optionalText,
      house_number: optionalText,
      postcode: optionalText,
    }),
  })
);

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

      const parsed = responseSchema.safeParse(await res.json());

      if (!parsed.success) {
        return [];
      }

      const rows = parsed.data;

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
        // Nominatim has no flat data at all (see design doc, "Nominatim has
        // no flat data") — nothing to map, and nothing to strip from the
        // label, so houseLabel is simply the label itself.
        flat: '',
        flatFiasId: undefined,
        houseLabel: row.display_name,
      }));
    } catch {
      // Caller (resolver) treats this the same as "no results"
      return [];
    }
  }
}
