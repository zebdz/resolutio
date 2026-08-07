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

// Block-level (строение/корпус) row — a house row is not the only shape
// suggest/address returns for one query; see design doc "Empirical findings"
const BLOCK_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13 стр 3',
      unrestricted_value:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13 стр 3',
      data: {
        country: 'Россия',
        region_with_type: 'Ростовская обл',
        city: 'Ростов-на-Дону',
        street_with_type: 'Гвардейский пер',
        house: '13',
        block: '3',
        block_type: 'стр',
        postal_code: '344011',
        house_fias_id: 'block-uuid',
        flat: null,
      },
    },
  ],
};

// Flat-level row for the exact building from the reported bug: DaData mixes
// house/block/flat levels in one suggest response, and this is the shape
// that produced the malformed probe query (see design doc "Bug 1").
const FLAT_LEVEL_PICK_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13 стр 3, кв 738',
      unrestricted_value:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13 стр 3, кв 738',
      data: {
        country: 'Россия',
        region_with_type: 'Ростовская обл',
        city: 'Ростов-на-Дону',
        street_with_type: 'Гвардейский пер',
        house: '13',
        block: '3',
        block_type: 'стр',
        postal_code: '344011',
        house_fias_id: 'block-uuid',
        flat: '738',
        flat_type: 'кв',
        flat_fias_id: 'flat-uuid',
      },
    },
  ],
};

// value deliberately does NOT end with ", кв 738" — a stand-in for a DaData
// response whose formatting doesn't match our stripping assumption. houseLabel
// must fall back to the full value rather than truncate the wrong substring.
const MISMATCHED_SUFFIX_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13 стр 3',
      unrestricted_value:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13 стр 3',
      data: {
        house: '13',
        block: '3',
        block_type: 'стр',
        flat: '738',
        flat_type: 'кв',
        flat_fias_id: 'flat-uuid',
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

  it('folds block (строение/корпус) into building, since «Дом / Строение» is one field — a bare `house` mapping would collapse "д 13 стр 3" to "13"', async () => {
    const fetchMock = mockFetchOnce(BLOCK_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress('Гвардейский 13 стр 3');

    expect(suggestion.building).toBe('13 стр 3');
    expect(suggestion.houseLabel).toBe(BLOCK_PAYLOAD.suggestions[0].value);
  });

  it('maps a flat-level pick and derives houseLabel by stripping the flat suffix — regression guard for the reported bug (empty Квартира, «Частный дом» switched on)', async () => {
    const fetchMock = mockFetchOnce(FLAT_LEVEL_PICK_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress(
      'Гвардейский 13 стр 3 кв 738'
    );

    expect(suggestion.flat).toBe('738');
    expect(suggestion.flatFiasId).toBe('flat-uuid');
    expect(suggestion.houseLabel).toBe(
      'г Ростов-на-Дону, Гвардейский пер, д 13 стр 3'
    );
  });

  it('falls back to the full value for houseLabel when it does not end with the expected flat suffix, rather than truncating the wrong substring', async () => {
    const fetchMock = mockFetchOnce(MISMATCHED_SUFFIX_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress('anything');

    expect(suggestion.houseLabel).toBe(
      MISMATCHED_SUFFIX_PAYLOAD.suggestions[0].value
    );
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

  it('logs and returns [] on a 429, without trusting the body', async () => {
    const logQuotaRejected = vi.fn().mockResolvedValue(undefined);
    // Body WOULD map to results if the 429 branch were missing
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => HOUSE_PAYLOAD,
    });
    const provider = new DaDataAddressProvider(fetchMock, {
      logQuotaRejected,
    } as never);

    expect(await provider.suggestAddress('Гвардейский 13')).toEqual([]);
    expect(logQuotaRejected).toHaveBeenCalledWith({
      route: 'suggest',
      statusCode: 429,
    });
  });

  it('does not log a quota rejection for an ordinary non-2xx', async () => {
    const logQuotaRejected = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => HOUSE_PAYLOAD,
    });
    const provider = new DaDataAddressProvider(fetchMock, {
      logQuotaRejected,
    } as never);

    expect(await provider.suggestAddress('Гвардейский 13')).toEqual([]);
    expect(logQuotaRejected).not.toHaveBeenCalled();
  });
});
