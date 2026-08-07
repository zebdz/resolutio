import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DaDataAddressProvider } from '../DaDataAddressProvider';

// Real payload shape, trimmed to the fields we map
const HOUSE_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13',
      unrestricted_value:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13',
      data: {
        country: 'Россия',
        region_with_type: 'Ростовская обл',
        city: 'Ростов-на-Дону',
        street_with_type: 'Гвардейский пер',
        house: '13',
        postal_code: '344011',
        house_fias_id: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        flat: null,
      },
    },
  ],
};

// DaData returns the house row alongside flats — to_bound does NOT filter it out
const FLAT_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13',
      unrestricted_value: '344011, …, д 13',
      data: { flat: null, flat_fias_id: null },
    },
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13, кв 2',
      unrestricted_value: '344011, …, д 13, кв 2',
      data: { flat: '2', flat_type: 'кв', flat_fias_id: 'flat-uuid-2' },
    },
  ],
};

function mockFetchOnce(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

describe('DaDataAddressProvider', () => {
  beforeEach(() => {
    process.env.DADATA_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Some tests delete DADATA_API_KEY; restore it so later tests can't
    // inherit a missing key regardless of execution order.
    process.env.DADATA_API_KEY = 'test-key';
  });

  it('maps a house suggestion onto AddressSuggestion', async () => {
    const fetchMock = mockFetchOnce(HOUSE_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress('Гвардейский 13');

    expect(suggestion.region).toBe('Ростовская обл');
    expect(suggestion.city).toBe('Ростов-на-Дону');
    expect(suggestion.street).toBe('Гвардейский пер');
    expect(suggestion.building).toBe('13');
    expect(suggestion.postalCode).toBe('344011');
    expect(suggestion.houseFiasId).toBe('c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5');
    expect(suggestion.oneLine).toContain('344011');
  });

  it('always requests Russian and enables foreign countries', async () => {
    const fetchMock = mockFetchOnce(HOUSE_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    await provider.suggestAddress('Гвардейский 13');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.language).toBe('ru');
    expect(body.locations).toEqual([{ country: '*' }]);
  });

  it('never sends the token in a way the browser could see — token is a header', async () => {
    const fetchMock = mockFetchOnce(HOUSE_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    await provider.suggestAddress('Гвардейский 13');

    const headers = fetchMock.mock.calls[0][1].headers;

    expect(headers.Authorization).toBe('Token test-key');
  });

  it('filters out non-flat rows, because to_bound does not', async () => {
    const fetchMock = mockFetchOnce(FLAT_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const flats = await provider.suggestFlats(
      'г Ростов-на-Дону, Гвардейский пер, д 13',
      '2'
    );

    expect(flats).toHaveLength(1);
    expect(flats[0].flat).toBe('2');
    expect(flats[0].flatFiasId).toBe('flat-uuid-2');
  });

  it('builds the flat query by appending the fragment to the house label', async () => {
    const fetchMock = mockFetchOnce(FLAT_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    await provider.suggestFlats('г Ростов-на-Дону, Гвардейский пер, д 13', '2');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.query).toBe('г Ростов-на-Дону, Гвардейский пер, д 13 кв 2');
  });

  it('returns no flats when only non-flat rows come back', async () => {
    const provider = new DaDataAddressProvider(mockFetchOnce(HOUSE_PAYLOAD));

    const flats = await provider.suggestFlats(
      'г Ростов-на-Дону, Гвардейский пер, д 13',
      ''
    );

    expect(flats).toEqual([]);
  });

  it('returns an empty list when DaData errors, so the caller can fall back', async () => {
    // The body below would map onto a real suggestion if the res.ok guard were
    // ignored — that's what makes this assertion actually pin the guard,
    // instead of merely reflecting an empty `suggestions` key.
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => HOUSE_PAYLOAD });
    const provider = new DaDataAddressProvider(fetchMock);

    expect(await provider.suggestAddress('anything')).toEqual([]);
  });

  it('throws when DADATA_API_KEY is not configured, so misconfiguration is loud', async () => {
    delete process.env.DADATA_API_KEY;
    const provider = new DaDataAddressProvider(mockFetchOnce(HOUSE_PAYLOAD));

    await expect(provider.suggestAddress('Гвардейский 13')).rejects.toThrow(
      'DADATA_API_KEY is not configured'
    );
  });
});
