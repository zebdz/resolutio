/** Ownership history with an explicit user/external-owner alternative. Identity
 * and lifecycle time are supplied by callers; raw persisted rows are validated. */
import { Result, success, failure } from '../shared/Result';
import {
  OrganizationDomainCode,
  OrganizationDomainCodes,
} from './OrganizationDomainCodes';
import { AssetId, OwnershipId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { ExternalOwnerLabel, OwnershipShare } from './PropertyValues';

/** Untrusted persistence DTO; dates and nullable owner columns are decoded below. */
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
export type AssetOwner =
  | { readonly kind: 'user'; readonly userId: UserId }
  | { readonly kind: 'external'; readonly label: ExternalOwnerLabel };
interface OwnershipState {
  readonly id: OwnershipId;
  readonly assetId: AssetId;
  owner: AssetOwner;
  share: OwnershipShare;
  readonly effectiveFrom: Instant;
  effectiveUntil: Instant | null;
  readonly createdAt: Instant;
}

export class PropertyAssetOwnership {
  private constructor(private props: OwnershipState) {
    this.props.owner = Object.freeze({ ...props.owner });
  }

  public static createForUser(
    assetId: AssetId,
    userId: UserId,
    share: OwnershipShare,
    creation: EntityCreation<OwnershipId>
  ): Result<PropertyAssetOwnership, OrganizationDomainCode> {
    const parsed = OwnershipShare.safeParse(share);

    if (!parsed.success) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }

    return success(
      new PropertyAssetOwnership({
        id: OwnershipId.parse(creation.id),
        assetId: AssetId.parse(assetId),
        owner: { kind: 'user', userId: UserId.parse(userId) },
        share: parsed.data,
        effectiveFrom: Instant.parse(creation.now),
        effectiveUntil: null,
        createdAt: Instant.parse(creation.now),
      })
    );
  }

  public static createForExternalOwner(
    assetId: AssetId,
    label: ExternalOwnerLabel,
    share: OwnershipShare,
    creation: EntityCreation<OwnershipId>
  ): Result<PropertyAssetOwnership, OrganizationDomainCode> {
    const parsed = OwnershipShare.safeParse(share);

    if (!parsed.success) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }

    const parsedLabel = ExternalOwnerLabel.safeParse(label);

    if (!parsedLabel.success) {
      return failure(OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY);
    }

    return success(
      new PropertyAssetOwnership({
        id: OwnershipId.parse(creation.id),
        assetId: AssetId.parse(assetId),
        owner: { kind: 'external', label: parsedLabel.data },
        share: parsed.data,
        effectiveFrom: Instant.parse(creation.now),
        effectiveUntil: null,
        createdAt: Instant.parse(creation.now),
      })
    );
  }

  public static reconstitute(
    props: PropertyAssetOwnershipProps
  ): PropertyAssetOwnership {
    if ((props.userId === null) === (props.externalOwnerLabel === null)) {
      throw new Error(OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID);
    }

    const owner: AssetOwner =
      props.userId !== null
        ? { kind: 'user', userId: UserId.parse(props.userId) }
        : {
            kind: 'external',
            label: ExternalOwnerLabel.parse(props.externalOwnerLabel),
          };

    return new PropertyAssetOwnership({
      id: OwnershipId.parse(props.id),
      assetId: AssetId.parse(props.assetId),
      owner,
      share: OwnershipShare.parse(props.share),
      effectiveFrom: Instant.fromDate(props.effectiveFrom),
      effectiveUntil:
        props.effectiveUntil === null
          ? null
          : Instant.fromDate(props.effectiveUntil),
      createdAt: Instant.fromDate(props.createdAt),
    });
  }

  public get id(): OwnershipId {
    return this.props.id;
  }
  public get assetId(): AssetId {
    return this.props.assetId;
  }
  public get owner(): AssetOwner {
    return this.props.owner;
  }
  public get userId(): UserId | null {
    return this.props.owner.kind === 'user' ? this.props.owner.userId : null;
  }
  public get externalOwnerLabel(): ExternalOwnerLabel | null {
    return this.props.owner.kind === 'external' ? this.props.owner.label : null;
  }
  public get share(): OwnershipShare {
    return this.props.share;
  }
  // Date getters are detached projections for existing serialization callers.
  public get effectiveFrom(): Date {
    return Instant.toDate(this.props.effectiveFrom);
  }
  public get effectiveUntil(): Date | null {
    return this.props.effectiveUntil === null
      ? null
      : Instant.toDate(this.props.effectiveUntil);
  }
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public isActive(): boolean {
    return this.props.effectiveUntil === null;
  }

  public endEffect(at: Instant): void {
    if (this.props.effectiveUntil === null) {
      this.props.effectiveUntil = Instant.parse(at);
    }
  }

  public link(userId: UserId): Result<void, OrganizationDomainCode> {
    if (!this.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }

    if (this.props.owner.kind === 'user') {
      return failure(OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID);
    }

    this.props.owner = Object.freeze({
      kind: 'user',
      userId: UserId.parse(userId),
    });

    return success(undefined);
  }

  public correct(
    newShare: OwnershipShare
  ): Result<void, OrganizationDomainCode> {
    if (!this.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }

    const parsed = OwnershipShare.safeParse(newShare);

    if (!parsed.success) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }

    this.props.share = parsed.data;

    return success(undefined);
  }
}
