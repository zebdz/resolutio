/** Plain address-suggestion projections preserve validated provider registry references.
 * Partial suggestion text remains raw until the user submits a complete domain address. */
import type { HouseFiasId, FlatFiasId } from '@/domain/user/AddressValues';

export interface AddressSuggestion {
  label: string; // display string
  oneLine: string; // durable anchor (DaData unrestricted_value)
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  postalCode: string;
  houseFiasId?: HouseFiasId; // present only for DaData house-level hits
  /** Flat number when the suggestion is flat-level; '' otherwise. */
  flat: string;
  /** ГАР id of the flat, when the suggestion is flat-level. */
  flatFiasId?: FlatFiasId;
  /**
   * The suggestion's label with any flat portion removed. This — never
   * `label` — is what flat lookups must be built from: appending " кв N" to a
   * label that already ends in ", кв 738" produces a query DaData cannot
   * answer, which reads as "this building has no flats".
   */
  houseLabel: string;
}

export interface FlatSuggestion {
  label: string;
  flat: string;
  oneLine: string;
  flatFiasId?: FlatFiasId;
}

export interface AddressProvider {
  suggestAddress(query: string): Promise<AddressSuggestion[]>;
}
