/** Validated address value with explicit private-house/apartment alternatives.
 * Raw form/storage records are decoded once; only detached plain records leave the value. */
import { z } from 'zod';
import {
  CountryName,
  RegionName,
  CityName,
  StreetName,
  BuildingNumber,
  ApartmentNumber,
  PostalCode,
  AddressLine,
  HouseFiasId,
  FlatFiasId,
} from './AddressValues';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';

export const AddressDomainCodes = {
  COUNTRY_REQUIRED: 'domain.user.address.countryRequired',
  CITY_REQUIRED: 'domain.user.address.cityRequired',
  STREET_REQUIRED: 'domain.user.address.streetRequired',
  BUILDING_REQUIRED: 'domain.user.address.buildingRequired',
  APARTMENT_REQUIRED: 'domain.user.address.apartmentRequired',
  REGISTRY_ID_INVALID: 'domain.user.address.registryIdInvalid',
} as const;

export type AddressDomainCode =
  (typeof AddressDomainCodes)[keyof typeof AddressDomainCodes];

/** Raw form/persistence DTO; accepted only through the validated factory. */
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

interface AddressState {
  readonly country: CountryName;
  readonly region?: RegionName;
  readonly city: CityName;
  readonly street: StreetName;
  readonly building: BuildingNumber;
  readonly postalCode?: PostalCode;
  readonly oneLine?: AddressLine;
  readonly houseFiasId?: HouseFiasId;
  readonly residence:
    | { readonly kind: 'private-house' }
    | {
        readonly kind: 'apartment';
        readonly apartment: ApartmentNumber;
        readonly flatFiasId?: FlatFiasId;
      };
}

export class Address {
  private constructor(private readonly props: AddressState) {
    Object.freeze(props.residence);
    Object.freeze(props);
  }

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

    const isPrivateHouse = z
      .boolean({ error: 'common.errors.validationFailed' })
      .default(false)
      .parse(props.isPrivateHouse);

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

    const houseFiasId = HouseFiasId.optional().safeParse(
      props.houseFiasId?.trim() ? props.houseFiasId : undefined
    );
    // Private houses discard any stale flat provenance from a previous selection.
    const flatFiasId = FlatFiasId.optional().safeParse(
      !isPrivateHouse && props.flatFiasId?.trim() ? props.flatFiasId : undefined
    );

    if (!houseFiasId.success || !flatFiasId.success) {
      throw new Error(AddressDomainCodes.REGISTRY_ID_INVALID);
    }

    return new Address({
      country: CountryName.parse(props.country),
      region: props.region?.trim() ? RegionName.parse(props.region) : undefined,
      city: CityName.parse(props.city),
      street: StreetName.parse(props.street),
      building: BuildingNumber.parse(props.building),
      postalCode: props.postalCode?.trim()
        ? PostalCode.parse(props.postalCode)
        : undefined,
      oneLine: props.oneLine?.trim()
        ? AddressLine.parse(props.oneLine)
        : undefined,
      houseFiasId: houseFiasId.data,
      // A private house has no flat — never persist a contradictory pair.
      residence: isPrivateHouse
        ? { kind: 'private-house' }
        : {
            kind: 'apartment',
            apartment: ApartmentNumber.parse(props.apartment),
            flatFiasId: flatFiasId.data,
          },
    });
  }

  get country(): CountryName {
    return this.props.country;
  }
  get region(): RegionName | undefined {
    return this.props.region;
  }
  get city(): CityName {
    return this.props.city;
  }
  get street(): StreetName {
    return this.props.street;
  }
  get building(): BuildingNumber {
    return this.props.building;
  }
  get apartment(): ApartmentNumber | undefined {
    return this.props.residence.kind === 'apartment'
      ? this.props.residence.apartment
      : undefined;
  }
  get postalCode(): PostalCode | undefined {
    return this.props.postalCode;
  }
  get isPrivateHouse(): boolean {
    return this.props.residence.kind === 'private-house';
  }
  get oneLine(): AddressLine | undefined {
    return this.props.oneLine;
  }
  get houseFiasId(): HouseFiasId | undefined {
    return this.props.houseFiasId;
  }
  get flatFiasId(): FlatFiasId | undefined {
    return this.props.residence.kind === 'apartment'
      ? this.props.residence.flatFiasId
      : undefined;
  }

  equals(other: Address): boolean {
    return (
      this.props.country === other.props.country &&
      this.props.region === other.props.region &&
      this.props.city === other.props.city &&
      this.props.street === other.props.street &&
      this.props.building === other.props.building &&
      this.apartment === other.apartment &&
      this.props.postalCode === other.props.postalCode &&
      this.isPrivateHouse === other.isPrivateHouse &&
      this.props.oneLine === other.props.oneLine &&
      this.props.houseFiasId === other.props.houseFiasId &&
      this.flatFiasId === other.flatFiasId
    );
  }

  toPlain(): AddressProps {
    return {
      country: this.country,
      region: this.region,
      city: this.city,
      street: this.street,
      building: this.building,
      apartment: this.apartment,
      postalCode: this.postalCode,
      isPrivateHouse: this.isPrivateHouse,
      oneLine: this.oneLine,
      houseFiasId: this.houseFiasId,
      flatFiasId: this.flatFiasId,
    };
  }
}
