/** Property asset aggregate with caller-supplied identity and time. Rehydration
 * validates raw persisted data; Date getters are defensive compatibility projections. */
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
import { AssetId, PropertyId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { AssetName, AssetSize } from './PropertyValues';

/** Untrusted persistence DTO; reconstitute is its validation boundary. */
export interface PropertyAssetProps {
  id: string;
  propertyId: string;
  name: string;
  size: number;
  createdAt: Date;
  archivedAt: Date | null;
}
interface AssetState {
  readonly id: AssetId;
  readonly propertyId: PropertyId;
  name: AssetName;
  size: AssetSize;
  readonly createdAt: Instant;
  archivedAt: Instant | null;
}
type AssetFailure = OrganizationDomainCode | SharedDomainCode;

export class PropertyAsset {
  private constructor(private props: AssetState) {}

  public static create(
    propertyId: PropertyId,
    name: AssetName,
    size: AssetSize,
    creation: EntityCreation<AssetId>,
    profanityChecker?: ProfanityChecker
  ): Result<PropertyAsset, AssetFailure> {
    const parsedName = AssetName.safeParse(name);

    if (!parsedName.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }

    const parsedSize = AssetSize.safeParse(size);

    if (!parsedSize.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }

    if (profanityChecker?.containsProfanity(parsedName.data)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new PropertyAsset({
        id: AssetId.parse(creation.id),
        propertyId: PropertyId.parse(propertyId),
        name: parsedName.data,
        size: parsedSize.data,
        createdAt: Instant.parse(creation.now),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(props: PropertyAssetProps): PropertyAsset {
    return new PropertyAsset({
      id: AssetId.parse(props.id),
      propertyId: PropertyId.parse(props.propertyId),
      name: AssetName.parse(props.name),
      size: AssetSize.parse(props.size),
      createdAt: Instant.fromDate(props.createdAt),
      archivedAt:
        props.archivedAt === null ? null : Instant.fromDate(props.archivedAt),
    });
  }

  public get id(): AssetId {
    return this.props.id;
  }
  public get propertyId(): PropertyId {
    return this.props.propertyId;
  }
  public get name(): AssetName {
    return this.props.name;
  }
  public get size(): AssetSize {
    return this.props.size;
  }
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
    newName: AssetName,
    profanityChecker?: ProfanityChecker
  ): Result<void, AssetFailure> {
    const parsed = AssetName.safeParse(newName);

    if (!parsed.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }

    if (profanityChecker?.containsProfanity(parsed.data)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.name = parsed.data;

    return success(undefined);
  }

  public resize(newSize: AssetSize): Result<void, OrganizationDomainCode> {
    const parsed = AssetSize.safeParse(newSize);

    if (!parsed.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }

    this.props.size = parsed.data;

    return success(undefined);
  }

  public archive(at: Instant): Result<void, OrganizationDomainCode> {
    if (this.props.archivedAt !== null) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED);
    }

    this.props.archivedAt = Instant.parse(at);

    return success(undefined);
  }

  public unarchive(): Result<void, OrganizationDomainCode> {
    if (this.props.archivedAt === null) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_ARCHIVED);
    }

    this.props.archivedAt = null;

    return success(undefined);
  }
}
