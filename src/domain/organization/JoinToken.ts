/** Join-link aggregate keeps token text, usage units and lifecycle dates validated.
 * Identity, entropy and time enter explicitly; raw DTOs are decoded on rehydration. */
import { Result, success, failure } from '../shared/Result';
import {
  JoinTokenDomainCode,
  JoinTokenDomainCodes,
} from './JoinTokenDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import {
  SharedDomainCode,
  SharedDomainCodes,
} from '../shared/SharedDomainCodes';
import { JoinTokenId, OrganizationId, UserId } from '../shared/EntityIds';
import { EntityCreation } from '../shared/EntityCreation';
import { Instant } from '../shared/Instant';
import {
  JoinTokenValue,
  JoinTokenDescription,
  JoinTokenMaxUses,
  JoinTokenUseCount,
  parseJoinTokenDescription,
} from './JoinTokenValues';
export { JOIN_TOKEN_DESCRIPTION_MAX_LENGTH } from './JoinTokenValues';

/** Raw persistence and browser serialization representation. */
export interface JoinTokenProps {
  id: string;
  organizationId: string;
  token: string;
  description: string;
  maxUses: number | null;
  useCount: number;
  createdById: string;
  createdAt: Date;
  expiredAt: Date | null;
}

export interface CreateJoinTokenProps {
  readonly organizationId: OrganizationId;
  readonly createdById: UserId;
  readonly token: JoinTokenValue;
  readonly description: JoinTokenDescription;
  readonly maxUses: JoinTokenMaxUses | null;
}
interface JoinTokenState extends CreateJoinTokenProps {
  readonly id: JoinTokenId;
  readonly createdAt: Instant;
  useCount: JoinTokenUseCount;
  maxUses: JoinTokenMaxUses | null;
  expiredAt: Instant | null;
}
type JoinTokenFailure = JoinTokenDomainCode | SharedDomainCode;
export class JoinToken {
  private constructor(private props: JoinTokenState) {}

  public static create(
    props: CreateJoinTokenProps,
    creation: EntityCreation<JoinTokenId>,
    profanityChecker?: ProfanityChecker
  ): Result<JoinToken, JoinTokenFailure> {
    const description = parseJoinTokenDescription(props.description);

    if (!description.success) {
      return description;
    }

    if (profanityChecker?.containsProfanity(description.value)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const maxUses = JoinTokenMaxUses.nullable().safeParse(props.maxUses);

    if (!maxUses.success) {
      return failure(JoinTokenDomainCodes.MAX_USES_INVALID);
    }

    return success(
      new JoinToken({
        id: JoinTokenId.parse(creation.id),
        organizationId: OrganizationId.parse(props.organizationId),
        createdById: UserId.parse(props.createdById),
        token: JoinTokenValue.parse(props.token),
        description: description.value,
        maxUses: maxUses.data,
        useCount: JoinTokenUseCount.parse(0),
        createdAt: Instant.parse(creation.now),
        expiredAt: null,
      })
    );
  }
  public static reconstitute(props: JoinTokenProps): JoinToken {
    return new JoinToken({
      id: JoinTokenId.parse(props.id),
      organizationId: OrganizationId.parse(props.organizationId),
      createdById: UserId.parse(props.createdById),
      token: JoinTokenValue.parse(props.token),
      description: JoinTokenDescription.parse(props.description),
      maxUses: JoinTokenMaxUses.nullable().parse(props.maxUses),
      useCount: JoinTokenUseCount.parse(props.useCount),
      createdAt: Instant.fromDate(props.createdAt),
      expiredAt:
        props.expiredAt === null ? null : Instant.fromDate(props.expiredAt),
    });
  }
  public get id(): JoinTokenId {
    return this.props.id;
  }
  public get organizationId(): OrganizationId {
    return this.props.organizationId;
  }
  public get token(): JoinTokenValue {
    return this.props.token;
  }
  public get description(): JoinTokenDescription {
    return this.props.description;
  }
  public get maxUses(): JoinTokenMaxUses | null {
    return this.props.maxUses;
  }
  public get useCount(): JoinTokenUseCount {
    return this.props.useCount;
  }
  public get createdById(): UserId {
    return this.props.createdById;
  }
  // Detached Date projections preserve the public serialization contract.
  public get createdAt(): Date {
    return Instant.toDate(this.props.createdAt);
  }
  public get expiredAt(): Date | null {
    return this.props.expiredAt === null
      ? null
      : Instant.toDate(this.props.expiredAt);
  }

  public expire(at: Instant): Result<void, JoinTokenDomainCode> {
    if (this.props.expiredAt !== null) {
      return failure(JoinTokenDomainCodes.ALREADY_EXPIRED);
    }

    this.props.expiredAt = Instant.parse(at);

    return success(undefined);
  }
  public reactivate(): Result<void, JoinTokenDomainCode> {
    if (this.props.expiredAt === null) {
      return failure(JoinTokenDomainCodes.NOT_EXPIRED);
    }

    this.props.expiredAt = null;

    return success(undefined);
  }
  public updateMaxUses(
    maxUses: JoinTokenMaxUses | null
  ): Result<void, JoinTokenDomainCode> {
    const parsed = JoinTokenMaxUses.nullable().safeParse(maxUses);

    if (!parsed.success) {
      return failure(JoinTokenDomainCodes.MAX_USES_INVALID);
    }

    this.props.maxUses = parsed.data;

    return success(undefined);
  }
  public incrementUseCount(): Result<void, JoinTokenDomainCode> {
    if (
      this.props.maxUses !== null &&
      this.props.useCount >= this.props.maxUses
    ) {
      return failure(JoinTokenDomainCodes.TOKEN_EXHAUSTED);
    }

    const next = JoinTokenUseCount.safeParse(this.props.useCount + 1);

    if (!next.success) {
      return failure(JoinTokenDomainCodes.TOKEN_EXHAUSTED);
    }

    this.props.useCount = next.data;

    return success(undefined);
  }
  /** Release an unsuccessful join attempt; repeated compensation cannot go negative. */
  public releaseUse(): void {
    this.props.useCount = JoinTokenUseCount.parse(
      Math.max(0, this.props.useCount - 1)
    );
  }
  public canBeUsed(): boolean {
    return (
      this.props.expiredAt === null &&
      (this.props.maxUses === null || this.props.useCount < this.props.maxUses)
    );
  }
  /** Detached wire representation retains the identity, token and usage types. */
  public toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      token: this.token,
      description: this.description,
      maxUses: this.maxUses,
      useCount: this.useCount,
      createdById: this.createdById,
      createdAt: this.createdAt,
      expiredAt: this.expiredAt,
    } satisfies JoinTokenProps;
  }
}

export type JoinTokenSnapshot = ReturnType<JoinToken['toJSON']>;
