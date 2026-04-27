import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

export interface PropertyAssetOwnershipProps {
  id: string;
  assetId: string;
  userId: string | null;
  externalOwnerLabel: string | null;
  share: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  createdAt: Date;
}

export class PropertyAssetOwnership {
  private constructor(private props: PropertyAssetOwnershipProps) {}

  public static createForUser(
    assetId: string,
    userId: string,
    share: number
  ): Result<PropertyAssetOwnership, string> {
    if (share < 0 || share > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }

    return success(
      new PropertyAssetOwnership({
        id: '',
        assetId,
        userId,
        externalOwnerLabel: null,
        share,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        createdAt: new Date(),
      })
    );
  }

  public static createForExternalOwner(
    assetId: string,
    label: string,
    share: number
  ): Result<PropertyAssetOwnership, string> {
    if (share < 0 || share > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }

    const trimmed = (label ?? '').trim();

    if (trimmed.length === 0) {
      return failure(OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY);
    }

    return success(
      new PropertyAssetOwnership({
        id: '',
        assetId,
        userId: null,
        externalOwnerLabel: trimmed,
        share,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        createdAt: new Date(),
      })
    );
  }

  public static reconstitute(
    props: PropertyAssetOwnershipProps
  ): PropertyAssetOwnership {
    return new PropertyAssetOwnership(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get assetId(): string {
    return this.props.assetId;
  }
  public get userId(): string | null {
    return this.props.userId;
  }
  public get externalOwnerLabel(): string | null {
    return this.props.externalOwnerLabel;
  }
  public get share(): number {
    return this.props.share;
  }
  public get effectiveFrom(): Date {
    return this.props.effectiveFrom;
  }
  public get effectiveUntil(): Date | null {
    return this.props.effectiveUntil;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public isActive(): boolean {
    return this.props.effectiveUntil === null;
  }

  public endEffect(at: Date): void {
    if (!this.props.effectiveUntil) {
      this.props.effectiveUntil = at;
    }
  }

  public link(userId: string): Result<void, string> {
    if (!this.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }

    if (this.props.userId !== null) {
      return failure(OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID);
    }

    this.props.userId = userId;
    this.props.externalOwnerLabel = null;

    return success(undefined);
  }

  public correct(newShare: number): Result<void, string> {
    if (!this.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }

    if (newShare < 0 || newShare > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }

    this.props.share = newShare;

    return success(undefined);
  }
}
