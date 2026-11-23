/** Numeric property units validated before entering domain behavior. Brands
 * distinguish sizes from ownership fractions without changing arithmetic or rounding. */
import { z } from 'zod';

export const AssetSize = z
  .number()
  .finite()
  .positive()
  .brand<'PropertyAssetSize'>();
export type AssetSize = z.infer<typeof AssetSize>;

export const OwnershipShare = z
  .number()
  .finite()
  .min(0)
  .max(1)
  .brand<'OrganizationOwnershipShare'>();
export type OwnershipShare = z.infer<typeof OwnershipShare>;

/** Percentage projections stay distinct from the stored zero-to-one fraction. */
export const OwnershipPercentage = z
  .number()
  .min(0)
  .max(100)
  .brand<'OrganizationOwnershipPercentage'>();
export type OwnershipPercentage = z.infer<typeof OwnershipPercentage>;

/** Names and external labels are normalized at their input boundary. */
export const AssetName = z.string().trim().min(1).brand<'PropertyAssetName'>();
export type AssetName = z.infer<typeof AssetName>;
export const ExternalOwnerLabel = z
  .string()
  .trim()
  .min(1)
  .brand<'ExternalOwnerLabel'>();
export type ExternalOwnerLabel = z.infer<typeof ExternalOwnerLabel>;

export const PropertyName = z
  .string()
  .trim()
  .min(1)
  .brand<'OrganizationPropertyName'>();
export type PropertyName = z.infer<typeof PropertyName>;
export const PropertyAddress = z
  .string()
  .trim()
  .min(1)
  .brand<'OrganizationPropertyAddress'>();
export type PropertyAddress = z.infer<typeof PropertyAddress>;
export const ClaimDenialReason = z
  .string()
  .trim()
  .min(1)
  .brand<'PropertyClaimDenialReason'>();
export type ClaimDenialReason = z.infer<typeof ClaimDenialReason>;

/** Validated number of properties; distinct from other count units. */
export const PropertyCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'PropertyCount'>();
export type PropertyCount = z.infer<typeof PropertyCount>;
