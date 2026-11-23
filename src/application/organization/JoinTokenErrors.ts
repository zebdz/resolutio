// Token-specific errors only. For org/admin errors, reuse OrganizationErrors.
import { JoinTokenDomainCode } from '../../domain/organization/JoinTokenDomainCodes';
import { OrganizationUseCaseFailure } from './OrganizationErrors';
export const JoinTokenErrors = {
  NOT_FOUND: 'joinToken.errors.notFound',
  EXPIRED: 'joinToken.errors.expired',
  EXHAUSTED: 'joinToken.errors.exhausted',
} as const;

export type JoinTokenError =
  (typeof JoinTokenErrors)[keyof typeof JoinTokenErrors];

export type JoinTokenUseCaseFailure =
  | JoinTokenError
  | JoinTokenDomainCode
  | OrganizationUseCaseFailure;
