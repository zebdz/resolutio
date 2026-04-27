import {
  PropertyAssetRepository,
  OwnershipRowToInsert,
} from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PropertyAssetOwnership } from '../../domain/organization/PropertyAssetOwnership';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export type OwnerInput =
  | { kind: 'user'; userId: string; share: number }
  | { kind: 'external'; label: string; share: number };

export interface ReplaceAssetOwnersInput {
  assetId: string;
  adminUserId: string;
  owners: OwnerInput[];
}

const SUM_TOLERANCE = 1e-6;

export interface ReplaceAssetOwnersDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ReplaceAssetOwnersUseCase {
  constructor(private deps: ReplaceAssetOwnersDependencies) {}

  async execute(input: ReplaceAssetOwnersInput): Promise<Result<void, string>> {
    const aRes = await this.deps.assetRepository.findAssetById(input.assetId);

    if (!aRes.success) {
      return failure(aRes.error);
    }

    if (!aRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_FOUND);
    }

    const asset = aRes.value;
    const pRes = await this.deps.propertyRepository.findById(asset.propertyId);

    if (!pRes.success || !pRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    if (!(await this.authorize(input.adminUserId, pRes.value.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Block ownership edits on archived assets/properties — archived state is
    // for read/restore only; mutations would corrupt the historical record.
    if (pRes.value.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    if (asset.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED);
    }

    // Reject duplicate owners within the same batch. Duplicates would yield
    // two active rows for the same (asset, user/label) which both breaks the
    // "one effective row per owner" invariant and would confuse the weight
    // calc by double-counting. Label comparison is case-insensitive + trimmed
    // so "Record Owner" and " record owner" count as the same external owner.
    const seenUserIds = new Set<string>();
    const seenLabels = new Set<string>();

    for (const o of input.owners) {
      if (o.kind === 'user') {
        const uid = (o.userId ?? '').trim();

        if (uid && seenUserIds.has(uid)) {
          return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
        }

        seenUserIds.add(uid);
      } else {
        const norm = (o.label ?? '').trim().toLowerCase();

        if (norm && seenLabels.has(norm)) {
          return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
        }

        seenLabels.add(norm);
      }
    }

    // Validate each row with the entity; this catches share range + label emptiness.
    const inserts: OwnershipRowToInsert[] = [];

    for (const o of input.owners) {
      // Zero-share owner rows are never useful: they contribute nothing to
      // weight and clutter the ownership history. Admins should simply remove
      // such rows instead of storing them.
      if (!(o.share > 0)) {
        return failure(
          OrganizationDomainCodes.OWNERSHIP_SHARE_MUST_BE_POSITIVE
        );
      }

      if (o.kind === 'user') {
        // Catch missing userId at the use-case boundary instead of letting it
        // reach the DB FK and surface as a raw Prisma error.
        if (!o.userId || o.userId.trim() === '') {
          return failure(OrganizationDomainCodes.OWNERSHIP_USER_ID_REQUIRED);
        }

        const r = PropertyAssetOwnership.createForUser(
          input.assetId,
          o.userId,
          o.share
        );

        if (!r.success) {
          return failure(r.error);
        }

        inserts.push({
          userId: o.userId,
          externalOwnerLabel: null,
          share: o.share,
        });
      } else {
        const r = PropertyAssetOwnership.createForExternalOwner(
          input.assetId,
          o.label,
          o.share
        );

        if (!r.success) {
          return failure(r.error);
        }

        inserts.push({
          userId: null,
          externalOwnerLabel: r.value.externalOwnerLabel,
          share: o.share,
        });
      }
    }

    // Unit-sum check (empty list is vacuously OK).
    if (inserts.length > 0) {
      const sum = inserts.reduce((s, r) => s + r.share, 0);

      if (Math.abs(sum - 1) > SUM_TOLERANCE) {
        return failure(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
      }
    }

    return this.deps.assetRepository.replaceOwners({
      assetId: input.assetId,
      at: new Date(),
      inserts,
    });
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
