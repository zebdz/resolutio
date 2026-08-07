export interface AddressSuggestion {
  label: string; // display string
  oneLine: string; // durable anchor (DaData unrestricted_value)
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  postalCode: string;
  houseFiasId?: string; // present only for DaData house-level hits
  /** Flat number when the suggestion is flat-level; '' otherwise. */
  flat: string;
  /** ГАР id of the flat, when the suggestion is flat-level. */
  flatFiasId?: string;
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
  flatFiasId?: string;
}

export interface AddressProvider {
  suggestAddress(query: string): Promise<AddressSuggestion[]>;
}
