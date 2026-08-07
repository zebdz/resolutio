import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';

export const AddressDomainCodes = {
  COUNTRY_REQUIRED: 'domain.user.address.countryRequired',
  CITY_REQUIRED: 'domain.user.address.cityRequired',
  STREET_REQUIRED: 'domain.user.address.streetRequired',
  BUILDING_REQUIRED: 'domain.user.address.buildingRequired',
  APARTMENT_REQUIRED: 'domain.user.address.apartmentRequired',
} as const;

export type AddressDomainCode =
  (typeof AddressDomainCodes)[keyof typeof AddressDomainCodes];

export interface AddressProps {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
  isPrivateHouse?: boolean;
  oneLine?: string;
  houseFiasId?: string;
  flatFiasId?: string;
}

export class Address {
  private constructor(private readonly props: AddressProps) {}

  static create(
    props: AddressProps,
    profanityChecker?: ProfanityChecker
  ): Address {
    if (!props.country?.trim()) {
      throw new Error(AddressDomainCodes.COUNTRY_REQUIRED);
    }

    if (!props.city?.trim()) {
      throw new Error(AddressDomainCodes.CITY_REQUIRED);
    }

    if (!props.street?.trim()) {
      throw new Error(AddressDomainCodes.STREET_REQUIRED);
    }

    if (!props.building?.trim()) {
      throw new Error(AddressDomainCodes.BUILDING_REQUIRED);
    }

    const isPrivateHouse = props.isPrivateHouse ?? false;

    if (!isPrivateHouse && !props.apartment?.trim()) {
      throw new Error(AddressDomainCodes.APARTMENT_REQUIRED);
    }

    const textFields = [
      props.country,
      props.region,
      props.city,
      props.street,
      props.building,
      props.apartment,
    ];

    for (const field of textFields) {
      if (field && profanityChecker?.containsProfanity(field)) {
        throw new Error(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    }

    return new Address({
      country: props.country.trim(),
      region: props.region?.trim() || undefined,
      city: props.city.trim(),
      street: props.street.trim(),
      building: props.building.trim(),
      // A private house has no flat — never persist a contradictory pair
      apartment: isPrivateHouse
        ? undefined
        : props.apartment?.trim() || undefined,
      postalCode: props.postalCode?.trim() || undefined,
      isPrivateHouse,
      oneLine: props.oneLine?.trim() || undefined,
      houseFiasId: props.houseFiasId?.trim() || undefined,
      // A private house has no flat — never persist a contradictory pair
      flatFiasId: isPrivateHouse
        ? undefined
        : props.flatFiasId?.trim() || undefined,
    });
  }

  get country(): string {
    return this.props.country;
  }

  get region(): string | undefined {
    return this.props.region;
  }

  get city(): string {
    return this.props.city;
  }

  get street(): string {
    return this.props.street;
  }

  get building(): string {
    return this.props.building;
  }

  get apartment(): string | undefined {
    return this.props.apartment;
  }

  get postalCode(): string | undefined {
    return this.props.postalCode;
  }

  get isPrivateHouse(): boolean {
    return this.props.isPrivateHouse ?? false;
  }

  get oneLine(): string | undefined {
    return this.props.oneLine;
  }

  get houseFiasId(): string | undefined {
    return this.props.houseFiasId;
  }

  get flatFiasId(): string | undefined {
    return this.props.flatFiasId;
  }

  equals(other: Address): boolean {
    return (
      this.props.country === other.props.country &&
      this.props.region === other.props.region &&
      this.props.city === other.props.city &&
      this.props.street === other.props.street &&
      this.props.building === other.props.building &&
      this.props.apartment === other.props.apartment &&
      this.props.postalCode === other.props.postalCode &&
      this.props.isPrivateHouse === other.props.isPrivateHouse &&
      this.props.oneLine === other.props.oneLine &&
      this.props.houseFiasId === other.props.houseFiasId &&
      this.props.flatFiasId === other.props.flatFiasId
    );
  }

  toPlain(): AddressProps {
    return { ...this.props };
  }
}
