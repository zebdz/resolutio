import { randomBytes } from 'crypto';
import { Result, success, failure } from '../shared/Result';
import { JoinTokenDomainCodes } from './JoinTokenDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export const JOIN_TOKEN_DESCRIPTION_MAX_LENGTH = 500;

const TOKEN_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';
const TOKEN_LENGTH = 10;

function generateToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let token = '';

  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_CHARSET[bytes[i] % TOKEN_CHARSET.length];
  }

  return token;
}

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

export class JoinToken {
  private constructor(private props: JoinTokenProps) {}

  public static create(
    organizationId: string,
    createdById: string,
    description: string,
    maxUses?: number | null,
    profanityChecker?: ProfanityChecker
  ): Result<JoinToken, string> {
    if (!description || description.trim().length === 0) {
      return failure(JoinTokenDomainCodes.DESCRIPTION_EMPTY);
    }

    if (description.length > JOIN_TOKEN_DESCRIPTION_MAX_LENGTH) {
      return failure(JoinTokenDomainCodes.DESCRIPTION_TOO_LONG);
    }

    if (profanityChecker?.containsProfanity(description.trim())) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const resolvedMaxUses = maxUses === undefined ? null : maxUses;

    if (resolvedMaxUses !== null && resolvedMaxUses <= 0) {
      return failure(JoinTokenDomainCodes.MAX_USES_INVALID);
    }

    const joinToken = new JoinToken({
      id: '',
      organizationId,
      token: generateToken(),
      description: description.trim(),
      maxUses: resolvedMaxUses,
      useCount: 0,
      createdById,
      createdAt: new Date(),
      expiredAt: null,
    });

    return success(joinToken);
  }

  public static reconstitute(props: JoinTokenProps): JoinToken {
    return new JoinToken(props);
  }

  public get id(): string {
    return this.props.id;
  }

  public get organizationId(): string {
    return this.props.organizationId;
  }

  public get token(): string {
    return this.props.token;
  }

  public get description(): string {
    return this.props.description;
  }

  public get maxUses(): number | null {
    return this.props.maxUses;
  }

  public get useCount(): number {
    return this.props.useCount;
  }

  public get createdById(): string {
    return this.props.createdById;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get expiredAt(): Date | null {
    return this.props.expiredAt;
  }

  public expire(): Result<void, string> {
    if (this.props.expiredAt !== null) {
      return failure(JoinTokenDomainCodes.ALREADY_EXPIRED);
    }

    this.props.expiredAt = new Date();

    return success(undefined);
  }

  public reactivate(): Result<void, string> {
    if (this.props.expiredAt === null) {
      return failure(JoinTokenDomainCodes.NOT_EXPIRED);
    }

    this.props.expiredAt = null;

    return success(undefined);
  }

  public updateMaxUses(maxUses: number | null): Result<void, string> {
    if (maxUses !== null && maxUses <= 0) {
      return failure(JoinTokenDomainCodes.MAX_USES_INVALID);
    }

    this.props.maxUses = maxUses;

    return success(undefined);
  }

  public incrementUseCount(): Result<void, string> {
    if (
      this.props.maxUses !== null &&
      this.props.useCount >= this.props.maxUses
    ) {
      return failure(JoinTokenDomainCodes.TOKEN_EXHAUSTED);
    }

    this.props.useCount += 1;

    return success(undefined);
  }

  public canBeUsed(): boolean {
    if (this.props.expiredAt !== null) {
      return false;
    }

    if (
      this.props.maxUses !== null &&
      this.props.useCount >= this.props.maxUses
    ) {
      return false;
    }

    return true;
  }

  public toJSON(): JoinTokenProps {
    return {
      ...this.props,
    };
  }
}
