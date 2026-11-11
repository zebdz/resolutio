/** Organization property with validated identity, name and units. Creation and
 * archive time are supplied by the application; persistence is decoded explicitly. */
import { PropertyId, OrganizationId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { PropertyName, PropertyAddress } from './PropertyValues';
import { Result, success, failure } from '../shared/Result';
import {
  OrganizationDomainCode,
  OrganizationDomainCodes,
} from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import {
  SharedDomainCode,
  SharedDomainCodes,
} from '../shared/SharedDomainCodes';
import { SizeUnit, SizeUnitValue } from './SizeUnit';

export interface OrganizationPropertyProps {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  sizeUnit: string;
  createdAt: Date;
  archivedAt: Date | null;
}

type PropertyFailure = OrganizationDomainCode | SharedDomainCode;
interface PropertyState {
  readonly id: PropertyId;
  readonly organizationId: OrganizationId;
  name: PropertyName;
  address: PropertyAddress | null;
  sizeUnit: SizeUnitValue;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
}
export class OrganizationProperty {
  private constructor(private props: PropertyState) {}

  public static create(
    organizationId: OrganizationId,
    name: PropertyName,
    address: PropertyAddress | null,
    sizeUnit: SizeUnitValue,
    creation: EntityCreation<PropertyId>,
    profanityChecker?: ProfanityChecker
  ): Result<OrganizationProperty, PropertyFailure> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }

    const unitParse = SizeUnit.parse(sizeUnit);

    if (!unitParse.success) {
      return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
    }

    const trimmedName = PropertyName.parse(name);
    const trimmedAddress =
      address === null ? null : PropertyAddress.parse(address);

    if (profanityChecker?.containsProfanity(trimmedName)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    if (trimmedAddress && profanityChecker?.containsProfanity(trimmedAddress)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new OrganizationProperty({
        id: PropertyId.parse(creation.id),
        organizationId: OrganizationId.parse(organizationId),
        name: trimmedName,
        address: trimmedAddress,
        sizeUnit: unitParse.value,
        createdAt: Instant.parse(creation.now),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(
    props: OrganizationPropertyProps
  ): OrganizationProperty {
    const sizeUnit = SizeUnit.parse(props.sizeUnit);

    if (!sizeUnit.success) {
      throw new Error(sizeUnit.error);
    }

    return new OrganizationProperty({
      id: PropertyId.parse(props.id),
      organizationId: OrganizationId.parse(props.organizationId),
      name: PropertyName.parse(props.name),
      address:
        props.address === null ? null : PropertyAddress.parse(props.address),
      sizeUnit: sizeUnit.value,
      createdAt: Instant.fromDate(props.createdAt),
      archivedAt:
        props.archivedAt === null ? null : Instant.fromDate(props.archivedAt),
    });
  }

  public get id(): PropertyId {
    return this.props.id;
  }
  public get organizationId(): OrganizationId {
    return this.props.organizationId;
  }
  public get name(): PropertyName {
    return this.props.name;
  }
  public get address(): PropertyAddress | null {
    return this.props.address;
  }
  public get sizeUnit(): SizeUnitValue {
    return this.props.sizeUnit;
  }
  // Defensive Date projections preserve the existing serialization contract.
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public get archivedAt(): Date | null {
    return this.props.archivedAt === null
      ? null
      : Instant.toDate(this.props.archivedAt);
  }
  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public rename(
    newName: PropertyName,
    profanityChecker?: ProfanityChecker
  ): Result<void, PropertyFailure> {
    if (!newName || newName.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }

    const trimmed = PropertyName.parse(newName);

    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.name = trimmed;

    return success(undefined);
  }

  public updateAddress(
    newAddress: PropertyAddress | null,
    profanityChecker?: ProfanityChecker
  ): Result<void, PropertyFailure> {
    const trimmed =
      newAddress === null ? null : PropertyAddress.parse(newAddress);

    if (trimmed && profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.address = trimmed;

    return success(undefined);
  }

  public updateSizeUnit(newUnit: SizeUnitValue): Result<void, PropertyFailure> {
    const parsed = SizeUnit.parse(newUnit);

    if (!parsed.success) {
      return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
    }

    this.props.sizeUnit = parsed.value;

    return success(undefined);
  }

  public archive(at: Instant): Result<void, PropertyFailure> {
    if (this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = Instant.parse(at);

    return success(undefined);
  }

  public unarchive(): Result<void, PropertyFailure> {
    if (!this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_ARCHIVED);
    }

    this.props.archivedAt = null;

    return success(undefined);
  }
}
