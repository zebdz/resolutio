/** Application boundary for authorized property changes. Raw request values are
 * parsed before domain behavior; persistence receives validated domain values. */
import {
  ExternalOwnerLabel,
  OwnershipShare,
} from '../../domain/organization/PropertyValues';
import { Clock, IdGenerator } from '../shared/EntityCreation';
import { Instant } from '../../domain/shared/Instant';
import {
  AssetId,
  OwnershipId,
  UserId,
  OrganizationId,
} from '../../domain/shared/EntityIds';
import {
  PropertyAssetRepository,
  OwnershipRowToInsert,
} from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PropertyAssetOwnership } from '../../domain/organization/PropertyAssetOwnership';
import { Result, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
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
  ids: IdGenerator;
  clock: Clock;
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ReplaceAssetOwnersUseCase {
  constructor(private deps: ReplaceAssetOwnersDependencies) {}

  async execute(
    input: ReplaceAssetOwnersInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedId = AssetId.safeParse(input.assetId);

    if (!parsedId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_FOUND);
    }

    const aRes = await this.deps.assetRepository.findAssetById(parsedId.data);

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

    const actor = UserId.safeParse(input.adminUserId);

    if (
      !actor.success ||
      !(await this.authorize(actor.data, pRes.value.organizationId))
    ) {
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
    const at = this.deps.clock.now();

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
        const userId = UserId.safeParse(o.userId);

        if (!userId.success) {
          return failure(OrganizationDomainCodes.OWNERSHIP_USER_ID_REQUIRED);
        }

        const share = OwnershipShare.safeParse(o.share);

        if (!share.success) {
          return failure(
            OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
          );
        }

        const r = PropertyAssetOwnership.createForUser(
          parsedId.data,
          userId.data,
          share.data,
          { id: this.deps.ids.generate(OwnershipId), now: at }
        );

        if (!r.success) {
          return failure(r.error);
        }

        inserts.push({
          id: r.value.id,
          owner: r.value.owner,
          share: r.value.share,
          createdAt: Instant.fromDate(r.value.createdAt),
        });
      } else {
        const label = ExternalOwnerLabel.safeParse(o.label);

        if (!label.success) {
          return failure(OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY);
        }

        const share = OwnershipShare.safeParse(o.share);

        if (!share.success) {
          return failure(
            OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
          );
        }

        const r = PropertyAssetOwnership.createForExternalOwner(
          parsedId.data,
          label.data,
          share.data,
          { id: this.deps.ids.generate(OwnershipId), now: at }
        );

        if (!r.success) {
          return failure(r.error);
        }

        inserts.push({
          id: r.value.id,
          owner: r.value.owner,
          share: r.value.share,
          createdAt: Instant.fromDate(r.value.createdAt),
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
      assetId: parsedId.data,
      at,
      inserts,
    });
  }

  private async authorize(
    userId: UserId,
    orgId: OrganizationId
  ): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
