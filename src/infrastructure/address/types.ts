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
