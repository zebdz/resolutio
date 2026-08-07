import { describe, it, expect, vi } from 'vitest';
import { AddressProviderResolver } from '../AddressProviderResolver';
import type { AddressSuggestion } from '../types';

const daDataHit: AddressSuggestion = {
  label: 'г Ростов-на-Дону, Гвардейский пер, д 13',
  oneLine: '344011, …, д 13',
  country: 'Россия',
  region: 'Ростовская обл',
  city: 'Ростов-на-Дону',
  street: 'Гвардейский пер',
  building: '13',
  postalCode: '344011',
  houseFiasId: 'house-uuid',
  flat: '',
  houseLabel: 'г Ростов-на-Дону, Гвардейский пер, д 13',
};

const nominatimHit: AddressSuggestion = {
  label: 'Alexanderplatz 1, Berlin',
  oneLine: 'Alexanderplatz 1, Berlin',
  country: 'Германия',
  region: '',
  city: 'Берлин',
  street: 'Alexanderplatz',
  building: '1',
  postalCode: '10178',
  flat: '',
  houseLabel: 'Alexanderplatz 1, Berlin',
};

describe('AddressProviderResolver', () => {
  it('uses DaData results and never calls the fallback', async () => {
    const daData = { suggestAddress: vi.fn().mockResolvedValue([daDataHit]) };
    const nominatim = {
      suggestAddress: vi.fn().mockResolvedValue([nominatimHit]),
    };
    const resolver = new AddressProviderResolver(daData, nominatim);

    const results = await resolver.suggest('Гвардейский 13');

    expect(results).toEqual([daDataHit]);
    expect(nominatim.suggestAddress).not.toHaveBeenCalled();
  });

  it('falls back to Nominatim when DaData returns nothing', async () => {
    // Verified against the live API: "Berlin Alexanderplatz" returns 0 from DaData
    const daData = { suggestAddress: vi.fn().mockResolvedValue([]) };
    const nominatim = {
      suggestAddress: vi.fn().mockResolvedValue([nominatimHit]),
    };
    const resolver = new AddressProviderResolver(daData, nominatim);

    const results = await resolver.suggest('Berlin Alexanderplatz');

    expect(results).toEqual([nominatimHit]);
    expect(nominatim.suggestAddress).toHaveBeenCalledWith(
      'Berlin Alexanderplatz'
    );
  });

  it('returns an empty list when both providers find nothing', async () => {
    const daData = { suggestAddress: vi.fn().mockResolvedValue([]) };
    const nominatim = { suggestAddress: vi.fn().mockResolvedValue([]) };
    const resolver = new AddressProviderResolver(daData, nominatim);

    expect(await resolver.suggest('zzzz')).toEqual([]);
  });
});
