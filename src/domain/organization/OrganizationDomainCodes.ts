// Domain-level codes
// These represent validation errors at the entity level
export const OrganizationDomainCodes = {
  // Organization validation
  ORGANIZATION_NAME_EMPTY: 'domain.organization.organizationNameEmpty',
  ORGANIZATION_NAME_TOO_LONG: 'domain.organization.organizationNameTooLong',
  ORGANIZATION_DESCRIPTION_EMPTY:
    'domain.organization.organizationDescriptionEmpty',
  ORGANIZATION_DESCRIPTION_TOO_LONG:
    'domain.organization.organizationDescriptionTooLong',
  ORGANIZATION_ALREADY_ARCHIVED:
    'domain.organization.organizationAlreadyArchived',
  ORGANIZATION_NOT_ARCHIVED: 'domain.organization.organizationNotArchived',
  ORGANIZATION_NAME_TOO_SHORT: 'domain.organization.organizationNameTooShort',
  ORGANIZATION_NAME_INVALID_CHARS:
    'domain.organization.organizationNameInvalidChars',

  // Property / asset / ownership
  PROPERTY_NAME_EMPTY: 'domain.organization.propertyNameEmpty',
  PROPERTY_NOT_FOUND: 'domain.organization.propertyNotFound',
  PROPERTY_ALREADY_ARCHIVED: 'domain.organization.propertyAlreadyArchived',
  PROPERTY_NOT_ARCHIVED: 'domain.organization.propertyNotArchived',
  PROPERTY_ASSET_NAME_EMPTY: 'domain.organization.propertyAssetNameEmpty',
  PROPERTY_ASSET_SIZE_NON_POSITIVE:
    'domain.organization.propertyAssetSizeNonPositive',
  PROPERTY_ASSET_NOT_FOUND: 'domain.organization.propertyAssetNotFound',
  PROPERTY_ASSET_ALREADY_ARCHIVED:
    'domain.organization.propertyAssetAlreadyArchived',
  PROPERTY_ASSET_NOT_ARCHIVED: 'domain.organization.propertyAssetNotArchived',
  PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE:
    'domain.organization.propertyAssetOwnershipShareOutOfRange',

  // SizeUnit
  SIZE_UNIT_INVALID: 'domain.organization.sizeUnitInvalid',

  // Ownership edit / claim
  SHARES_DO_NOT_SUM_TO_ONE: 'domain.organization.sharesDoNotSumToOne',
  OWNER_REPRESENTATION_INVALID:
    'domain.organization.ownerRepresentationInvalid',
  EXTERNAL_OWNER_LABEL_EMPTY: 'domain.organization.externalOwnerLabelEmpty',
  OWNERSHIP_USER_ID_REQUIRED: 'domain.organization.ownershipUserIdRequired',
  OWNERSHIP_SHARE_MUST_BE_POSITIVE:
    'domain.organization.ownershipShareMustBePositive',
  OWNERSHIP_DUPLICATE_OWNER: 'domain.organization.ownershipDuplicateOwner',
  CORRECTION_REASON_EMPTY: 'domain.organization.correctionReasonEmpty',
  CANNOT_CORRECT_LOCKED_PROPERTY:
    'domain.organization.cannotCorrectLockedProperty',
  OWNERSHIP_ROW_NOT_FOUND: 'domain.organization.ownershipRowNotFound',
  OWNERSHIP_ROW_NOT_ACTIVE: 'domain.organization.ownershipRowNotActive',

  // Claim
  PROPERTY_CLAIM_NOT_FOUND: 'domain.organization.propertyClaimNotFound',
  PROPERTY_CLAIM_NOT_PENDING: 'domain.organization.propertyClaimNotPending',
  PROPERTY_CLAIM_DENIAL_REASON_EMPTY:
    'domain.organization.propertyClaimDenialReasonEmpty',
  PROPERTY_CLAIM_ALREADY_PENDING_FOR_ASSET:
    'domain.organization.propertyClaimAlreadyPendingForAsset',
  PROPERTY_CLAIM_OWN_PENDING_FOR_ASSET:
    'domain.organization.propertyClaimOwnPendingForAsset',
  PROPERTY_CLAIM_REPEAT_BLOCKED_DURING_COOLDOWN:
    'domain.organization.propertyClaimRepeatBlockedDuringCooldown',
  PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE:
    'domain.organization.propertyClaimAssetNotClaimable',
  PROPERTY_CLAIM_ATTACHMENT_TOO_LARGE:
    'domain.organization.propertyClaimAttachmentTooLarge',
  PROPERTY_CLAIM_ATTACHMENT_TYPE_NOT_ALLOWED:
    'domain.organization.propertyClaimAttachmentTypeNotAllowed',
  PROPERTY_CLAIM_ATTACHMENT_FILENAME_EMPTY:
    'domain.organization.propertyClaimAttachmentFileNameEmpty',
  PROPERTY_CLAIM_ATTACHMENT_NOT_FOUND:
    'domain.organization.propertyClaimAttachmentNotFound',
  PROPERTY_CLAIM_ATTACHMENT_MAGIC_MISMATCH:
    'domain.organization.propertyClaimAttachmentMagicMismatch',
  PROPERTY_CLAIM_MULTIPLE_PLACEHOLDERS_REQUIRE_TARGET:
    'domain.organization.propertyClaimMultiplePlaceholdersRequireTarget',
  PROPERTY_CLAIM_TARGET_OWNERSHIP_INVALID:
    'domain.organization.propertyClaimTargetOwnershipInvalid',

  // Authorization
  NOT_ORG_MEMBER: 'domain.organization.notOrgMember',
  NOT_ORG_ADMIN_DOMAIN: 'domain.organization.notOrgAdmin',
} as const;

export type OrganizationDomainCode =
  (typeof OrganizationDomainCodes)[keyof typeof OrganizationDomainCodes];
