/** Explicit property/ownership projections preserve domain types, instants and owner alternatives.
 * Only selected plain fields cross the client boundary; aggregates and extra fields stay private. */
import type { OrganizationProperty } from '@/domain/organization/OrganizationProperty';
import type { PropertyAsset } from '@/domain/organization/PropertyAsset';
import type { PropertyAssetOwnership } from '@/domain/organization/PropertyAssetOwnership';
import type {
  AllOwnershipRow,
  OwnershipOwnerProjection,
} from '@/domain/organization/PropertyAssetRepository';
import type { OrgTreeMember } from '@/application/organization/SearchOrgTreeMembersUseCase';
import type { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';

export function serializeProperty(property: OrganizationProperty) {
  const archivedAt = property.archivedAt;

  return {
    id: property.id,
    name: property.name,
    address: property.address,
    sizeUnit: property.sizeUnit,
    archivedAt: archivedAt === null ? null : Instant.fromDate(archivedAt),
  };
}

export function serializeAsset(asset: PropertyAsset) {
  const archivedAt = asset.archivedAt;

  return {
    id: asset.id,
    name: asset.name,
    size: asset.size,
    archivedAt: archivedAt === null ? null : Instant.fromDate(archivedAt),
  };
}

// Pre-formatted display labels let the UI show a member's name instead of the
// raw cuid. Labels are null for external-owner rows and unavailable profiles.
export type ActiveOwnershipView = Pick<PropertyAssetOwnership, 'id' | 'share'> &
  OwnershipOwnerProjection;

export function serializeActiveOwnership(
  ownership: PropertyAssetOwnership,
  labels: ReadonlyMap<UserId, string>
): ActiveOwnershipView {
  const owner = ownership.owner;
  const common = { id: ownership.id, share: ownership.share };

  return owner.kind === 'user'
    ? {
        ...common,
        userId: owner.userId,
        userLabel: labels.get(owner.userId) ?? null,
        externalOwnerLabel: null,
      }
    : {
        ...common,
        userId: null,
        userLabel: null,
        externalOwnerLabel: owner.label,
      };
}

export function serializeOwnershipRow(row: AllOwnershipRow): AllOwnershipRow {
  const common = {
    id: row.id,
    assetId: row.assetId,
    assetName: row.assetName,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    share: row.share,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
  };

  return row.userId !== null
    ? {
        ...common,
        userId: row.userId,
        userLabel: row.userLabel,
        externalOwnerLabel: null,
      }
    : {
        ...common,
        userId: null,
        userLabel: null,
        externalOwnerLabel: row.externalOwnerLabel,
      };
}

export function serializeTreeMember(member: OrgTreeMember) {
  return {
    id: member.id,
    label:
      [member.lastName, member.firstName, member.middleName]
        .filter(Boolean)
        .join(' ') + ` (@${member.nickname.getValue()})`,
    orgNames: member.orgNames,
  };
}

export type PropertiesView = {
  properties: ReturnType<typeof serializeProperty>[];
};
export type AssetsView = { assets: ReturnType<typeof serializeAsset>[] };
export type ActiveOwnershipsView = { ownerships: ActiveOwnershipView[] };
export type OwnershipRowsView = { rows: AllOwnershipRow[] };
export type TreeMembersView = {
  matches: ReturnType<typeof serializeTreeMember>[];
};
