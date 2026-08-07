import type { AddressProvider, AddressSuggestion } from './types';

/**
 * Provider selection is result-driven, not country-driven: we cannot know the
 * country before the user has typed. DaData covers Russia down to the flat and
 * BY/KZ/UZ down to the house, but only to city level elsewhere — and a street
 * token makes those city-only queries return nothing at all. So an empty DaData
 * response is exactly the signal to try Nominatim.
 */
export class AddressProviderResolver {
  constructor(
    private readonly daData: AddressProvider,
    private readonly nominatim: AddressProvider
  ) {}

  async suggest(query: string): Promise<AddressSuggestion[]> {
    const primary = await this.daData.suggestAddress(query);

    if (primary.length > 0) {
      return primary;
    }

    return this.nominatim.suggestAddress(query);
  }
}
