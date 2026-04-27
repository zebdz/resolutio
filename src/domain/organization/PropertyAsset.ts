import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export interface PropertyAssetProps {
  id: string;
  propertyId: string;
  name: string;
  size: number;
  createdAt: Date;
  archivedAt: Date | null;
}

export class PropertyAsset {
  private constructor(private props: PropertyAssetProps) {}

  public static create(
    propertyId: string,
    name: string,
    size: number,
    profanityChecker?: ProfanityChecker
  ): Result<PropertyAsset, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }

    if (!(size > 0)) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }

    const trimmed = name.trim();

    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new PropertyAsset({
        id: '',
        propertyId,
        name: trimmed,
        size,
        createdAt: new Date(),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(props: PropertyAssetProps): PropertyAsset {
    return new PropertyAsset(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get propertyId(): string {
    return this.props.propertyId;
  }
  public get name(): string {
    return this.props.name;
  }
  public get size(): number {
    return this.props.size;
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
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }

    const trimmed = newName.trim();

    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.name = trimmed;

    return success(undefined);
  }

  public resize(newSize: number): Result<void, string> {
    if (!(newSize > 0)) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }

    this.props.size = newSize;

    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = new Date();

    return success(undefined);
  }

  public unarchive(): Result<void, string> {
    if (!this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_ARCHIVED);
    }

    this.props.archivedAt = null;

    return success(undefined);
  }
}
