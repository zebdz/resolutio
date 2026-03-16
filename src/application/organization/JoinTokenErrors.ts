// Token-specific errors only. For org/admin errors, reuse OrganizationErrors.
export const JoinTokenErrors = {
  NOT_FOUND: 'joinToken.errors.notFound',
  EXPIRED: 'joinToken.errors.expired',
  EXHAUSTED: 'joinToken.errors.exhausted',
} as const;

export type JoinTokenError =
  (typeof JoinTokenErrors)[keyof typeof JoinTokenErrors];
