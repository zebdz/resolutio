import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { SizeUnit, SizeUnitValue } from './SizeUnit';

export interface OrganizationPropertyProps {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  sizeUnit: SizeUnitValue;
  createdAt: Date;
  archivedAt: Date | null;
}

export class OrganizationProperty {
  private constructor(private props: OrganizationPropertyProps) {}

  public static create(
    organizationId: string,
    name: string,
    address: string | null,
    sizeUnit: string,
    profanityChecker?: ProfanityChecker
  ): Result<OrganizationProperty, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }

    const unitParse = SizeUnit.parse(sizeUnit);

    if (!unitParse.success) {
      return failure(unitParse.error);
    }

    const trimmedName = name.trim();
    const trimmedAddress =
      address && address.trim().length > 0 ? address.trim() : null;

    if (profanityChecker?.containsProfanity(trimmedName)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    if (trimmedAddress && profanityChecker?.containsProfanity(trimmedAddress)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new OrganizationProperty({
        id: '',
        organizationId,
        name: trimmedName,
        address: trimmedAddress,
        sizeUnit: unitParse.value,
        createdAt: new Date(),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(
    props: OrganizationPropertyProps
  ): OrganizationProperty {
    return new OrganizationProperty(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get organizationId(): string {
    return this.props.organizationId;
  }
  public get name(): string {
    return this.props.name;
  }
  public get address(): string | null {
    return this.props.address;
  }
  public get sizeUnit(): SizeUnitValue {
    return this.props.sizeUnit;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }
  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public rename(
    newName: string,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!newName || newName.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }

    const trimmed = newName.trim();

    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.name = trimmed;

    return success(undefined);
  }

  public updateAddress(
    newAddress: string | null,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    const trimmed =
      newAddress && newAddress.trim().length > 0 ? newAddress.trim() : null;

    if (trimmed && profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.address = trimmed;

    return success(undefined);
  }

  public updateSizeUnit(newUnit: string): Result<void, string> {
    const parsed = SizeUnit.parse(newUnit);

    if (!parsed.success) {
      return failure(parsed.error);
    }

    this.props.sizeUnit = parsed.value;

    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = new Date();

    return success(undefined);
  }

  public unarchive(): Result<void, string> {
    if (!this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_ARCHIVED);
    }

    this.props.archivedAt = null;

    return success(undefined);
  }
}
