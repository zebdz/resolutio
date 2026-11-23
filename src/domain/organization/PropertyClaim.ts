/** Ownership claim lifecycle. Each decision carries its required actor, time and
 * reason; raw persistence rows are decoded before they enter the domain. */
import { z } from 'zod';
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
import {
  AssetId,
  OrganizationId,
  PropertyClaimId,
  UserId,
} from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import { ClaimDenialReason } from './PropertyValues';

export type PropertyClaimDecision =
  | { readonly status: 'PENDING' }
  | { readonly status: 'APPROVED'; readonly by: UserId; readonly at: Instant }
  | {
      readonly status: 'DENIED';
      readonly reason: ClaimDenialReason;
      readonly at: Instant;
      readonly actor:
        | { readonly kind: 'admin'; readonly userId: UserId }
        | { readonly kind: 'system' };
    };
export type PropertyClaimStatus = PropertyClaimDecision['status'];

/** Raw ORM columns, including nullable legacy decision columns. */
export interface PropertyClaimProps {
  id: string;
  organizationId: string;
  userId: string;
  assetId: string;
  status: string;
  deniedReason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}
const persistedDecision = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('PENDING'),
    deniedReason: z.null(),
    decidedBy: z.null(),
    decidedAt: z.null(),
  }),
  z.object({
    status: z.literal('APPROVED'),
    deniedReason: z.null(),
    decidedBy: UserId,
    decidedAt: z.date(),
  }),
  z.object({
    status: z.literal('DENIED'),
    deniedReason: ClaimDenialReason,
    decidedBy: UserId.nullable(),
    decidedAt: z.date(),
  }),
]);
interface ClaimState {
  readonly id: PropertyClaimId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly assetId: AssetId;
  readonly createdAt: Instant;
  decision: PropertyClaimDecision;
}
type ClaimFailure = OrganizationDomainCode | SharedDomainCode;

export class PropertyClaim {
  private constructor(private props: ClaimState) {
    this.props.decision = Object.freeze(props.decision);
  }

  public static submit(
    organizationId: OrganizationId,
    userId: UserId,
    assetId: AssetId,
    creation: EntityCreation<PropertyClaimId>
  ): Result<PropertyClaim, ClaimFailure> {
    return success(
      new PropertyClaim({
        id: PropertyClaimId.parse(creation.id),
        organizationId: OrganizationId.parse(organizationId),
        userId: UserId.parse(userId),
        assetId: AssetId.parse(assetId),
        createdAt: Instant.parse(creation.now),
        decision: { status: 'PENDING' },
      })
    );
  }

  public static reconstitute(props: PropertyClaimProps): PropertyClaim {
    const raw = persistedDecision.parse(props);
    let decision: PropertyClaimDecision;

    switch (raw.status) {
      case 'PENDING':
        decision = { status: 'PENDING' };
        break;
      case 'APPROVED':
        decision = {
          status: 'APPROVED',
          by: raw.decidedBy,
          at: Instant.fromDate(raw.decidedAt),
        };
        break;
      case 'DENIED':
        decision = {
          status: 'DENIED',
          reason: raw.deniedReason,
          at: Instant.fromDate(raw.decidedAt),
          actor: Object.freeze(
            raw.decidedBy === null
              ? { kind: 'system' }
              : { kind: 'admin', userId: raw.decidedBy }
          ),
        };
        break;
    }

    return new PropertyClaim({
      id: PropertyClaimId.parse(props.id),
      organizationId: OrganizationId.parse(props.organizationId),
      userId: UserId.parse(props.userId),
      assetId: AssetId.parse(props.assetId),
      createdAt: Instant.fromDate(props.createdAt),
      decision,
    });
  }

  public get id(): PropertyClaimId {
    return this.props.id;
  }
  public get organizationId(): OrganizationId {
    return this.props.organizationId;
  }
  public get userId(): UserId {
    return this.props.userId;
  }
  public get assetId(): AssetId {
    return this.props.assetId;
  }
  public get decision(): PropertyClaimDecision {
    return this.props.decision;
  }
  public get status(): PropertyClaimStatus {
    return this.props.decision.status;
  }
  public get deniedReason(): ClaimDenialReason | null {
    return this.props.decision.status === 'DENIED'
      ? this.props.decision.reason
      : null;
  }
  public get decidedBy(): UserId | null {
    const decision = this.props.decision;

    if (decision.status === 'APPROVED') {
      return decision.by;
    }

    if (decision.status === 'DENIED' && decision.actor.kind === 'admin') {
      return decision.actor.userId;
    }

    return null;
  }
  // Defensive Date projections retain the presentation/storage wire contract.
  public get decidedAt(): Date | null {
    return this.props.decision.status === 'PENDING'
      ? null
      : Instant.toDate(this.props.decision.at);
  }
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public isPending(): boolean {
    return this.props.decision.status === 'PENDING';
  }

  public approve(adminUserId: UserId, at: Instant): Result<void, ClaimFailure> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }

    this.props.decision = Object.freeze({
      status: 'APPROVED',
      by: UserId.parse(adminUserId),
      at: Instant.parse(at),
    });

    return success(undefined);
  }

  public deny(
    adminUserId: UserId,
    reason: ClaimDenialReason,
    at: Instant,
    profanityChecker?: ProfanityChecker
  ): Result<void, ClaimFailure> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }

    const parsed = ClaimDenialReason.safeParse(reason);

    if (!parsed.success) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }

    if (profanityChecker?.containsProfanity(parsed.data)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    this.props.decision = Object.freeze({
      status: 'DENIED',
      reason: parsed.data,
      at: Instant.parse(at),
      actor: Object.freeze({
        kind: 'admin',
        userId: UserId.parse(adminUserId),
      }),
    });

    return success(undefined);
  }

  public autoDeny(
    reason: ClaimDenialReason,
    at: Instant
  ): Result<void, ClaimFailure> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }

    const parsed = ClaimDenialReason.safeParse(reason);

    if (!parsed.success) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }

    this.props.decision = Object.freeze({
      status: 'DENIED',
      reason: parsed.data,
      at: Instant.parse(at),
      actor: Object.freeze({ kind: 'system' }),
    });

    return success(undefined);
  }
}
