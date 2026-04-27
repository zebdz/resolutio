import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export type PropertyClaimStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface PropertyClaimProps {
  id: string;
  organizationId: string;
  userId: string;
  assetId: string;
  status: PropertyClaimStatus;
  deniedReason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export class PropertyClaim {
  private constructor(private props: PropertyClaimProps) {}

  public static submit(
    organizationId: string,
    userId: string,
    assetId: string
  ): Result<PropertyClaim, string> {
    return success(
      new PropertyClaim({
        id: '',
        organizationId,
        userId,
        assetId,
        status: 'PENDING',
        deniedReason: null,
        decidedBy: null,
        decidedAt: null,
        createdAt: new Date(),
      })
    );
  }

  public static reconstitute(props: PropertyClaimProps): PropertyClaim {
    return new PropertyClaim(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get organizationId(): string {
    return this.props.organizationId;
  }
  public get userId(): string {
    return this.props.userId;
  }
  public get assetId(): string {
    return this.props.assetId;
  }
  public get status(): PropertyClaimStatus {
    return this.props.status;
  }
  public get deniedReason(): string | null {
    return this.props.deniedReason;
  }
  public get decidedBy(): string | null {
    return this.props.decidedBy;
  }
  public get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public isPending(): boolean {
    return this.props.status === 'PENDING';
  }

  public approve(adminUserId: string, at: Date): Result<void, string> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }

    this.props.status = 'APPROVED';
    this.props.decidedBy = adminUserId;
    this.props.decidedAt = at;

    return success(undefined);
  }

  public deny(
    adminUserId: string,
    reason: string,
    at: Date,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }

    const trimmed = (reason ?? '').trim();

    if (trimmed.length === 0) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }

    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.status = 'DENIED';
    this.props.deniedReason = trimmed;
    this.props.decidedBy = adminUserId;
    this.props.decidedAt = at;

    return success(undefined);
  }

  public autoDeny(reason: string, at: Date): Result<void, string> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }

    this.props.status = 'DENIED';
    this.props.deniedReason = reason;
    this.props.decidedBy = null;
    this.props.decidedAt = at;

    return success(undefined);
  }
}
