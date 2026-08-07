import { describe, it, expect, vi, afterEach } from 'vitest';
import { NominatimAddressProvider } from '../NominatimAddressProvider';

// Real payload shape (jsonv2, addressdetails=1), trimmed to the fields we map.
// We request Accept-Language: ru, so Nominatim returns Russian names when it
// has them — same "Berlin Alexanderplatz" scenario verified elsewhere in this
// feature (design doc, resolver test).
const ALEXANDERPLATZ_ROW = {
  display_name: 'Александерплац 1, Митте, Берлин, 10178, Германия',
  address: {
    house_number: '1',
    road: 'Александерплац',
    suburb: 'Митте',
    city: 'Берлин',
    state: 'Берлин',
    postcode: '10178',
    country: 'Германия',
    country_code: 'de',
  },
};

function mockFetchOnce(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

describe('NominatimAddressProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a Nominatim row onto AddressSuggestion', async () => {
    const fetchMock = mockFetchOnce([ALEXANDERPLATZ_ROW]);
    const provider = new NominatimAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress('Alexanderplatz');

    expect(suggestion.label).toBe(ALEXANDERPLATZ_ROW.display_name);
    expect(suggestion.oneLine).toBe(ALEXANDERPLATZ_ROW.display_name);
    expect(suggestion.country).toBe('Германия');
    expect(suggestion.region).toBe('Берлин');
    expect(suggestion.city).toBe('Берлин');
    expect(suggestion.street).toBe('Александерплац');
    expect(suggestion.building).toBe('1');
    expect(suggestion.postalCode).toBe('10178');
  });

  it('returns houseFiasId as undefined, never an empty string — the UI reads its presence as "apartment suggestions are possible"', async () => {
    const fetchMock = mockFetchOnce([ALEXANDERPLATZ_ROW]);
    const provider = new NominatimAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress('Alexanderplatz');

    expect(suggestion.houseFiasId).toBeUndefined();
  });

  it('always requests Russian, so both providers store addresses consistently', async () => {
    const fetchMock = mockFetchOnce([ALEXANDERPLATZ_ROW]);
    const provider = new NominatimAddressProvider(fetchMock);

    await provider.suggestAddress('Alexanderplatz');

    const headers = fetchMock.mock.calls[0][1].headers;

    expect(headers['Accept-Language']).toBe('ru');
  });

  it("sends an identifying User-Agent, per Nominatim's usage policy", async () => {
    const fetchMock = mockFetchOnce([ALEXANDERPLATZ_ROW]);
    const provider = new NominatimAddressProvider(fetchMock);

    await provider.suggestAddress('Alexanderplatz');

    const headers = fetchMock.mock.calls[0][1].headers;

    expect(headers['User-Agent']).toBe('resolutio/1.0 (address autocomplete)');
  });

  it('prefers city, then town, then village', async () => {
    const cityWins = {
      display_name: 'x',
      address: { city: 'Город', town: 'Пгт', village: 'Село' },
    };
    const townWins = {
      display_name: 'x',
      address: { town: 'Пгт', village: 'Село' },
    };
    const villageOnly = { display_name: 'x', address: { village: 'Село' } };

    const [byCity] = await new NominatimAddressProvider(
      mockFetchOnce([cityWins])
    ).suggestAddress('q');
    const [byTown] = await new NominatimAddressProvider(
      mockFetchOnce([townWins])
    ).suggestAddress('q');
    const [byVillage] = await new NominatimAddressProvider(
      mockFetchOnce([villageOnly])
    ).suggestAddress('q');

    expect(byCity.city).toBe('Город');
    expect(byTown.city).toBe('Пгт');
    expect(byVillage.city).toBe('Село');
  });

  it('returns an empty list when the response is not ok, without trusting the body', async () => {
    // This body WOULD map to a real suggestion if the res.ok guard were
    // ignored — that is what makes this assertion actually pin the guard,
    // mirroring the DaData fix in bb6d11f rather than merely reflecting an
    // empty body.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => [ALEXANDERPLATZ_ROW],
    });
    const provider = new NominatimAddressProvider(fetchMock);

    expect(await provider.suggestAddress('anything')).toEqual([]);
  });

  it('returns an empty list when fetch rejects, so the caller has nothing further to try', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const provider = new NominatimAddressProvider(fetchMock);

    expect(await provider.suggestAddress('anything')).toEqual([]);
  });

  it('returns an empty list for a blank query without calling the network', async () => {
    const fetchMock = vi.fn();
    const provider = new NominatimAddressProvider(fetchMock);

    expect(await provider.suggestAddress('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
