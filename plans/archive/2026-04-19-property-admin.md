# Property Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give org admins a UI to manage properties, assets, and ownership (per-row CRUD) and give members a self-service flow to claim assets recorded against placeholder `external_owner_label` rows.

**Architecture:** DDD. Schema: make `property_asset_ownerships.user_id` nullable, add `external_owner_label`, add `size_unit` to `organization_properties`, new `property_claims` table. New domain entity `PropertyClaim`, value object `SizeUnit`, service `PropertyLockService`. Entity extensions on `OrganizationProperty`, `PropertyAsset`, `PropertyAssetOwnership`. Use cases: property/asset CRUD, ownership batch replace (SCD-2), ownership correction (SCD-1, pre-lock only), claim submit/approve/deny. Projection-safe read use cases enforce confidentiality (`{id, name}` only for member-facing claim UI). Admin UI adaptive (0/1/2+ properties). Member UI gated server-side.

**Tech Stack:** Prisma 7 (PostgreSQL), Vitest 4, Next.js 15 (App Router), React, Tailwind + Catalyst, next-intl.

**Spec:** `readmes/2026-04-19-property-admin-design.md`

---

## File Map

### Task 1 — Prisma schema + migration (nullable user_id, external_owner_label, size_unit, property_claims)

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_property_admin/migration.sql`

### Task 2 — Domain: new + extended error codes

- Modify: `src/domain/organization/OrganizationDomainCodes.ts`

### Task 3 — Domain: `SizeUnit` value object

- Create: `src/domain/organization/SizeUnit.ts`
- Create: `src/domain/organization/__tests__/SizeUnit.test.ts`

### Task 4 — Domain: `OrganizationProperty` entity extensions (sizeUnit, rename, unarchive)

- Modify: `src/domain/organization/OrganizationProperty.ts`
- Modify: `src/domain/organization/__tests__/OrganizationProperty.test.ts`

### Task 5 — Domain: `PropertyAsset` entity extensions (rename, resize, unarchive)

- Modify: `src/domain/organization/PropertyAsset.ts`
- Modify: `src/domain/organization/__tests__/PropertyAsset.test.ts`

### Task 6 — Domain: `PropertyAssetOwnership` nullable userId + externalOwnerLabel + link/correct

- Modify: `src/domain/organization/PropertyAssetOwnership.ts`
- Modify: `src/domain/organization/__tests__/PropertyAssetOwnership.test.ts`

### Task 7 — Domain: `PropertyClaim` entity

- Create: `src/domain/organization/PropertyClaim.ts`
- Create: `src/domain/organization/__tests__/PropertyClaim.test.ts`

### Task 8 — Domain: `PropertyLockService` pure service

- Create: `src/domain/organization/PropertyLockService.ts`
- Create: `src/domain/organization/__tests__/PropertyLockService.test.ts`

### Task 9 — Domain: repository ports (extend + new)

- Modify: `src/domain/organization/OrganizationPropertyRepository.ts`
- Modify: `src/domain/organization/PropertyAssetRepository.ts`
- Create: `src/domain/organization/PropertyClaimRepository.ts`
- Create: `src/domain/organization/PropertyLockRepository.ts`

### Task 10 — Infrastructure: extend `PrismaOrganizationPropertyRepository` (write ops)

- Modify: `src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts`

### Task 11 — Infrastructure: extend `PrismaPropertyAssetRepository` (CRUD + `replaceOwners`, `correctOwnership`)

- Modify: `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`

### Task 12 — Infrastructure: `PrismaPropertyClaimRepository`

- Create: `src/infrastructure/repositories/PrismaPropertyClaimRepository.ts`
- Modify: `src/infrastructure/index.ts`

### Task 13 — Infrastructure: `PrismaPropertyLockRepository`

- Create: `src/infrastructure/repositories/PrismaPropertyLockRepository.ts`
- Modify: `src/infrastructure/index.ts`

### Task 14 — Application: Property CRUD use cases

- Create: `src/application/organization/CreatePropertyUseCase.ts`
- Create: `src/application/organization/UpdatePropertyUseCase.ts`
- Create: `src/application/organization/ArchivePropertyUseCase.ts`
- Create: `src/application/organization/UnarchivePropertyUseCase.ts`
- Create: `src/application/organization/__tests__/CreatePropertyUseCase.test.ts`
- Create: `src/application/organization/__tests__/UpdatePropertyUseCase.test.ts`
- Create: `src/application/organization/__tests__/ArchivePropertyUseCase.test.ts`
- Create: `src/application/organization/__tests__/UnarchivePropertyUseCase.test.ts`

### Task 15 — Application: Asset CRUD use cases

- Create: `src/application/organization/CreateAssetUseCase.ts`
- Create: `src/application/organization/UpdateAssetUseCase.ts`
- Create: `src/application/organization/ArchiveAssetUseCase.ts`
- Create: `src/application/organization/UnarchiveAssetUseCase.ts`
- Create: `src/application/organization/__tests__/CreateAssetUseCase.test.ts`
- Create: `src/application/organization/__tests__/UpdateAssetUseCase.test.ts`
- Create: `src/application/organization/__tests__/ArchiveAssetUseCase.test.ts`
- Create: `src/application/organization/__tests__/UnarchiveAssetUseCase.test.ts`

### Task 16 — Application: `ReplaceAssetOwnersUseCase` (batch SCD-2)

- Create: `src/application/organization/ReplaceAssetOwnersUseCase.ts`
- Create: `src/application/organization/__tests__/ReplaceAssetOwnersUseCase.test.ts`

### Task 17 — Application: `CorrectOwnershipUseCase` (SCD-1, unlocked-only)

- Create: `src/application/organization/CorrectOwnershipUseCase.ts`
- Create: `src/application/organization/__tests__/CorrectOwnershipUseCase.test.ts`

### Task 18 — Application: `ListOrgPropertiesForMemberUseCase` (projection-safe)

- Create: `src/application/organization/ListOrgPropertiesForMemberUseCase.ts`
- Create: `src/application/organization/__tests__/ListOrgPropertiesForMemberUseCase.test.ts`

### Task 19 — Application: `ListClaimableAssetsUseCase` (projection-safe)

- Create: `src/application/organization/ListClaimableAssetsUseCase.ts`
- Create: `src/application/organization/__tests__/ListClaimableAssetsUseCase.test.ts`

### Task 20 — Application: claim use cases (Submit, Approve, Deny, AutoDenyOnArchive)

- Create: `src/application/organization/SubmitPropertyClaimUseCase.ts`
- Create: `src/application/organization/ApprovePropertyClaimUseCase.ts`
- Create: `src/application/organization/DenyPropertyClaimUseCase.ts`
- Create: `src/application/organization/AutoDenyPendingClaimsOnArchiveUseCase.ts`
- Create: `src/application/organization/__tests__/SubmitPropertyClaimUseCase.test.ts`
- Create: `src/application/organization/__tests__/ApprovePropertyClaimUseCase.test.ts`
- Create: `src/application/organization/__tests__/DenyPropertyClaimUseCase.test.ts`
- Create: `src/application/organization/__tests__/AutoDenyPendingClaimsOnArchiveUseCase.test.ts`

### Task 21 — Application: claim notification use cases

- Create: `src/application/notification/NotifyPropertyClaimSubmittedUseCase.ts`
- Create: `src/application/notification/NotifyPropertyClaimApprovedUseCase.ts`
- Create: `src/application/notification/NotifyPropertyClaimDeniedUseCase.ts`

### Task 22 — Web actions: property + ownership (`property.ts`)

- Create: `src/web/actions/organization/property.ts`

### Task 23 — Web actions: claims (`propertyClaim.ts`)

- Create: `src/web/actions/organization/propertyClaim.ts`

### Task 24 — Admin UI: `manage-properties` page (adaptive 0/1/2+)

- Create: `src/app/[locale]/organizations/[id]/manage-properties/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/ManagePropertiesClient.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/PropertyEditorInline.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/AssetsTable.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/EditOwnersModal.tsx`

### Task 25 — Admin UI: `manage-ownership` page (cross-property flat table)

- Create: `src/app/[locale]/organizations/[id]/manage-ownership/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-ownership/OwnershipTable.tsx`

### Task 26 — Admin UI: `property-claims` pending queue

- Create: `src/app/[locale]/organizations/[id]/property-claims/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/property-claims/ClaimsQueue.tsx`

### Task 27 — Member UI: Org page "Properties" section (server-side gated)

- Modify: `src/app/[locale]/organizations/[id]/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/PropertiesSection.tsx`

### Task 28 — Member UI: per-property claim page (projection-safe)

- Create: `src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/ClaimAssetsClient.tsx`
- Create: `src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/MyClaimsList.tsx`

### Task 29 — Member UI: home-page org card "Claim property" shortcut

- Modify: `src/web/actions/organization/organization.ts` (return `hasProperties` flag)
- Modify: relevant home-page org-card component (discovered in Task 29 Step 0)

### Task 30 — Localization: `propertyAdmin.*` + `propertyClaim.*` keys

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

### Task 31 — Manual QA + final verification

- Run: `yarn test`, `yarn tsc --noEmit`, `yarn lint`, browser walkthrough per spec §Verification

---

## Task 1: Prisma schema + migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_property_admin/migration.sql`

- [ ] **Step 1: Modify `PropertyAssetOwnership` model — make `userId` nullable, add `externalOwnerLabel`**

Open `prisma/schema.prisma`. Locate the `PropertyAssetOwnership` model (around line 640). Replace it with:

```prisma
model PropertyAssetOwnership {
  id                 String    @id @default(cuid())
  assetId            String    @map("asset_id")
  userId             String?   @map("user_id")
  externalOwnerLabel String?   @map("external_owner_label")
  share              Decimal   @db.Decimal(9, 8)
  effectiveFrom      DateTime  @default(now()) @map("effective_from")
  effectiveUntil     DateTime? @map("effective_until")
  createdAt          DateTime  @default(now()) @map("created_at")

  asset PropertyAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  user  User?         @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([assetId, effectiveUntil])
  @@index([userId, effectiveUntil])
  @@map("property_asset_ownerships")
}
```

- [ ] **Step 2: Add `sizeUnit` to `OrganizationProperty`**

Locate the `OrganizationProperty` model. Replace with:

```prisma
model OrganizationProperty {
  id             String    @id @default(cuid())
  organizationId String    @map("organization_id")
  name           String
  address        String?
  sizeUnit       String    @map("size_unit")
  createdAt      DateTime  @default(now()) @map("created_at")
  archivedAt     DateTime? @map("archived_at")

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  assets       PropertyAsset[]
  polls        PollProperty[]
  claims       PropertyClaim[]

  @@index([organizationId])
  @@map("organization_properties")
}
```

- [ ] **Step 3: Add `PropertyClaim` model**

Append near the bottom of the file (after `PollEligibleMember`):

```prisma
model PropertyClaim {
  id             String    @id @default(cuid())
  organizationId String    @map("organization_id")
  userId         String    @map("user_id")
  assetId        String    @map("asset_id")
  status         String
  deniedReason   String?   @map("denied_reason")
  decidedBy      String?   @map("decided_by")
  decidedAt      DateTime? @map("decided_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  organization  Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user          User          @relation("PropertyClaimUser", fields: [userId], references: [id], onDelete: Cascade)
  asset         PropertyAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  decidedByUser User?         @relation("PropertyClaimDecidedBy", fields: [decidedBy], references: [id])

  @@index([organizationId, status])
  @@index([userId])
  @@index([assetId])
  @@map("property_claims")
}
```

- [ ] **Step 4: Add reverse relations**

Inside the `User` model, append to the relations block:

```prisma
propertyClaimsSubmitted PropertyClaim[] @relation("PropertyClaimUser")
propertyClaimsDecided   PropertyClaim[] @relation("PropertyClaimDecidedBy")
```

Inside the `Organization` model, append to relations:

```prisma
propertyClaims PropertyClaim[]
```

Inside the `PropertyAsset` model, append to relations:

```prisma
claims PropertyClaim[]
```

- [ ] **Step 5: Create the migration with `--create-only`**

Run:

```bash
yarn prisma migrate dev --name add_property_admin --create-only
```

Expected: a new directory `prisma/migrations/<timestamp>_add_property_admin/` with a `migration.sql`.

- [ ] **Step 6: Append CHECK + backfill to `migration.sql`**

Open the newly created `migration.sql` and append at the end:

```sql
-- Backfill size_unit for any pre-existing rows (condo demo is m²-based).
UPDATE "organization_properties" SET "size_unit" = 'SQUARE_METERS' WHERE "size_unit" IS NULL OR "size_unit" = '';

-- Enforce NOT NULL now that backfill completed.
ALTER TABLE "organization_properties" ALTER COLUMN "size_unit" SET NOT NULL;

-- Enforce exactly one of user_id or external_owner_label is set.
ALTER TABLE "property_asset_ownerships"
  ADD CONSTRAINT "property_asset_ownerships_owner_repr_chk"
  CHECK (
    ( ("user_id" IS NOT NULL)::int + ("external_owner_label" IS NOT NULL)::int ) = 1
  );
```

- [ ] **Step 7: Apply the migration**

Run:

```bash
yarn prisma migrate dev
```

Expected output ends with `Database is in sync with the Prisma schema.`

- [ ] **Step 8: Regenerate the Prisma client**

Run:

```bash
yarn prisma generate
```

Expected: "Generated Prisma Client" message.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): property_claims, nullable user_id, external_owner_label, size_unit"
```

---

## Task 2: Domain — new + extended error codes

**Files:**

- Modify: `src/domain/organization/OrganizationDomainCodes.ts`

- [ ] **Step 1: Add the new codes**

Open `src/domain/organization/OrganizationDomainCodes.ts` and replace with:

```typescript
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
  PROPERTY_CLAIM_REPEAT_BLOCKED_WITHIN_24H:
    'domain.organization.propertyClaimRepeatBlockedWithin24h',
  PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE:
    'domain.organization.propertyClaimAssetNotClaimable',

  // Authorization
  NOT_ORG_MEMBER: 'domain.organization.notOrgMember',
  NOT_ORG_ADMIN_DOMAIN: 'domain.organization.notOrgAdmin',
} as const;

export type OrganizationDomainCode =
  (typeof OrganizationDomainCodes)[keyof typeof OrganizationDomainCodes];
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

```bash
yarn vitest run src/domain/organization
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/domain/organization/OrganizationDomainCodes.ts
git commit -m "feat(domain): add property-admin domain codes"
```

---

## Task 3: Domain — `SizeUnit` value object

**Files:**

- Create: `src/domain/organization/SizeUnit.ts`
- Create: `src/domain/organization/__tests__/SizeUnit.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/domain/organization/__tests__/SizeUnit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SizeUnit, SizeUnitValue } from '../SizeUnit';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('SizeUnit', () => {
  it('enumerates all supported units', () => {
    expect(SizeUnit.values).toEqual([
      'SQUARE_METERS',
      'SQUARE_FEET',
      'HECTARES',
      'ACRES',
      'CUBIC_METERS',
      'LINEAR_METERS',
      'UNIT_COUNT',
      'SHARES',
    ]);
  });

  describe('parse', () => {
    it('accepts every valid value', () => {
      for (const v of SizeUnit.values) {
        const r = SizeUnit.parse(v);
        expect(r.success).toBe(true);
        if (r.success) {
          expect(r.value).toBe(v);
        }
      }
    });

    it('rejects unknown value', () => {
      const r = SizeUnit.parse('FURLONGS');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.SIZE_UNIT_INVALID);
      }
    });

    it('rejects empty string', () => {
      const r = SizeUnit.parse('');
      expect(r.success).toBe(false);
    });
  });

  describe('translationKey', () => {
    it('maps to camelCase key under propertyAdmin.sizeUnit', () => {
      expect(SizeUnit.translationKey('SQUARE_METERS')).toBe(
        'propertyAdmin.sizeUnit.squareMeters'
      );
      expect(SizeUnit.translationKey('UNIT_COUNT')).toBe(
        'propertyAdmin.sizeUnit.unitCount'
      );
      expect(SizeUnit.translationKey('LINEAR_METERS')).toBe(
        'propertyAdmin.sizeUnit.linearMeters'
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
yarn vitest run src/domain/organization/__tests__/SizeUnit.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `SizeUnit`**

Create `src/domain/organization/SizeUnit.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

export type SizeUnitValue =
  | 'SQUARE_METERS'
  | 'SQUARE_FEET'
  | 'HECTARES'
  | 'ACRES'
  | 'CUBIC_METERS'
  | 'LINEAR_METERS'
  | 'UNIT_COUNT'
  | 'SHARES';

const VALUES: SizeUnitValue[] = [
  'SQUARE_METERS',
  'SQUARE_FEET',
  'HECTARES',
  'ACRES',
  'CUBIC_METERS',
  'LINEAR_METERS',
  'UNIT_COUNT',
  'SHARES',
];

function toCamel(v: SizeUnitValue): string {
  const [head, ...rest] = v.toLowerCase().split('_');
  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

export const SizeUnit = {
  values: VALUES,

  parse(value: string): Result<SizeUnitValue, string> {
    if (VALUES.includes(value as SizeUnitValue)) {
      return success(value as SizeUnitValue);
    }
    return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
  },

  translationKey(value: SizeUnitValue): string {
    return `propertyAdmin.sizeUnit.${toCamel(value)}`;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
yarn vitest run src/domain/organization/__tests__/SizeUnit.test.ts
```

Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/SizeUnit.ts src/domain/organization/__tests__/SizeUnit.test.ts
git commit -m "feat(domain): SizeUnit value object"
```

---

## Task 4: Domain — `OrganizationProperty` entity extensions

**Files:**

- Modify: `src/domain/organization/OrganizationProperty.ts`
- Modify: `src/domain/organization/__tests__/OrganizationProperty.test.ts`

- [ ] **Step 1: Extend tests for `sizeUnit`, `rename`, `updateAddress`, `updateSizeUnit`, `unarchive`**

Open `src/domain/organization/__tests__/OrganizationProperty.test.ts`. Replace entire file:

```typescript
import { describe, it, expect } from 'vitest';
import { OrganizationProperty } from '../OrganizationProperty';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const cleanChecker: ProfanityChecker = {
  containsProfanity: (t) => t.includes('badword'),
};

describe('OrganizationProperty', () => {
  describe('create', () => {
    it('creates with name, address, sizeUnit', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Building A',
        '1 Main St',
        'SQUARE_METERS'
      );
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.value.organizationId).toBe('org-1');
        expect(r.value.name).toBe('Building A');
        expect(r.value.address).toBe('1 Main St');
        expect(r.value.sizeUnit).toBe('SQUARE_METERS');
        expect(r.value.archivedAt).toBeNull();
      }
    });

    it('rejects empty name', () => {
      const r = OrganizationProperty.create('org-1', '', null, 'SQUARE_METERS');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
      }
    });

    it('rejects invalid sizeUnit', () => {
      const r = OrganizationProperty.create('org-1', 'Bldg', null, 'FURLONGS');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.SIZE_UNIT_INVALID);
      }
    });

    it('rejects profane name', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'badword tower',
        null,
        'SQUARE_METERS',
        cleanChecker
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });
  });

  describe('rename', () => {
    it('updates the name', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Old',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.rename('New');
      expect(res.success).toBe(true);
      expect(r.value.name).toBe('New');
    });

    it('rejects empty name', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Old',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.rename('');
      expect(res.success).toBe(false);
    });

    it('rejects profane name when checker given', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Old',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.rename('badword', cleanChecker);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });
  });

  describe('updateAddress', () => {
    it('accepts null (clears address)', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        '1 St',
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.updateAddress(null);
      expect(res.success).toBe(true);
      expect(r.value.address).toBeNull();
    });

    it('sets a non-empty address', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.updateAddress('2 St');
      expect(res.success).toBe(true);
      expect(r.value.address).toBe('2 St');
    });
  });

  describe('updateSizeUnit', () => {
    it('accepts a valid unit', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.updateSizeUnit('UNIT_COUNT');
      expect(res.success).toBe(true);
      expect(r.value.sizeUnit).toBe('UNIT_COUNT');
    });

    it('rejects invalid unit', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.updateSizeUnit('FURLONGS');
      expect(res.success).toBe(false);
    });
  });

  describe('archive/unarchive', () => {
    it('archives then unarchives', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'B',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const a = r.value.archive();
      expect(a.success).toBe(true);
      expect(r.value.isArchived()).toBe(true);
      const u = r.value.unarchive();
      expect(u.success).toBe(true);
      expect(r.value.isArchived()).toBe(false);
    });

    it('rejects archive when already archived', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'B',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      r.value.archive();
      const a = r.value.archive();
      expect(a.success).toBe(false);
      if (!a.success) {
        expect(a.error).toBe(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
      }
    });

    it('rejects unarchive when not archived', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'B',
        null,
        'SQUARE_METERS'
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const u = r.value.unarchive();
      expect(u.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests — fail**

```bash
yarn vitest run src/domain/organization/__tests__/OrganizationProperty.test.ts
```

Expected: tests fail (new args, new methods).

- [ ] **Step 3: Rewrite `OrganizationProperty.ts`**

Replace entire contents of `src/domain/organization/OrganizationProperty.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';
import { SizeUnit, SizeUnitValue } from './SizeUnit';

export interface OrganizationPropertyProps {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  sizeUnit: SizeUnitValue;
  createdAt: Date;
  archivedAt: Date | null;
}

export class OrganizationProperty {
  private constructor(private props: OrganizationPropertyProps) {}

  public static create(
    organizationId: string,
    name: string,
    address: string | null,
    sizeUnit: string,
    profanityChecker?: ProfanityChecker
  ): Result<OrganizationProperty, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }

    const unitParse = SizeUnit.parse(sizeUnit);
    if (!unitParse.success) {
      return failure(unitParse.error);
    }

    const trimmedName = name.trim();
    const trimmedAddress =
      address && address.trim().length > 0 ? address.trim() : null;

    if (profanityChecker?.containsProfanity(trimmedName)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    if (trimmedAddress && profanityChecker?.containsProfanity(trimmedAddress)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    return success(
      new OrganizationProperty({
        id: '',
        organizationId,
        name: trimmedName,
        address: trimmedAddress,
        sizeUnit: unitParse.value,
        createdAt: new Date(),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(
    props: OrganizationPropertyProps
  ): OrganizationProperty {
    return new OrganizationProperty(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get organizationId(): string {
    return this.props.organizationId;
  }
  public get name(): string {
    return this.props.name;
  }
  public get address(): string | null {
    return this.props.address;
  }
  public get sizeUnit(): SizeUnitValue {
    return this.props.sizeUnit;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }
  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public rename(
    newName: string,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!newName || newName.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }
    const trimmed = newName.trim();
    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }
    this.props.name = trimmed;
    return success(undefined);
  }

  public updateAddress(
    newAddress: string | null,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    const trimmed =
      newAddress && newAddress.trim().length > 0 ? newAddress.trim() : null;
    if (trimmed && profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }
    this.props.address = trimmed;
    return success(undefined);
  }

  public updateSizeUnit(newUnit: string): Result<void, string> {
    const parsed = SizeUnit.parse(newUnit);
    if (!parsed.success) {
      return failure(parsed.error);
    }
    this.props.sizeUnit = parsed.value;
    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }
    this.props.archivedAt = new Date();
    return success(undefined);
  }

  public unarchive(): Result<void, string> {
    if (!this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_ARCHIVED);
    }
    this.props.archivedAt = null;
    return success(undefined);
  }
}
```

- [ ] **Step 4: Run tests — pass**

```bash
yarn vitest run src/domain/organization/__tests__/OrganizationProperty.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/OrganizationProperty.ts src/domain/organization/__tests__/OrganizationProperty.test.ts
git commit -m "feat(domain): OrganizationProperty sizeUnit + rename/updateAddress/unarchive"
```

---

## Task 5: Domain — `PropertyAsset` entity extensions

**Files:**

- Modify: `src/domain/organization/PropertyAsset.ts`
- Modify: `src/domain/organization/__tests__/PropertyAsset.test.ts`

- [ ] **Step 1: Extend tests — add `rename`, `resize`, `unarchive`, `archive` state errors**

Open `src/domain/organization/__tests__/PropertyAsset.test.ts`. Add (append just before the final `});`):

```typescript
describe('rename', () => {
  it('updates the name', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    const res = r.value.rename('Apt #101');
    expect(res.success).toBe(true);
    expect(r.value.name).toBe('Apt #101');
  });

  it('rejects empty name', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    const res = r.value.rename('  ');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }
  });

  it('rejects profanity', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    const res = r.value.rename('badword', mockProfanityChecker);
    expect(res.success).toBe(false);
  });
});

describe('resize', () => {
  it('updates size when positive', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    const res = r.value.resize(72);
    expect(res.success).toBe(true);
    expect(r.value.size).toBe(72);
  });

  it('rejects zero and negative', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    expect(r.value.resize(0).success).toBe(false);
    expect(r.value.resize(-1).success).toBe(false);
  });
});

describe('archive / unarchive', () => {
  it('rejects double archive', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    const a1 = r.value.archive();
    expect(a1.success).toBe(true);
    const a2 = r.value.archive();
    expect(a2.success).toBe(false);
    if (!a2.success) {
      expect(a2.error).toBe(
        OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED
      );
    }
  });

  it('unarchives', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    r.value.archive();
    const u = r.value.unarchive();
    expect(u.success).toBe(true);
    expect(r.value.isArchived()).toBe(false);
  });

  it('rejects unarchive when not archived', () => {
    const r = PropertyAsset.create('prop-1', 'Apt', 50);
    if (!r.success) {
      throw new Error('setup');
    }
    const u = r.value.unarchive();
    expect(u.success).toBe(false);
    if (!u.success) {
      expect(u.error).toBe(OrganizationDomainCodes.PROPERTY_ASSET_NOT_ARCHIVED);
    }
  });
});
```

Also change the existing `describe('archive', ...)` block's `archive()` call to treat it as returning a Result by deleting the old `describe('archive', ...)` block and the `archive()` call inside it — the new block above covers the case.

- [ ] **Step 2: Run tests — fail**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyAsset.test.ts
```

Expected: tests fail (new methods + archive signature change).

- [ ] **Step 3: Rewrite `PropertyAsset.ts`**

Replace contents of `src/domain/organization/PropertyAsset.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export interface PropertyAssetProps {
  id: string;
  propertyId: string;
  name: string;
  size: number;
  createdAt: Date;
  archivedAt: Date | null;
}

export class PropertyAsset {
  private constructor(private props: PropertyAssetProps) {}

  public static create(
    propertyId: string,
    name: string,
    size: number,
    profanityChecker?: ProfanityChecker
  ): Result<PropertyAsset, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }
    if (!(size > 0)) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }
    const trimmed = name.trim();
    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }
    return success(
      new PropertyAsset({
        id: '',
        propertyId,
        name: trimmed,
        size,
        createdAt: new Date(),
        archivedAt: null,
      })
    );
  }

  public static reconstitute(props: PropertyAssetProps): PropertyAsset {
    return new PropertyAsset(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get propertyId(): string {
    return this.props.propertyId;
  }
  public get name(): string {
    return this.props.name;
  }
  public get size(): number {
    return this.props.size;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }
  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public rename(
    newName: string,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!newName || newName.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }
    const trimmed = newName.trim();
    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }
    this.props.name = trimmed;
    return success(undefined);
  }

  public resize(newSize: number): Result<void, string> {
    if (!(newSize > 0)) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }
    this.props.size = newSize;
    return success(undefined);
  }

  public archive(): Result<void, string> {
    if (this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED);
    }
    this.props.archivedAt = new Date();
    return success(undefined);
  }

  public unarchive(): Result<void, string> {
    if (!this.props.archivedAt) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_ARCHIVED);
    }
    this.props.archivedAt = null;
    return success(undefined);
  }
}
```

- [ ] **Step 4: Run tests — pass**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyAsset.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/PropertyAsset.ts src/domain/organization/__tests__/PropertyAsset.test.ts
git commit -m "feat(domain): PropertyAsset rename/resize/unarchive"
```

---

## Task 6: Domain — `PropertyAssetOwnership` nullable userId + `externalOwnerLabel` + link/correct

**Files:**

- Modify: `src/domain/organization/PropertyAssetOwnership.ts`
- Modify: `src/domain/organization/__tests__/PropertyAssetOwnership.test.ts`

- [ ] **Step 1: Replace tests**

Replace contents of `src/domain/organization/__tests__/PropertyAssetOwnership.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PropertyAssetOwnership } from '../PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('PropertyAssetOwnership', () => {
  describe('createForUser', () => {
    it('creates with userId and share in [0,1]', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.value.userId).toBe('u-1');
        expect(r.value.externalOwnerLabel).toBeNull();
        expect(r.value.share).toBe(0.5);
      }
    });

    it('rejects share > 1', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 1.5);
      expect(r.success).toBe(false);
    });

    it('rejects share < 0', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', -0.1);
      expect(r.success).toBe(false);
    });
  });

  describe('createForExternalOwner', () => {
    it('creates with a non-empty label', () => {
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        'Apartment owner of record',
        1
      );
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.value.userId).toBeNull();
        expect(r.value.externalOwnerLabel).toBe('Apartment owner of record');
        expect(r.value.share).toBe(1);
      }
    });

    it('rejects empty label', () => {
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        '   ',
        1
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY
        );
      }
    });
  });

  describe('link (claim approval)', () => {
    it('fills userId and clears label', () => {
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        'Owner X',
        1
      );
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.link('u-42');
      expect(res.success).toBe(true);
      expect(r.value.userId).toBe('u-42');
      expect(r.value.externalOwnerLabel).toBeNull();
    });

    it('rejects when already linked to a user', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 1);
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.link('u-2');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID
        );
      }
    });

    it('rejects when row is inactive', () => {
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        'X',
        1
      );
      if (!r.success) {
        throw new Error('setup');
      }
      r.value.endEffect(new Date('2026-05-01'));
      const res = r.value.link('u-1');
      expect(res.success).toBe(false);
    });
  });

  describe('correct (SCD-1 in-place share update)', () => {
    it('updates share on an active row', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.correct(0.7);
      expect(res.success).toBe(true);
      expect(r.value.share).toBe(0.7);
    });

    it('rejects out-of-range share', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      if (!r.success) {
        throw new Error('setup');
      }
      expect(r.value.correct(-0.1).success).toBe(false);
      expect(r.value.correct(1.1).success).toBe(false);
    });

    it('rejects when row is inactive', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      if (!r.success) {
        throw new Error('setup');
      }
      r.value.endEffect(new Date('2026-05-01'));
      const res = r.value.correct(0.8);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE
        );
      }
    });
  });

  describe('endEffect', () => {
    it('sets effectiveUntil to a given date', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      if (!r.success) {
        throw new Error('setup');
      }
      const d = new Date('2026-05-01');
      r.value.endEffect(d);
      expect(r.value.effectiveUntil).toEqual(d);
    });

    it('does not overwrite an already-ended row', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      if (!r.success) {
        throw new Error('setup');
      }
      r.value.endEffect(new Date('2026-05-01'));
      r.value.endEffect(new Date('2026-06-01'));
      expect(r.value.effectiveUntil).toEqual(new Date('2026-05-01'));
    });
  });
});
```

- [ ] **Step 2: Run tests — fail**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyAssetOwnership.test.ts
```

Expected: fail (factories renamed, new methods).

- [ ] **Step 3: Rewrite `PropertyAssetOwnership.ts`**

Replace contents:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

export interface PropertyAssetOwnershipProps {
  id: string;
  assetId: string;
  userId: string | null;
  externalOwnerLabel: string | null;
  share: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  createdAt: Date;
}

export class PropertyAssetOwnership {
  private constructor(private props: PropertyAssetOwnershipProps) {}

  public static createForUser(
    assetId: string,
    userId: string,
    share: number
  ): Result<PropertyAssetOwnership, string> {
    if (share < 0 || share > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }
    return success(
      new PropertyAssetOwnership({
        id: '',
        assetId,
        userId,
        externalOwnerLabel: null,
        share,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        createdAt: new Date(),
      })
    );
  }

  public static createForExternalOwner(
    assetId: string,
    label: string,
    share: number
  ): Result<PropertyAssetOwnership, string> {
    if (share < 0 || share > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }
    const trimmed = (label ?? '').trim();
    if (trimmed.length === 0) {
      return failure(OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY);
    }
    return success(
      new PropertyAssetOwnership({
        id: '',
        assetId,
        userId: null,
        externalOwnerLabel: trimmed,
        share,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        createdAt: new Date(),
      })
    );
  }

  public static reconstitute(
    props: PropertyAssetOwnershipProps
  ): PropertyAssetOwnership {
    return new PropertyAssetOwnership(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get assetId(): string {
    return this.props.assetId;
  }
  public get userId(): string | null {
    return this.props.userId;
  }
  public get externalOwnerLabel(): string | null {
    return this.props.externalOwnerLabel;
  }
  public get share(): number {
    return this.props.share;
  }
  public get effectiveFrom(): Date {
    return this.props.effectiveFrom;
  }
  public get effectiveUntil(): Date | null {
    return this.props.effectiveUntil;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public isActive(): boolean {
    return this.props.effectiveUntil === null;
  }

  public endEffect(at: Date): void {
    if (!this.props.effectiveUntil) {
      this.props.effectiveUntil = at;
    }
  }

  public link(userId: string): Result<void, string> {
    if (!this.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }
    if (this.props.userId !== null) {
      return failure(OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID);
    }
    this.props.userId = userId;
    this.props.externalOwnerLabel = null;
    return success(undefined);
  }

  public correct(newShare: number): Result<void, string> {
    if (!this.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }
    if (newShare < 0 || newShare > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
      );
    }
    this.props.share = newShare;
    return success(undefined);
  }
}
```

- [ ] **Step 4: Run tests — pass**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyAssetOwnership.test.ts
```

Expected: all green.

- [ ] **Step 5: Update callers of the renamed factory**

The old `PropertyAssetOwnership.create(assetId, userId, share)` is now `createForUser(...)`. Find and update callers:

```bash
grep -rn "PropertyAssetOwnership\.create\b" src/ --include='*.ts' --include='*.tsx'
```

For each hit that is NOT inside `PropertyAssetOwnership.ts` itself or this new test file, replace `PropertyAssetOwnership.create(` with `PropertyAssetOwnership.createForUser(`. Run `yarn tsc --noEmit` after to confirm.

Expected existing callers (from Weight Distribution PR): `PrismaPropertyAssetRepository.ts` (reconstitute is unaffected — only `.create(` calls). If none, skip.

- [ ] **Step 6: Update `PrismaPropertyAssetRepository.toEntity` for nullable userId**

Open `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`. Inside `findCurrentOwnershipByOrg`'s map callback, the `PropertyAssetOwnership.reconstitute` call currently passes `userId: r.userId`. Since the DB column is now `String?` but existing typed reconstitute expects `string | null`, update:

Change:

```typescript
ownership: PropertyAssetOwnership.reconstitute({
  id: r.id,
  assetId: r.assetId,
  userId: r.userId,
  share: Number(r.share),
  effectiveFrom: r.effectiveFrom,
  effectiveUntil: r.effectiveUntil,
  createdAt: r.createdAt,
}),
```

To:

```typescript
ownership: PropertyAssetOwnership.reconstitute({
  id: r.id,
  assetId: r.assetId,
  userId: r.userId,
  externalOwnerLabel: r.externalOwnerLabel,
  share: Number(r.share),
  effectiveFrom: r.effectiveFrom,
  effectiveUntil: r.effectiveUntil,
  createdAt: r.createdAt,
}),
```

- [ ] **Step 7: Run `tsc` + tests**

```bash
yarn tsc --noEmit
yarn vitest run src/domain/organization
```

Expected: no new tsc errors in touched files; tests green.

- [ ] **Step 8: Commit**

```bash
git add src/domain/organization/PropertyAssetOwnership.ts src/domain/organization/__tests__/PropertyAssetOwnership.test.ts src/infrastructure/repositories/PrismaPropertyAssetRepository.ts
git commit -m "feat(domain): PropertyAssetOwnership nullable userId + externalOwnerLabel + link/correct"
```

---

## Task 7: Domain — `PropertyClaim` entity

**Files:**

- Create: `src/domain/organization/PropertyClaim.ts`
- Create: `src/domain/organization/__tests__/PropertyClaim.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/domain/organization/__tests__/PropertyClaim.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PropertyClaim } from '../PropertyClaim';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const checker: ProfanityChecker = {
  containsProfanity: (t) => t.includes('badword'),
};

describe('PropertyClaim', () => {
  describe('submit', () => {
    it('creates a PENDING claim', () => {
      const r = PropertyClaim.submit('org-1', 'user-1', 'asset-1');
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.value.status).toBe('PENDING');
        expect(r.value.deniedReason).toBeNull();
        expect(r.value.decidedBy).toBeNull();
        expect(r.value.decidedAt).toBeNull();
      }
    });
  });

  describe('approve', () => {
    it('transitions PENDING → APPROVED and stores admin + timestamp', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      const at = new Date('2026-05-01T10:00:00Z');
      const res = r.value.approve('admin-1', at);
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('APPROVED');
      expect(r.value.decidedBy).toBe('admin-1');
      expect(r.value.decidedAt).toEqual(at);
    });

    it('rejects when not pending', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      r.value.approve('admin-1', new Date());
      const res = r.value.approve('admin-2', new Date());
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING
        );
      }
    });
  });

  describe('deny', () => {
    it('transitions PENDING → DENIED with reason', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.deny('admin-1', 'Cannot verify', new Date());
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('DENIED');
      expect(r.value.deniedReason).toBe('Cannot verify');
    });

    it('rejects empty reason', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.deny('admin-1', '   ', new Date());
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
        );
      }
    });

    it('rejects profane reason', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.deny(
        'admin-1',
        'badword reason',
        new Date(),
        checker
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('rejects deny when not pending', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      r.value.approve('admin-1', new Date());
      const res = r.value.deny('admin-2', 'no', new Date());
      expect(res.success).toBe(false);
    });
  });

  describe('autoDeny', () => {
    it('transitions PENDING → DENIED without admin', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      const res = r.value.autoDeny('asset archived', new Date());
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('DENIED');
      expect(r.value.deniedReason).toBe('asset archived');
      expect(r.value.decidedBy).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyClaim.test.ts
```

- [ ] **Step 3: Implement `PropertyClaim`**

Create `src/domain/organization/PropertyClaim.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';
import { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../shared/SharedDomainCodes';

export type PropertyClaimStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface PropertyClaimProps {
  id: string;
  organizationId: string;
  userId: string;
  assetId: string;
  status: PropertyClaimStatus;
  deniedReason: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export class PropertyClaim {
  private constructor(private props: PropertyClaimProps) {}

  public static submit(
    organizationId: string,
    userId: string,
    assetId: string
  ): Result<PropertyClaim, string> {
    return success(
      new PropertyClaim({
        id: '',
        organizationId,
        userId,
        assetId,
        status: 'PENDING',
        deniedReason: null,
        decidedBy: null,
        decidedAt: null,
        createdAt: new Date(),
      })
    );
  }

  public static reconstitute(props: PropertyClaimProps): PropertyClaim {
    return new PropertyClaim(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get organizationId(): string {
    return this.props.organizationId;
  }
  public get userId(): string {
    return this.props.userId;
  }
  public get assetId(): string {
    return this.props.assetId;
  }
  public get status(): PropertyClaimStatus {
    return this.props.status;
  }
  public get deniedReason(): string | null {
    return this.props.deniedReason;
  }
  public get decidedBy(): string | null {
    return this.props.decidedBy;
  }
  public get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public isPending(): boolean {
    return this.props.status === 'PENDING';
  }

  public approve(adminUserId: string, at: Date): Result<void, string> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }
    this.props.status = 'APPROVED';
    this.props.decidedBy = adminUserId;
    this.props.decidedAt = at;
    return success(undefined);
  }

  public deny(
    adminUserId: string,
    reason: string,
    at: Date,
    profanityChecker?: ProfanityChecker
  ): Result<void, string> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }
    const trimmed = (reason ?? '').trim();
    if (trimmed.length === 0) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }
    if (profanityChecker?.containsProfanity(trimmed)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }
    this.props.status = 'DENIED';
    this.props.deniedReason = trimmed;
    this.props.decidedBy = adminUserId;
    this.props.decidedAt = at;
    return success(undefined);
  }

  public autoDeny(reason: string, at: Date): Result<void, string> {
    if (!this.isPending()) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING);
    }
    this.props.status = 'DENIED';
    this.props.deniedReason = reason;
    this.props.decidedBy = null;
    this.props.decidedAt = at;
    return success(undefined);
  }
}
```

- [ ] **Step 4: Run — pass**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyClaim.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/PropertyClaim.ts src/domain/organization/__tests__/PropertyClaim.test.ts
git commit -m "feat(domain): PropertyClaim entity (submit/approve/deny/autoDeny)"
```

---

## Task 8: Domain — `PropertyLockService` pure service

**Files:**

- Create: `src/domain/organization/PropertyLockService.ts`
- Create: `src/domain/organization/__tests__/PropertyLockService.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/domain/organization/__tests__/PropertyLockService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PropertyLockService, LockSnapshotFact } from '../PropertyLockService';

// Snapshot fact = one row that would justify locking:
//   explicitScopePropertyIds: which properties the poll scoped (empty = all-scope)
//   distributionType: 'EQUAL' or ownership mode
// A fact is relevant for property P iff the poll's snapshot would use P's ownership data.

describe('PropertyLockService', () => {
  const svc = new PropertyLockService();

  it('returns false when no snapshot facts involve the property', () => {
    const facts: LockSnapshotFact[] = [];
    expect(svc.isLocked('prop-a', facts)).toBe(false);
  });

  it('locks when a poll with explicit scope on property has snapshots (ownership mode)', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: ['prop-a'],
        distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
    expect(svc.isLocked('prop-b', facts)).toBe(false);
  });

  it('locks every property when ownership poll has empty scope (all properties)', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: [],
        distributionType: 'OWNERSHIP_UNIT_COUNT',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
    expect(svc.isLocked('prop-zzz', facts)).toBe(true);
  });

  it('locks property when EQUAL poll with explicit scope includes it', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: ['prop-a'],
        distributionType: 'EQUAL',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
  });

  it('does NOT lock properties when an EQUAL poll has empty scope', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: [],
        distributionType: 'EQUAL',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(false);
  });

  it('combines multiple facts (any matching fact locks)', () => {
    const facts: LockSnapshotFact[] = [
      {
        explicitScopePropertyIds: [],
        distributionType: 'EQUAL',
      },
      {
        explicitScopePropertyIds: ['prop-a'],
        distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
      },
    ];
    expect(svc.isLocked('prop-a', facts)).toBe(true);
    expect(svc.isLocked('prop-b', facts)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyLockService.test.ts
```

- [ ] **Step 3: Implement `PropertyLockService`**

Create `src/domain/organization/PropertyLockService.ts`:

```typescript
// Pure service: given snapshot facts for an org, decide whether a property is "locked"
// (its ownership data was frozen into at least one poll snapshot).
//
// The PropertyLockRepository (infrastructure) is responsible for producing these facts
// from (polls ⨝ poll_properties ⨝ poll_eligible_members). This service decides the
// lock logic from the facts alone — no DB coupling.
//
// Spec: readmes/2026-04-19-property-admin-design.md — "Property lock" section.

export interface LockSnapshotFact {
  // Empty = the poll's scope was "all properties".
  explicitScopePropertyIds: string[];
  // 'EQUAL' or one of the ownership-based types.
  distributionType: string;
}

export class PropertyLockService {
  isLocked(propertyId: string, facts: LockSnapshotFact[]): boolean {
    for (const f of facts) {
      if (this.factLocksProperty(propertyId, f)) {
        return true;
      }
    }
    return false;
  }

  private factLocksProperty(
    propertyId: string,
    fact: LockSnapshotFact
  ): boolean {
    const explicitMatch = fact.explicitScopePropertyIds.includes(propertyId);
    const isEqual = fact.distributionType === 'EQUAL';

    // Ownership poll + explicit scope includes property → locked
    if (!isEqual && explicitMatch) {
      return true;
    }

    // Ownership poll + empty scope (all properties) → locked
    if (!isEqual && fact.explicitScopePropertyIds.length === 0) {
      return true;
    }

    // EQUAL poll + explicit scope includes property → locked (ownership used as eligibility filter)
    if (isEqual && explicitMatch) {
      return true;
    }

    // EQUAL poll + empty scope → ownership never consulted → NOT locked
    return false;
  }
}
```

- [ ] **Step 4: Run — pass**

```bash
yarn vitest run src/domain/organization/__tests__/PropertyLockService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/PropertyLockService.ts src/domain/organization/__tests__/PropertyLockService.test.ts
git commit -m "feat(domain): PropertyLockService pure logic"
```

---

## Task 9: Domain — Repository ports (extend + new)

**Files:**

- Modify: `src/domain/organization/OrganizationPropertyRepository.ts`
- Modify: `src/domain/organization/PropertyAssetRepository.ts`
- Create: `src/domain/organization/PropertyClaimRepository.ts`
- Create: `src/domain/organization/PropertyLockRepository.ts`

- [ ] **Step 1: Extend `OrganizationPropertyRepository`**

Replace contents of `src/domain/organization/OrganizationPropertyRepository.ts`:

```typescript
import { Result } from '../shared/Result';
import { OrganizationProperty } from './OrganizationProperty';

export interface OrganizationPropertyRepository {
  findByOrganization(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>>;
  findAllByOrganizationIncludingArchived(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>>;
  findById(id: string): Promise<Result<OrganizationProperty | null, string>>;
  countNonArchived(organizationId: string): Promise<Result<number, string>>;
  hasAnyNonArchived(
    organizationIds: string[]
  ): Promise<Result<Map<string, boolean>, string>>;

  save(
    property: OrganizationProperty
  ): Promise<Result<OrganizationProperty, string>>;
  update(property: OrganizationProperty): Promise<Result<void, string>>;
}
```

- [ ] **Step 2: Extend `PropertyAssetRepository`**

Replace contents of `src/domain/organization/PropertyAssetRepository.ts`:

```typescript
import { Result } from '../shared/Result';
import { PropertyAsset } from './PropertyAsset';
import { PropertyAssetOwnership } from './PropertyAssetOwnership';

export interface AssetOwnershipRow {
  asset: PropertyAsset;
  ownership: PropertyAssetOwnership;
}

export interface OwnershipRowToInsert {
  userId: string | null;
  externalOwnerLabel: string | null;
  share: number;
}

export interface AllOwnershipRow {
  id: string;
  assetId: string;
  assetName: string;
  propertyId: string;
  propertyName: string;
  userId: string | null;
  externalOwnerLabel: string | null;
  share: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

export interface AllOwnershipFilter {
  organizationId: string;
  activeOnly: boolean;
  userId?: string;
  assetId?: string;
  propertyId?: string;
}

export interface PropertyAssetRepository {
  findCurrentOwnershipByOrg(
    organizationId: string,
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>>;

  orgHasOwnershipData(organizationId: string): Promise<Result<boolean, string>>;

  hasUserOwnership(
    organizationId: string,
    userId: string
  ): Promise<Result<boolean, string>>;

  // Read: list assets for admin
  findAssetsByProperty(
    propertyId: string,
    includeArchived: boolean
  ): Promise<Result<PropertyAsset[], string>>;

  findAssetById(assetId: string): Promise<Result<PropertyAsset | null, string>>;

  findActiveOwnershipForAsset(
    assetId: string
  ): Promise<Result<PropertyAssetOwnership[], string>>;

  findOwnershipById(
    ownershipId: string
  ): Promise<Result<PropertyAssetOwnership | null, string>>;

  // Flat cross-property ownership query for admin ManageOwnership page.
  findOwnershipRows(
    filter: AllOwnershipFilter
  ): Promise<Result<AllOwnershipRow[], string>>;

  findClaimableAssets(
    propertyId: string
  ): Promise<Result<{ id: string; name: string }[], string>>;

  // Write: assets
  saveAsset(asset: PropertyAsset): Promise<Result<PropertyAsset, string>>;
  updateAsset(asset: PropertyAsset): Promise<Result<void, string>>;

  // Atomic batch ownership replace. End-dates all currently active rows for
  // `assetId` at `at` and inserts `inserts`. Returns failure if any row fails.
  replaceOwners(input: {
    assetId: string;
    at: Date;
    inserts: OwnershipRowToInsert[];
  }): Promise<Result<void, string>>;

  // SCD-1 in-place share update.
  correctOwnership(input: {
    ownershipId: string;
    newShare: number;
  }): Promise<Result<void, string>>;

  // Claim-approval link: set userId, clear externalOwnerLabel in place.
  linkOwnershipToUser(input: {
    ownershipId: string;
    userId: string;
  }): Promise<Result<void, string>>;
}
```

- [ ] **Step 3: Create `PropertyClaimRepository`**

Create `src/domain/organization/PropertyClaimRepository.ts`:

```typescript
import { Result } from '../shared/Result';
import { PropertyClaim } from './PropertyClaim';

export interface PendingClaimListRow {
  claim: PropertyClaim;
  claimantFirstName: string;
  claimantLastName: string;
  claimantMiddleName: string | null;
  assetName: string;
  propertyId: string;
  propertyName: string;
  externalOwnerLabel: string | null;
}

export interface MyClaimListRow {
  claim: PropertyClaim;
  assetName: string;
}

export interface PropertyClaimRepository {
  save(claim: PropertyClaim): Promise<Result<PropertyClaim, string>>;
  update(claim: PropertyClaim): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<PropertyClaim | null, string>>;

  findPendingForAsset(
    assetId: string
  ): Promise<Result<PropertyClaim[], string>>;

  findLatestDecidedForUserAndAsset(
    userId: string,
    assetId: string
  ): Promise<Result<PropertyClaim | null, string>>;

  findPendingForOrg(
    organizationId: string
  ): Promise<Result<PendingClaimListRow[], string>>;

  findMyClaimsForProperty(
    userId: string,
    propertyId: string
  ): Promise<Result<MyClaimListRow[], string>>;

  findPendingForAssets(
    assetIds: string[]
  ): Promise<Result<PropertyClaim[], string>>;

  getOrgAdminUserIds(organizationId: string): Promise<Result<string[], string>>;
}
```

- [ ] **Step 4: Create `PropertyLockRepository`**

Create `src/domain/organization/PropertyLockRepository.ts`:

```typescript
import { Result } from '../shared/Result';
import { LockSnapshotFact } from './PropertyLockService';

export interface PropertyLockRepository {
  // Returns every snapshot fact for the organization: one row per (poll that has
  // at least one poll_eligible_members row). Used by PropertyLockService.
  findSnapshotFactsForOrg(
    organizationId: string
  ): Promise<Result<LockSnapshotFact[], string>>;
}
```

- [ ] **Step 5: `tsc` check**

```bash
yarn tsc --noEmit
```

Expected: no new errors in the new files (callers of old shapes will be updated in later tasks).

- [ ] **Step 6: Commit**

```bash
git add src/domain/organization/OrganizationPropertyRepository.ts src/domain/organization/PropertyAssetRepository.ts src/domain/organization/PropertyClaimRepository.ts src/domain/organization/PropertyLockRepository.ts
git commit -m "feat(domain): extend org/asset repos; add claim + lock repository ports"
```

---

## Task 10: Infrastructure — extend `PrismaOrganizationPropertyRepository`

**Files:**

- Modify: `src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts`

- [ ] **Step 1: Replace with full implementation**

Replace entire contents:

```typescript
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { SizeUnitValue } from '../../domain/organization/SizeUnit';

export class PrismaOrganizationPropertyRepository implements OrganizationPropertyRepository {
  constructor(private prisma: PrismaClient) {}

  async findByOrganization(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>> {
    try {
      const rows = await this.prisma.organizationProperty.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findAllByOrganizationIncludingArchived(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>> {
    try {
      const rows = await this.prisma.organizationProperty.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(
    id: string
  ): Promise<Result<OrganizationProperty | null, string>> {
    try {
      const row = await this.prisma.organizationProperty.findUnique({
        where: { id },
      });
      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async countNonArchived(
    organizationId: string
  ): Promise<Result<number, string>> {
    try {
      const n = await this.prisma.organizationProperty.count({
        where: { organizationId, archivedAt: null },
      });
      return success(n);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async hasAnyNonArchived(
    organizationIds: string[]
  ): Promise<Result<Map<string, boolean>, string>> {
    try {
      if (organizationIds.length === 0) {
        return success(new Map());
      }
      const rows = await this.prisma.organizationProperty.groupBy({
        by: ['organizationId'],
        where: {
          organizationId: { in: organizationIds },
          archivedAt: null,
        },
        _count: { _all: true },
      });
      const map = new Map<string, boolean>();
      for (const id of organizationIds) {
        map.set(id, false);
      }
      for (const r of rows) {
        map.set(r.organizationId, r._count._all > 0);
      }
      return success(map);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async save(
    property: OrganizationProperty
  ): Promise<Result<OrganizationProperty, string>> {
    try {
      const created = await this.prisma.organizationProperty.create({
        data: {
          organizationId: property.organizationId,
          name: property.name,
          address: property.address,
          sizeUnit: property.sizeUnit,
        },
      });
      return success(this.toEntity(created));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async update(property: OrganizationProperty): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Cascade archive/unarchive across non-archived assets:
        // if property transitions to archived, we let the caller handle asset archive
        // (see ArchivePropertyUseCase). Here we simply write the property row.
        await tx.organizationProperty.update({
          where: { id: property.id },
          data: {
            name: property.name,
            address: property.address,
            sizeUnit: property.sizeUnit,
            archivedAt: property.archivedAt,
          },
        });
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  private toEntity(row: {
    id: string;
    organizationId: string;
    name: string;
    address: string | null;
    sizeUnit: string;
    createdAt: Date;
    archivedAt: Date | null;
  }): OrganizationProperty {
    return OrganizationProperty.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      address: row.address,
      sizeUnit: row.sizeUnit as SizeUnitValue,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    });
  }
}
```

- [ ] **Step 2: `tsc` check**

```bash
yarn tsc --noEmit src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts
git commit -m "feat(infra): property repo write ops + sizeUnit + hasAnyNonArchived"
```

---

## Task 11: Infrastructure — extend `PrismaPropertyAssetRepository`

**Files:**

- Modify: `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`

- [ ] **Step 1: Replace with full implementation**

Replace entire contents:

```typescript
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../domain/organization/PropertyAssetOwnership';
import {
  PropertyAssetRepository,
  AssetOwnershipRow,
  AllOwnershipRow,
  AllOwnershipFilter,
  OwnershipRowToInsert,
} from '../../domain/organization/PropertyAssetRepository';

export class PrismaPropertyAssetRepository implements PropertyAssetRepository {
  constructor(private prisma: PrismaClient) {}

  async findCurrentOwnershipByOrg(
    organizationId: string,
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>> {
    try {
      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        effectiveUntil: null,
        asset: {
          archivedAt: null,
          property: {
            archivedAt: null,
            organizationId,
            ...(propertyIds.length > 0 ? { id: { in: propertyIds } } : {}),
          },
        },
      };
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: { asset: true },
      });
      return success(
        rows.map((r) => ({
          asset: PropertyAsset.reconstitute({
            id: r.asset.id,
            propertyId: r.asset.propertyId,
            name: r.asset.name,
            size: Number(r.asset.size),
            createdAt: r.asset.createdAt,
            archivedAt: r.asset.archivedAt,
          }),
          ownership: PropertyAssetOwnership.reconstitute({
            id: r.id,
            assetId: r.assetId,
            userId: r.userId,
            externalOwnerLabel: r.externalOwnerLabel,
            share: Number(r.share),
            effectiveFrom: r.effectiveFrom,
            effectiveUntil: r.effectiveUntil,
            createdAt: r.createdAt,
          }),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async orgHasOwnershipData(
    organizationId: string
  ): Promise<Result<boolean, string>> {
    try {
      const row = await this.prisma.propertyAssetOwnership.findFirst({
        where: {
          effectiveUntil: null,
          asset: {
            archivedAt: null,
            property: { archivedAt: null, organizationId },
          },
        },
        select: { id: true },
      });
      return success(row !== null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async hasUserOwnership(
    organizationId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    try {
      const row = await this.prisma.propertyAssetOwnership.findFirst({
        where: {
          effectiveUntil: null,
          userId,
          asset: {
            archivedAt: null,
            property: { archivedAt: null, organizationId },
          },
        },
        select: { id: true },
      });
      return success(row !== null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findAssetsByProperty(
    propertyId: string,
    includeArchived: boolean
  ): Promise<Result<PropertyAsset[], string>> {
    try {
      const rows = await this.prisma.propertyAsset.findMany({
        where: {
          propertyId,
          ...(includeArchived ? {} : { archivedAt: null }),
        },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows.map((r) => this.assetToEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findAssetById(
    assetId: string
  ): Promise<Result<PropertyAsset | null, string>> {
    try {
      const row = await this.prisma.propertyAsset.findUnique({
        where: { id: assetId },
      });
      return success(row ? this.assetToEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findActiveOwnershipForAsset(
    assetId: string
  ): Promise<Result<PropertyAssetOwnership[], string>> {
    try {
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where: { assetId, effectiveUntil: null },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows.map((r) => this.ownershipToEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findOwnershipById(
    ownershipId: string
  ): Promise<Result<PropertyAssetOwnership | null, string>> {
    try {
      const row = await this.prisma.propertyAssetOwnership.findUnique({
        where: { id: ownershipId },
      });
      return success(row ? this.ownershipToEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findOwnershipRows(
    filter: AllOwnershipFilter
  ): Promise<Result<AllOwnershipRow[], string>> {
    try {
      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        asset: {
          property: { organizationId: filter.organizationId },
          ...(filter.assetId ? { id: filter.assetId } : {}),
          ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
        },
        ...(filter.activeOnly ? { effectiveUntil: null } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
      };
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: {
          asset: { include: { property: true } },
        },
        orderBy: [{ effectiveFrom: 'desc' }],
      });
      return success(
        rows.map((r) => ({
          id: r.id,
          assetId: r.assetId,
          assetName: r.asset.name,
          propertyId: r.asset.propertyId,
          propertyName: r.asset.property.name,
          userId: r.userId,
          externalOwnerLabel: r.externalOwnerLabel,
          share: Number(r.share),
          effectiveFrom: r.effectiveFrom,
          effectiveUntil: r.effectiveUntil,
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findClaimableAssets(
    propertyId: string
  ): Promise<Result<{ id: string; name: string }[], string>> {
    try {
      // "Claimable" = non-archived asset with at least one active ownership row
      // whose user_id IS NULL (= external_owner_label set).
      const rows = await this.prisma.propertyAsset.findMany({
        where: {
          propertyId,
          archivedAt: null,
          ownerships: {
            some: {
              effectiveUntil: null,
              userId: null,
            },
          },
        },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async saveAsset(
    asset: PropertyAsset
  ): Promise<Result<PropertyAsset, string>> {
    try {
      const created = await this.prisma.propertyAsset.create({
        data: {
          propertyId: asset.propertyId,
          name: asset.name,
          size: new Prisma.Decimal(asset.size.toString()),
        },
      });
      return success(this.assetToEntity(created));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async updateAsset(asset: PropertyAsset): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAsset.update({
        where: { id: asset.id },
        data: {
          name: asset.name,
          size: new Prisma.Decimal(asset.size.toString()),
          archivedAt: asset.archivedAt,
        },
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async replaceOwners(input: {
    assetId: string;
    at: Date;
    inserts: OwnershipRowToInsert[];
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.propertyAssetOwnership.updateMany({
          where: { assetId: input.assetId, effectiveUntil: null },
          data: { effectiveUntil: input.at },
        });
        if (input.inserts.length > 0) {
          await tx.propertyAssetOwnership.createMany({
            data: input.inserts.map((r) => ({
              assetId: input.assetId,
              userId: r.userId,
              externalOwnerLabel: r.externalOwnerLabel,
              share: new Prisma.Decimal(r.share.toString()),
              effectiveFrom: input.at,
            })),
          });
        }
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async correctOwnership(input: {
    ownershipId: string;
    newShare: number;
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAssetOwnership.update({
        where: { id: input.ownershipId },
        data: { share: new Prisma.Decimal(input.newShare.toString()) },
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async linkOwnershipToUser(input: {
    ownershipId: string;
    userId: string;
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAssetOwnership.update({
        where: { id: input.ownershipId },
        data: { userId: input.userId, externalOwnerLabel: null },
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  private assetToEntity(row: {
    id: string;
    propertyId: string;
    name: string;
    size: Prisma.Decimal;
    createdAt: Date;
    archivedAt: Date | null;
  }): PropertyAsset {
    return PropertyAsset.reconstitute({
      id: row.id,
      propertyId: row.propertyId,
      name: row.name,
      size: Number(row.size),
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    });
  }

  private ownershipToEntity(row: {
    id: string;
    assetId: string;
    userId: string | null;
    externalOwnerLabel: string | null;
    share: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
    createdAt: Date;
  }): PropertyAssetOwnership {
    return PropertyAssetOwnership.reconstitute({
      id: row.id,
      assetId: row.assetId,
      userId: row.userId,
      externalOwnerLabel: row.externalOwnerLabel,
      share: Number(row.share),
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      createdAt: row.createdAt,
    });
  }
}
```

- [ ] **Step 2: `tsc` check**

```bash
yarn tsc --noEmit
```

Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/PrismaPropertyAssetRepository.ts
git commit -m "feat(infra): asset repo CRUD + replaceOwners + correctOwnership + linkOwnershipToUser"
```

---

## Task 12: Infrastructure — `PrismaPropertyClaimRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaPropertyClaimRepository.ts`
- Modify: `src/infrastructure/index.ts`

- [ ] **Step 1: Create the file**

```typescript
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  PropertyClaim,
  PropertyClaimStatus,
} from '../../domain/organization/PropertyClaim';
import {
  PropertyClaimRepository,
  PendingClaimListRow,
  MyClaimListRow,
} from '../../domain/organization/PropertyClaimRepository';

export class PrismaPropertyClaimRepository implements PropertyClaimRepository {
  constructor(private prisma: PrismaClient) {}

  async save(claim: PropertyClaim): Promise<Result<PropertyClaim, string>> {
    try {
      const created = await this.prisma.propertyClaim.create({
        data: {
          organizationId: claim.organizationId,
          userId: claim.userId,
          assetId: claim.assetId,
          status: claim.status,
          deniedReason: claim.deniedReason,
          decidedBy: claim.decidedBy,
          decidedAt: claim.decidedAt,
        },
      });
      return success(this.toEntity(created));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async update(claim: PropertyClaim): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyClaim.update({
        where: { id: claim.id },
        data: {
          status: claim.status,
          deniedReason: claim.deniedReason,
          decidedBy: claim.decidedBy,
          decidedAt: claim.decidedAt,
        },
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(id: string): Promise<Result<PropertyClaim | null, string>> {
    try {
      const row = await this.prisma.propertyClaim.findUnique({ where: { id } });
      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findPendingForAsset(
    assetId: string
  ): Promise<Result<PropertyClaim[], string>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: { assetId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findLatestDecidedForUserAndAsset(
    userId: string,
    assetId: string
  ): Promise<Result<PropertyClaim | null, string>> {
    try {
      const row = await this.prisma.propertyClaim.findFirst({
        where: {
          userId,
          assetId,
          status: { in: ['APPROVED', 'DENIED'] },
        },
        orderBy: { decidedAt: 'desc' },
      });
      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findPendingForOrg(
    organizationId: string
  ): Promise<Result<PendingClaimListRow[], string>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: { organizationId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: true,
          asset: {
            include: {
              property: true,
              ownerships: {
                where: { effectiveUntil: null, userId: null },
                select: { externalOwnerLabel: true },
              },
            },
          },
        },
      });
      return success(
        rows.map((r) => ({
          claim: this.toEntity(r),
          claimantFirstName: r.user.firstName,
          claimantLastName: r.user.lastName,
          claimantMiddleName: r.user.middleName,
          assetName: r.asset.name,
          propertyId: r.asset.propertyId,
          propertyName: r.asset.property.name,
          externalOwnerLabel: r.asset.ownerships[0]?.externalOwnerLabel ?? null,
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findMyClaimsForProperty(
    userId: string,
    propertyId: string
  ): Promise<Result<MyClaimListRow[], string>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: {
          userId,
          asset: { propertyId },
        },
        orderBy: { createdAt: 'desc' },
        include: { asset: { select: { name: true } } },
      });
      return success(
        rows.map((r) => ({
          claim: this.toEntity(r),
          assetName: r.asset.name,
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findPendingForAssets(
    assetIds: string[]
  ): Promise<Result<PropertyClaim[], string>> {
    try {
      if (assetIds.length === 0) {
        return success([]);
      }
      const rows = await this.prisma.propertyClaim.findMany({
        where: { assetId: { in: assetIds }, status: 'PENDING' },
      });
      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async getOrgAdminUserIds(
    organizationId: string
  ): Promise<Result<string[], string>> {
    try {
      const rows = await this.prisma.organizationAdminUser.findMany({
        where: { organizationId },
        select: { userId: true },
      });
      return success(rows.map((r) => r.userId));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  private toEntity(row: {
    id: string;
    organizationId: string;
    userId: string;
    assetId: string;
    status: string;
    deniedReason: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
    createdAt: Date;
  }): PropertyClaim {
    return PropertyClaim.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      assetId: row.assetId,
      status: row.status as PropertyClaimStatus,
      deniedReason: row.deniedReason,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
    });
  }
}
```

- [ ] **Step 2: Export from `src/infrastructure/index.ts`**

Open `src/infrastructure/index.ts`. Find the repositories export block and add:

```typescript
export { PrismaPropertyClaimRepository } from './repositories/PrismaPropertyClaimRepository';
```

- [ ] **Step 3: `tsc` check + commit**

```bash
yarn tsc --noEmit
git add src/infrastructure/repositories/PrismaPropertyClaimRepository.ts src/infrastructure/index.ts
git commit -m "feat(infra): PrismaPropertyClaimRepository"
```

---

## Task 13: Infrastructure — `PrismaPropertyLockRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaPropertyLockRepository.ts`
- Modify: `src/infrastructure/index.ts`

- [ ] **Step 1: Create the file**

```typescript
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyLockRepository } from '../../domain/organization/PropertyLockRepository';
import { LockSnapshotFact } from '../../domain/organization/PropertyLockService';

export class PrismaPropertyLockRepository implements PropertyLockRepository {
  constructor(private prisma: PrismaClient) {}

  async findSnapshotFactsForOrg(
    organizationId: string
  ): Promise<Result<LockSnapshotFact[], string>> {
    try {
      // A snapshot fact exists for every poll in the org that has at least one
      // row in poll_eligible_members (i.e. TakeSnapshot has run for it).
      const polls = await this.prisma.poll.findMany({
        where: {
          organizationId,
          eligibleMembers: { some: {} },
        },
        select: {
          distributionType: true,
          properties: { select: { propertyId: true } },
        },
      });
      return success(
        polls.map((p) => ({
          distributionType: p.distributionType,
          explicitScopePropertyIds: p.properties.map((x) => x.propertyId),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }
}
```

- [ ] **Step 2: Export from `src/infrastructure/index.ts`**

Add to the repositories export block:

```typescript
export { PrismaPropertyLockRepository } from './repositories/PrismaPropertyLockRepository';
```

- [ ] **Step 3: `tsc` check + commit**

```bash
yarn tsc --noEmit
git add src/infrastructure/repositories/PrismaPropertyLockRepository.ts src/infrastructure/index.ts
git commit -m "feat(infra): PrismaPropertyLockRepository"
```

---

## Task 14: Application — Property CRUD use cases

**Files:**

- Create: `src/application/organization/CreatePropertyUseCase.ts`
- Create: `src/application/organization/UpdatePropertyUseCase.ts`
- Create: `src/application/organization/ArchivePropertyUseCase.ts`
- Create: `src/application/organization/UnarchivePropertyUseCase.ts`
- Create: `src/application/organization/__tests__/CreatePropertyUseCase.test.ts`
- Create: `src/application/organization/__tests__/UpdatePropertyUseCase.test.ts`
- Create: `src/application/organization/__tests__/ArchivePropertyUseCase.test.ts`
- Create: `src/application/organization/__tests__/UnarchivePropertyUseCase.test.ts`

- [ ] **Step 1: Create `CreatePropertyUseCase`**

```typescript
// src/application/organization/CreatePropertyUseCase.ts
import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface CreatePropertyInput {
  organizationId: string;
  adminUserId: string;
  name: string;
  address: string | null;
  sizeUnit: string;
}

export interface CreatePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class CreatePropertyUseCase {
  constructor(private deps: CreatePropertyDependencies) {}

  async execute(
    input: CreatePropertyInput
  ): Promise<Result<{ property: OrganizationProperty }, string>> {
    const isAuthorized = await this.authorize(
      input.adminUserId,
      input.organizationId
    );
    if (!isAuthorized) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const created = OrganizationProperty.create(
      input.organizationId,
      input.name,
      input.address,
      input.sizeUnit,
      this.deps.profanityChecker
    );
    if (!created.success) {
      return failure(created.error);
    }

    const saved = await this.deps.propertyRepository.save(created.value);
    if (!saved.success) {
      return failure(saved.error);
    }

    return success({ property: saved.value });
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 2: Create `CreatePropertyUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/CreatePropertyUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { CreatePropertyUseCase } from '../CreatePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success, failure } from '../../../domain/shared/Result';

const mkDeps = (
  overrides: Partial<{
    isAdmin: boolean;
    isSuperAdmin: boolean;
    save: 'ok' | 'err';
  }> = {}
) => {
  const cfg = {
    isAdmin: true,
    isSuperAdmin: false,
    save: 'ok' as 'ok' | 'err',
    ...overrides,
  };
  const saved: OrganizationProperty[] = [];
  const deps = {
    propertyRepository: {
      save: async (p: OrganizationProperty) => {
        saved.push(p);
        return cfg.save === 'ok' ? success(p) : failure('db');
      },
    } as any,
    organizationRepository: {
      isUserAdmin: async () => cfg.isAdmin,
    } as any,
    userRepository: {
      isSuperAdmin: async () => cfg.isSuperAdmin,
    } as any,
    profanityChecker: { containsProfanity: () => false },
  };
  return { deps, saved };
};

describe('CreatePropertyUseCase', () => {
  it('creates a property when user is org admin', async () => {
    const { deps, saved } = mkDeps();
    const uc = new CreatePropertyUseCase(deps);
    const r = await uc.execute({
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      name: 'Building A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
    });
    expect(r.success).toBe(true);
    expect(saved.length).toBe(1);
  });

  it('rejects non-admin, non-superadmin', async () => {
    const { deps } = mkDeps({ isAdmin: false, isSuperAdmin: false });
    const uc = new CreatePropertyUseCase(deps);
    const r = await uc.execute({
      organizationId: 'org-1',
      adminUserId: 'u',
      name: 'B',
      address: null,
      sizeUnit: 'SQUARE_METERS',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('rejects invalid size unit', async () => {
    const { deps } = mkDeps();
    const uc = new CreatePropertyUseCase(deps);
    const r = await uc.execute({
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      name: 'B',
      address: null,
      sizeUnit: 'FURLONGS',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.SIZE_UNIT_INVALID);
    }
  });
});
```

- [ ] **Step 3: Create `UpdatePropertyUseCase`**

```typescript
// src/application/organization/UpdatePropertyUseCase.ts
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UpdatePropertyInput {
  propertyId: string;
  adminUserId: string;
  name?: string;
  address?: string | null;
  sizeUnit?: string;
}

export interface UpdatePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class UpdatePropertyUseCase {
  constructor(private deps: UpdatePropertyDependencies) {}

  async execute(input: UpdatePropertyInput): Promise<Result<void, string>> {
    const found = await this.deps.propertyRepository.findById(input.propertyId);
    if (!found.success) {
      return failure(found.error);
    }
    if (!found.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
    const property = found.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    if (input.name !== undefined) {
      const r = property.rename(input.name, this.deps.profanityChecker);
      if (!r.success) {
        return failure(r.error);
      }
    }
    if (input.address !== undefined) {
      const r = property.updateAddress(
        input.address,
        this.deps.profanityChecker
      );
      if (!r.success) {
        return failure(r.error);
      }
    }
    if (input.sizeUnit !== undefined) {
      const r = property.updateSizeUnit(input.sizeUnit);
      if (!r.success) {
        return failure(r.error);
      }
    }

    return this.deps.propertyRepository.update(property);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 4: Create `UpdatePropertyUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/UpdatePropertyUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { UpdatePropertyUseCase } from '../UpdatePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success, failure } from '../../../domain/shared/Result';

function mkProperty(): OrganizationProperty {
  return OrganizationProperty.reconstitute({
    id: 'p-1',
    organizationId: 'org-1',
    name: 'A',
    address: null,
    sizeUnit: 'SQUARE_METERS',
    createdAt: new Date(),
    archivedAt: null,
  });
}

describe('UpdatePropertyUseCase', () => {
  it('renames and updates sizeUnit', async () => {
    const p = mkProperty();
    const uc = new UpdatePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'admin',
      name: 'B',
      sizeUnit: 'UNIT_COUNT',
    });
    expect(r.success).toBe(true);
    expect(p.name).toBe('B');
    expect(p.sizeUnit).toBe('UNIT_COUNT');
  });

  it('rejects when property not found', async () => {
    const uc = new UpdatePropertyUseCase({
      propertyRepository: {
        findById: async () => success(null),
      } as any,
      organizationRepository: {} as any,
      userRepository: {} as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'missing',
      adminUserId: 'a',
      name: 'X',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
  });

  it('rejects non-admin', async () => {
    const p = mkProperty();
    const uc = new UpdatePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => false } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'non-admin',
      name: 'X',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });
});
```

- [ ] **Step 5: Create `ArchivePropertyUseCase`**

```typescript
// src/application/organization/ArchivePropertyUseCase.ts
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { AutoDenyPendingClaimsOnArchiveUseCase } from './AutoDenyPendingClaimsOnArchiveUseCase';

export interface ArchivePropertyInput {
  propertyId: string;
  adminUserId: string;
}

export interface ArchivePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  autoDenyClaims: AutoDenyPendingClaimsOnArchiveUseCase;
}

export class ArchivePropertyUseCase {
  constructor(private deps: ArchivePropertyDependencies) {}

  async execute(input: ArchivePropertyInput): Promise<Result<void, string>> {
    const found = await this.deps.propertyRepository.findById(input.propertyId);
    if (!found.success) {
      return failure(found.error);
    }
    if (!found.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
    const property = found.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const arch = property.archive();
    if (!arch.success) {
      return failure(arch.error);
    }

    const saved = await this.deps.propertyRepository.update(property);
    if (!saved.success) {
      return failure(saved.error);
    }

    // Cascade-archive non-archived assets (archived_at only — ownership untouched).
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      property.id,
      false
    );
    if (assets.success) {
      for (const a of assets.value) {
        const r = a.archive();
        if (r.success) {
          await this.deps.assetRepository.updateAsset(a);
        }
      }
    }

    // Auto-deny any pending claims on assets in this property.
    await this.deps.autoDenyClaims.executeForProperty({
      propertyId: property.id,
      systemReason: 'property archived',
    });

    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 6: Create `ArchivePropertyUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/ArchivePropertyUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { ArchivePropertyUseCase } from '../ArchivePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

function mkProp(): OrganizationProperty {
  return OrganizationProperty.reconstitute({
    id: 'p-1',
    organizationId: 'org-1',
    name: 'A',
    address: null,
    sizeUnit: 'SQUARE_METERS',
    createdAt: new Date(),
    archivedAt: null,
  });
}

function mkAsset(id: string): PropertyAsset {
  return PropertyAsset.reconstitute({
    id,
    propertyId: 'p-1',
    name: `Apt ${id}`,
    size: 10,
    createdAt: new Date(),
    archivedAt: null,
  });
}

describe('ArchivePropertyUseCase', () => {
  it('archives property and cascade-archives non-archived assets', async () => {
    const p = mkProp();
    const assets = [mkAsset('a1'), mkAsset('a2')];
    const updatedAssets: string[] = [];
    let autoDenyCalled = false;

    const uc = new ArchivePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () => success(assets),
        updateAsset: async (a: PropertyAsset) => {
          updatedAssets.push(a.id);
          return success(undefined);
        },
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      autoDenyClaims: {
        executeForProperty: async () => {
          autoDenyCalled = true;
        },
      } as any,
    });

    const r = await uc.execute({ propertyId: 'p-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(p.isArchived()).toBe(true);
    expect(updatedAssets.sort()).toEqual(['a1', 'a2']);
    expect(assets.every((a) => a.isArchived())).toBe(true);
    expect(autoDenyCalled).toBe(true);
  });
});
```

- [ ] **Step 7: Create `UnarchivePropertyUseCase`**

```typescript
// src/application/organization/UnarchivePropertyUseCase.ts
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UnarchivePropertyInput {
  propertyId: string;
  adminUserId: string;
}

export interface UnarchivePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class UnarchivePropertyUseCase {
  constructor(private deps: UnarchivePropertyDependencies) {}

  async execute(input: UnarchivePropertyInput): Promise<Result<void, string>> {
    const found = await this.deps.propertyRepository.findById(input.propertyId);
    if (!found.success) {
      return failure(found.error);
    }
    if (!found.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
    const property = found.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const u = property.unarchive();
    if (!u.success) {
      return failure(u.error);
    }

    const saved = await this.deps.propertyRepository.update(property);
    if (!saved.success) {
      return failure(saved.error);
    }

    // Cascade-unarchive every asset whose archived_at equals the property's previous archive time.
    // Simpler policy: unarchive every archived asset in the property (admins can re-archive if needed).
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      property.id,
      true
    );
    if (assets.success) {
      for (const a of assets.value) {
        if (a.isArchived()) {
          const r = a.unarchive();
          if (r.success) {
            await this.deps.assetRepository.updateAsset(a);
          }
        }
      }
    }

    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 8: Create `UnarchivePropertyUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/UnarchivePropertyUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { UnarchivePropertyUseCase } from '../UnarchivePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('UnarchivePropertyUseCase', () => {
  it('unarchives property and every archived asset within it', async () => {
    const p = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-1',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: new Date(),
    });
    const a1 = PropertyAsset.reconstitute({
      id: 'a1',
      propertyId: 'p-1',
      name: 'X',
      size: 1,
      createdAt: new Date(),
      archivedAt: new Date(),
    });
    const a2 = PropertyAsset.reconstitute({
      id: 'a2',
      propertyId: 'p-1',
      name: 'Y',
      size: 1,
      createdAt: new Date(),
      archivedAt: null,
    });

    const updated: string[] = [];
    const uc = new UnarchivePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () => success([a1, a2]),
        updateAsset: async (a: PropertyAsset) => {
          updated.push(a.id);
          return success(undefined);
        },
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });

    const r = await uc.execute({ propertyId: 'p-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(p.isArchived()).toBe(false);
    expect(updated).toEqual(['a1']);
    expect(a1.isArchived()).toBe(false);
    expect(a2.isArchived()).toBe(false);
  });
});
```

- [ ] **Step 9: Run all new tests**

```bash
yarn vitest run src/application/organization/__tests__
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/application/organization/CreatePropertyUseCase.ts src/application/organization/UpdatePropertyUseCase.ts src/application/organization/ArchivePropertyUseCase.ts src/application/organization/UnarchivePropertyUseCase.ts src/application/organization/__tests__/CreatePropertyUseCase.test.ts src/application/organization/__tests__/UpdatePropertyUseCase.test.ts src/application/organization/__tests__/ArchivePropertyUseCase.test.ts src/application/organization/__tests__/UnarchivePropertyUseCase.test.ts
git commit -m "feat(app): Property CRUD use cases"
```

---

## Task 15: Application — Asset CRUD use cases

**Files:** (see File Map)

- [ ] **Step 1: Create `CreateAssetUseCase`**

```typescript
// src/application/organization/CreateAssetUseCase.ts
import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface CreateAssetInput {
  propertyId: string;
  adminUserId: string;
  name: string;
  size: number;
}

export interface CreateAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class CreateAssetUseCase {
  constructor(private deps: CreateAssetDependencies) {}

  async execute(
    input: CreateAssetInput
  ): Promise<Result<{ asset: PropertyAsset }, string>> {
    const propRes = await this.deps.propertyRepository.findById(
      input.propertyId
    );
    if (!propRes.success) {
      return failure(propRes.error);
    }
    if (!propRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
    const property = propRes.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const created = PropertyAsset.create(
      input.propertyId,
      input.name,
      input.size,
      this.deps.profanityChecker
    );
    if (!created.success) {
      return failure(created.error);
    }

    const saved = await this.deps.assetRepository.saveAsset(created.value);
    if (!saved.success) {
      return failure(saved.error);
    }
    return success({ asset: saved.value });
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 2: Create `CreateAssetUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/CreateAssetUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { CreateAssetUseCase } from '../CreateAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});

describe('CreateAssetUseCase', () => {
  it('creates asset under property', async () => {
    const uc = new CreateAssetUseCase({
      assetRepository: {
        saveAsset: async (a: PropertyAsset) => success(a),
      } as any,
      propertyRepository: {
        findById: async () => success(prop),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'admin',
      name: 'Apt',
      size: 50,
    });
    expect(r.success).toBe(true);
  });

  it('rejects size 0', async () => {
    const uc = new CreateAssetUseCase({
      assetRepository: {
        saveAsset: async (a: PropertyAsset) => success(a),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'admin',
      name: 'A',
      size: 0,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE
      );
    }
  });

  it('rejects non-admin', async () => {
    const uc = new CreateAssetUseCase({
      assetRepository: {
        saveAsset: async (a: PropertyAsset) => success(a),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => false } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'u',
      name: 'A',
      size: 1,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });
});
```

- [ ] **Step 3: Create `UpdateAssetUseCase`**

```typescript
// src/application/organization/UpdateAssetUseCase.ts
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UpdateAssetInput {
  assetId: string;
  adminUserId: string;
  name?: string;
  size?: number;
}

export interface UpdateAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class UpdateAssetUseCase {
  constructor(private deps: UpdateAssetDependencies) {}

  async execute(input: UpdateAssetInput): Promise<Result<void, string>> {
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

    if (input.name !== undefined) {
      const r = asset.rename(input.name, this.deps.profanityChecker);
      if (!r.success) {
        return failure(r.error);
      }
    }
    if (input.size !== undefined) {
      const r = asset.resize(input.size);
      if (!r.success) {
        return failure(r.error);
      }
    }
    return this.deps.assetRepository.updateAsset(asset);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 4: Create `UpdateAssetUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/UpdateAssetUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { UpdateAssetUseCase } from '../UpdateAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});

describe('UpdateAssetUseCase', () => {
  it('renames and resizes', async () => {
    const a = PropertyAsset.reconstitute({
      id: 'a-1',
      propertyId: 'p-1',
      name: 'X',
      size: 10,
      createdAt: new Date(),
      archivedAt: null,
    });
    const uc = new UpdateAssetUseCase({
      assetRepository: {
        findAssetById: async () => success(a),
        updateAsset: async () => success(undefined),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      name: 'Y',
      size: 20,
    });
    expect(r.success).toBe(true);
    expect(a.name).toBe('Y');
    expect(a.size).toBe(20);
  });
});
```

- [ ] **Step 5: Create `ArchiveAssetUseCase` (mirrors Property archive, asset-level)**

```typescript
// src/application/organization/ArchiveAssetUseCase.ts
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { AutoDenyPendingClaimsOnArchiveUseCase } from './AutoDenyPendingClaimsOnArchiveUseCase';

export interface ArchiveAssetInput {
  assetId: string;
  adminUserId: string;
}

export interface ArchiveAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  autoDenyClaims: AutoDenyPendingClaimsOnArchiveUseCase;
}

export class ArchiveAssetUseCase {
  constructor(private deps: ArchiveAssetDependencies) {}

  async execute(input: ArchiveAssetInput): Promise<Result<void, string>> {
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

    const r = asset.archive();
    if (!r.success) {
      return failure(r.error);
    }
    const saved = await this.deps.assetRepository.updateAsset(asset);
    if (!saved.success) {
      return failure(saved.error);
    }

    await this.deps.autoDenyClaims.executeForAsset({
      assetId: asset.id,
      systemReason: 'asset archived',
    });
    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 6: Create `ArchiveAssetUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/ArchiveAssetUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { ArchiveAssetUseCase } from '../ArchiveAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('ArchiveAssetUseCase', () => {
  it('archives asset and auto-denies pending claims on the asset', async () => {
    const prop = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-1',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: null,
    });
    const asset = PropertyAsset.reconstitute({
      id: 'a-1',
      propertyId: 'p-1',
      name: 'X',
      size: 10,
      createdAt: new Date(),
      archivedAt: null,
    });
    let autoDenyCalledFor = '';
    const uc = new ArchiveAssetUseCase({
      assetRepository: {
        findAssetById: async () => success(asset),
        updateAsset: async () => success(undefined),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      autoDenyClaims: {
        executeForAsset: async (input: { assetId: string }) => {
          autoDenyCalledFor = input.assetId;
        },
      } as any,
    });
    const r = await uc.execute({ assetId: 'a-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(asset.isArchived()).toBe(true);
    expect(autoDenyCalledFor).toBe('a-1');
  });
});
```

- [ ] **Step 7: Create `UnarchiveAssetUseCase` and its test**

`src/application/organization/UnarchiveAssetUseCase.ts`:

```typescript
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UnarchiveAssetInput {
  assetId: string;
  adminUserId: string;
}

export interface UnarchiveAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class UnarchiveAssetUseCase {
  constructor(private deps: UnarchiveAssetDependencies) {}

  async execute(input: UnarchiveAssetInput): Promise<Result<void, string>> {
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
    const u = asset.unarchive();
    if (!u.success) {
      return failure(u.error);
    }
    return this.deps.assetRepository.updateAsset(asset);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

`src/application/organization/__tests__/UnarchiveAssetUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UnarchiveAssetUseCase } from '../UnarchiveAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('UnarchiveAssetUseCase', () => {
  it('unarchives an archived asset', async () => {
    const prop = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-1',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: null,
    });
    const asset = PropertyAsset.reconstitute({
      id: 'a-1',
      propertyId: 'p-1',
      name: 'X',
      size: 10,
      createdAt: new Date(),
      archivedAt: new Date(),
    });
    const uc = new UnarchiveAssetUseCase({
      assetRepository: {
        findAssetById: async () => success(asset),
        updateAsset: async () => success(undefined),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ assetId: 'a-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(asset.isArchived()).toBe(false);
  });
});
```

- [ ] **Step 8: Run tests**

```bash
yarn vitest run src/application/organization/__tests__
```

- [ ] **Step 9: Commit**

```bash
git add src/application/organization/CreateAssetUseCase.ts src/application/organization/UpdateAssetUseCase.ts src/application/organization/ArchiveAssetUseCase.ts src/application/organization/UnarchiveAssetUseCase.ts src/application/organization/__tests__/CreateAssetUseCase.test.ts src/application/organization/__tests__/UpdateAssetUseCase.test.ts src/application/organization/__tests__/ArchiveAssetUseCase.test.ts src/application/organization/__tests__/UnarchiveAssetUseCase.test.ts
git commit -m "feat(app): Asset CRUD use cases"
```

---

## Task 16: Application — `ReplaceAssetOwnersUseCase` (batch SCD-2)

**Files:**

- Create: `src/application/organization/ReplaceAssetOwnersUseCase.ts`
- Create: `src/application/organization/__tests__/ReplaceAssetOwnersUseCase.test.ts`

- [ ] **Step 1: Create test file**

```typescript
// src/application/organization/__tests__/ReplaceAssetOwnersUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { ReplaceAssetOwnersUseCase } from '../ReplaceAssetOwnersUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { OrganizationErrors } from '../OrganizationErrors';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});
const asset = PropertyAsset.reconstitute({
  id: 'a-1',
  propertyId: 'p-1',
  name: 'Apt',
  size: 50,
  createdAt: new Date(),
  archivedAt: null,
});

function mkDeps(overrides: Partial<{ isAdmin: boolean }> = {}) {
  const cfg = { isAdmin: true, ...overrides };
  const calls: any[] = [];
  const deps = {
    assetRepository: {
      findAssetById: async () => success(asset),
      replaceOwners: async (input: any) => {
        calls.push(input);
        return success(undefined);
      },
    } as any,
    propertyRepository: { findById: async () => success(prop) } as any,
    organizationRepository: { isUserAdmin: async () => cfg.isAdmin } as any,
    userRepository: { isSuperAdmin: async () => false } as any,
  };
  return { deps, calls };
}

describe('ReplaceAssetOwnersUseCase', () => {
  it('accepts rows summing to exactly 1', async () => {
    const { deps, calls } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [
        { kind: 'user', userId: 'u-1', share: 0.5 },
        { kind: 'user', userId: 'u-2', share: 0.5 },
      ],
    });
    expect(r.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].inserts.length).toBe(2);
  });

  it('accepts an empty owners list (asset becomes ownerless)', async () => {
    const { deps, calls } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [],
    });
    expect(r.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].inserts).toEqual([]);
  });

  it('rejects sum != 1 (within tolerance 1e-6)', async () => {
    const { deps } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [{ kind: 'user', userId: 'u-1', share: 0.5 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
    }
  });

  it('rejects out-of-range share', async () => {
    const { deps } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [{ kind: 'user', userId: 'u-1', share: 1.2 }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects external owner with empty label', async () => {
    const { deps } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [{ kind: 'external', label: '  ', share: 1 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY);
    }
  });

  it('rejects non-admin caller', async () => {
    const { deps } = mkDeps({ isAdmin: false });
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'u',
      owners: [{ kind: 'user', userId: 'u-1', share: 1 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });
});
```

- [ ] **Step 2: Create the use case**

```typescript
// src/application/organization/ReplaceAssetOwnersUseCase.ts
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

    // Validate each row with the entity; this catches share range + label emptiness.
    const inserts: OwnershipRowToInsert[] = [];
    for (const o of input.owners) {
      if (o.kind === 'user') {
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
```

- [ ] **Step 3: Run tests**

```bash
yarn vitest run src/application/organization/__tests__/ReplaceAssetOwnersUseCase.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/application/organization/ReplaceAssetOwnersUseCase.ts src/application/organization/__tests__/ReplaceAssetOwnersUseCase.test.ts
git commit -m "feat(app): ReplaceAssetOwnersUseCase (batch SCD-2, sum==1)"
```

---

## Task 17: Application — `CorrectOwnershipUseCase` (SCD-1, unlocked-only)

**Files:**

- Create: `src/application/organization/CorrectOwnershipUseCase.ts`
- Create: `src/application/organization/__tests__/CorrectOwnershipUseCase.test.ts`

- [ ] **Step 1: Create test file**

```typescript
// src/application/organization/__tests__/CorrectOwnershipUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { CorrectOwnershipUseCase } from '../CorrectOwnershipUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../../domain/organization/PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';
import { ProfanityChecker } from '../../../domain/shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../../domain/shared/SharedDomainCodes';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});
const asset = PropertyAsset.reconstitute({
  id: 'a-1',
  propertyId: 'p-1',
  name: 'Apt',
  size: 50,
  createdAt: new Date(),
  archivedAt: null,
});

function mkOwnership(share = 0.5): PropertyAssetOwnership {
  const r = PropertyAssetOwnership.createForUser('a-1', 'u-1', share);
  if (!r.success) {
    throw new Error('setup');
  }
  return r.value;
}

const cleanChecker: ProfanityChecker = {
  containsProfanity: (t) => t.includes('badword'),
};

function mkDeps(
  opts: Partial<{
    locked: boolean;
    activeShares: number[];
  }> = {}
) {
  const cfg = { locked: false, activeShares: [0.5, 0.5], ...opts };
  const calls: any[] = [];
  const activeOwnerships = cfg.activeShares.map((s) => mkOwnership(s));
  const target = activeOwnerships[0];
  const lockFacts = cfg.locked
    ? [
        {
          explicitScopePropertyIds: ['p-1'],
          distributionType: 'OWNERSHIP_UNIT_COUNT',
        },
      ]
    : [];
  const deps = {
    assetRepository: {
      findAssetById: async () => success(asset),
      findOwnershipById: async () => success(target),
      findActiveOwnershipForAsset: async () => success(activeOwnerships),
      correctOwnership: async (input: any) => {
        calls.push(input);
        return success(undefined);
      },
    } as any,
    propertyRepository: { findById: async () => success(prop) } as any,
    organizationRepository: { isUserAdmin: async () => true } as any,
    userRepository: { isSuperAdmin: async () => false } as any,
    lockRepository: {
      findSnapshotFactsForOrg: async () => success(lockFacts),
    } as any,
    profanityChecker: cleanChecker,
  };
  return { deps, calls, target };
}

describe('CorrectOwnershipUseCase', () => {
  it('applies correction and preserves sum=1 across active rows', async () => {
    const { deps, calls } = mkDeps({ activeShares: [0.4, 0.6] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.4, // keep current first share; sum of actives stays 1.0
      reason: 'fix typo',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(true);
    expect(calls[0].newShare).toBe(0.4);
  });

  it('rejects correction that breaks sum=1', async () => {
    // Active rows currently 0.5 + 0.5. Attempt to correct the first to 0.7 → 1.2 total → reject.
    const { deps } = mkDeps({ activeShares: [0.5, 0.5] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.7,
      reason: 'fix',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
    }
  });

  it('rejects when property is locked', async () => {
    const { deps } = mkDeps({ locked: true, activeShares: [0.4, 0.6] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.4,
      reason: 'fix',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.CANNOT_CORRECT_LOCKED_PROPERTY
      );
    }
  });

  it('rejects empty reason', async () => {
    const { deps } = mkDeps({ activeShares: [0.5, 0.5] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.5,
      reason: '   ',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.CORRECTION_REASON_EMPTY);
    }
  });

  it('rejects profane reason', async () => {
    const { deps } = mkDeps({ activeShares: [0.5, 0.5] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.5,
      reason: 'badword reason',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
    }
  });
});
```

- [ ] **Step 2: Create the use case**

```typescript
// src/application/organization/CorrectOwnershipUseCase.ts
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PropertyLockRepository } from '../../domain/organization/PropertyLockRepository';
import { PropertyLockService } from '../../domain/organization/PropertyLockService';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface CorrectOwnershipInput {
  ownershipId: string;
  newShare: number;
  reason: string;
  adminUserId: string;
}

export interface CorrectOwnershipDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  lockRepository: PropertyLockRepository;
  profanityChecker: ProfanityChecker;
}

const SUM_TOLERANCE = 1e-6;

export class CorrectOwnershipUseCase {
  private lockService = new PropertyLockService();

  constructor(private deps: CorrectOwnershipDependencies) {}

  async execute(input: CorrectOwnershipInput): Promise<Result<void, string>> {
    const reason = (input.reason ?? '').trim();
    if (reason.length === 0) {
      return failure(OrganizationDomainCodes.CORRECTION_REASON_EMPTY);
    }
    if (this.deps.profanityChecker.containsProfanity(reason)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const oRes = await this.deps.assetRepository.findOwnershipById(
      input.ownershipId
    );
    if (!oRes.success) {
      return failure(oRes.error);
    }
    if (!oRes.value) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_FOUND);
    }
    const ownership = oRes.value;
    if (!ownership.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }

    const aRes = await this.deps.assetRepository.findAssetById(
      ownership.assetId
    );
    if (!aRes.success || !aRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_FOUND);
    }
    const asset = aRes.value;
    const pRes = await this.deps.propertyRepository.findById(asset.propertyId);
    if (!pRes.success || !pRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
    const property = pRes.value;
    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const facts = await this.deps.lockRepository.findSnapshotFactsForOrg(
      property.organizationId
    );
    if (!facts.success) {
      return failure(facts.error);
    }
    if (this.lockService.isLocked(property.id, facts.value)) {
      return failure(OrganizationDomainCodes.CANNOT_CORRECT_LOCKED_PROPERTY);
    }

    // Entity-level range check.
    const correction = ownership.correct(input.newShare);
    if (!correction.success) {
      return failure(correction.error);
    }

    // Re-check sum across all active rows (with the new share substituted).
    const active = await this.deps.assetRepository.findActiveOwnershipForAsset(
      asset.id
    );
    if (!active.success) {
      return failure(active.error);
    }
    const sum = active.value.reduce(
      (s, r) => s + (r.id === ownership.id ? input.newShare : r.share),
      0
    );
    if (Math.abs(sum - 1) > SUM_TOLERANCE) {
      return failure(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
    }

    return this.deps.assetRepository.correctOwnership({
      ownershipId: ownership.id,
      newShare: input.newShare,
    });
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 3: Run tests**

```bash
yarn vitest run src/application/organization/__tests__/CorrectOwnershipUseCase.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/application/organization/CorrectOwnershipUseCase.ts src/application/organization/__tests__/CorrectOwnershipUseCase.test.ts
git commit -m "feat(app): CorrectOwnershipUseCase (SCD-1, lock-gated)"
```

---

## Task 18: Application — `ListOrgPropertiesForMemberUseCase` (projection-safe)

**Files:**

- Create: `src/application/organization/ListOrgPropertiesForMemberUseCase.ts`
- Create: `src/application/organization/__tests__/ListOrgPropertiesForMemberUseCase.test.ts`

- [ ] **Step 1: Create test**

```typescript
// src/application/organization/__tests__/ListOrgPropertiesForMemberUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { ListOrgPropertiesForMemberUseCase } from '../ListOrgPropertiesForMemberUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const mkProp = (id: string, name: string, addr: string | null) =>
  OrganizationProperty.reconstitute({
    id,
    organizationId: 'org-1',
    name,
    address: addr,
    sizeUnit: 'SQUARE_METERS',
    createdAt: new Date(),
    archivedAt: null,
  });

describe('ListOrgPropertiesForMemberUseCase', () => {
  it('returns only {id, name, address} for members', async () => {
    const uc = new ListOrgPropertiesForMemberUseCase({
      propertyRepository: {
        findByOrganization: async () =>
          success([
            mkProp('p-1', 'Bldg A', '1 St'),
            mkProp('p-2', 'Bldg B', null),
          ]),
      } as any,
      organizationRepository: {
        isUserMember: async () => true,
        isUserAdmin: async () => false,
      } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ userId: 'u', organizationId: 'org-1' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.value).toEqual([
        { id: 'p-1', name: 'Bldg A', address: '1 St' },
        { id: 'p-2', name: 'Bldg B', address: null },
      ]);
      // Projection check — no other keys:
      for (const p of r.value) {
        expect(Object.keys(p).sort()).toEqual(['address', 'id', 'name']);
      }
    }
  });

  it('allows admins and superadmins even if not member', async () => {
    const uc = new ListOrgPropertiesForMemberUseCase({
      propertyRepository: {
        findByOrganization: async () => success([mkProp('p-1', 'X', null)]),
      } as any,
      organizationRepository: {
        isUserMember: async () => false,
        isUserAdmin: async () => true,
      } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ userId: 'admin', organizationId: 'org-1' });
    expect(r.success).toBe(true);
  });

  it('rejects non-member caller with NOT_ORG_MEMBER', async () => {
    const uc = new ListOrgPropertiesForMemberUseCase({
      propertyRepository: {
        findByOrganization: async () => success([mkProp('p-1', 'X', null)]),
      } as any,
      organizationRepository: {
        isUserMember: async () => false,
        isUserAdmin: async () => false,
      } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ userId: 'rand', organizationId: 'org-1' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }
  });
});
```

- [ ] **Step 2: Create the use case**

```typescript
// src/application/organization/ListOrgPropertiesForMemberUseCase.ts
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface ListOrgPropertiesForMemberInput {
  userId: string;
  organizationId: string;
}

export interface SafePropertyView {
  id: string;
  name: string;
  address: string | null;
}

export interface ListOrgPropertiesForMemberDependencies {
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ListOrgPropertiesForMemberUseCase {
  constructor(private deps: ListOrgPropertiesForMemberDependencies) {}

  async execute(
    input: ListOrgPropertiesForMemberInput
  ): Promise<Result<SafePropertyView[], string>> {
    const [isMember, isAdmin, isSuper] = await Promise.all([
      this.deps.organizationRepository.isUserMember(
        input.userId,
        input.organizationId
      ),
      this.deps.organizationRepository.isUserAdmin(
        input.userId,
        input.organizationId
      ),
      this.deps.userRepository.isSuperAdmin(input.userId),
    ]);
    if (!(isMember || isAdmin || isSuper)) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const res = await this.deps.propertyRepository.findByOrganization(
      input.organizationId
    );
    if (!res.success) {
      return failure(res.error);
    }

    // Explicit projection — never leak sizeUnit/archivedAt/relations through the client boundary.
    return success(
      res.value.map((p) => ({ id: p.id, name: p.name, address: p.address }))
    );
  }
}
```

- [ ] **Step 3: Run test + commit**

```bash
yarn vitest run src/application/organization/__tests__/ListOrgPropertiesForMemberUseCase.test.ts
git add src/application/organization/ListOrgPropertiesForMemberUseCase.ts src/application/organization/__tests__/ListOrgPropertiesForMemberUseCase.test.ts
git commit -m "feat(app): ListOrgPropertiesForMemberUseCase (projection-safe)"
```

---

## Task 19: Application — `ListClaimableAssetsUseCase` (projection-safe)

**Files:**

- Create: `src/application/organization/ListClaimableAssetsUseCase.ts`
- Create: `src/application/organization/__tests__/ListClaimableAssetsUseCase.test.ts`

- [ ] **Step 1: Create test**

```typescript
// src/application/organization/__tests__/ListClaimableAssetsUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { ListClaimableAssetsUseCase } from '../ListClaimableAssetsUseCase';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});

describe('ListClaimableAssetsUseCase', () => {
  it('returns only {id, name} — no user_id / label / share leaks', async () => {
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(prop) } as any,
      assetRepository: {
        findClaimableAssets: async () =>
          success([
            { id: 'a-1', name: 'Apt #101' },
            { id: 'a-2', name: 'Apt #102' },
          ]),
      } as any,
      organizationRepository: { isUserMember: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({
      userId: 'u',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      for (const a of r.value) {
        expect(Object.keys(a).sort()).toEqual(['id', 'name']);
      }
    }
  });

  it('rejects non-member caller', async () => {
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(prop) } as any,
      assetRepository: {
        findClaimableAssets: async () => success([]),
      } as any,
      organizationRepository: { isUserMember: async () => false } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({
      userId: 'x',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }
  });

  it('rejects when property belongs to a different org', async () => {
    const other = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-OTHER',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: null,
    });
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(other) } as any,
      assetRepository: {
        findClaimableAssets: async () => success([]),
      } as any,
      organizationRepository: { isUserMember: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({
      userId: 'u',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
  });
});
```

- [ ] **Step 2: Create the use case**

```typescript
// src/application/organization/ListClaimableAssetsUseCase.ts
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface ListClaimableAssetsInput {
  userId: string;
  organizationId: string;
  propertyId: string;
}

export interface ClaimableAssetView {
  id: string;
  name: string;
}

export interface ListClaimableAssetsDependencies {
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ListClaimableAssetsUseCase {
  constructor(private deps: ListClaimableAssetsDependencies) {}

  async execute(
    input: ListClaimableAssetsInput
  ): Promise<Result<ClaimableAssetView[], string>> {
    const [isMember, isSuper] = await Promise.all([
      this.deps.organizationRepository.isUserMember(
        input.userId,
        input.organizationId
      ),
      this.deps.userRepository.isSuperAdmin(input.userId),
    ]);
    if (!(isMember || isSuper)) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const pRes = await this.deps.propertyRepository.findById(input.propertyId);
    if (!pRes.success) {
      return failure(pRes.error);
    }
    if (!pRes.value || pRes.value.organizationId !== input.organizationId) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
    if (pRes.value.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    const assets = await this.deps.assetRepository.findClaimableAssets(
      input.propertyId
    );
    if (!assets.success) {
      return failure(assets.error);
    }

    // Re-project explicitly, ignoring any extra fields that might appear later.
    return success(assets.value.map((a) => ({ id: a.id, name: a.name })));
  }
}
```

- [ ] **Step 3: Run test + commit**

```bash
yarn vitest run src/application/organization/__tests__/ListClaimableAssetsUseCase.test.ts
git add src/application/organization/ListClaimableAssetsUseCase.ts src/application/organization/__tests__/ListClaimableAssetsUseCase.test.ts
git commit -m "feat(app): ListClaimableAssetsUseCase (projection-safe)"
```

---

## Task 20: Application — Claim use cases (submit/approve/deny/auto-deny)

**Files:** (see File Map — 4 use cases + 4 test files)

- [ ] **Step 1: Create `SubmitPropertyClaimUseCase`**

```typescript
// src/application/organization/SubmitPropertyClaimUseCase.ts
import { PropertyClaim } from '../../domain/organization/PropertyClaim';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimSubmittedUseCase } from '../notification/NotifyPropertyClaimSubmittedUseCase';

export interface SubmitPropertyClaimInput {
  userId: string;
  organizationId: string;
  assetId: string;
}

export interface SubmitPropertyClaimDependencies {
  claimRepository: PropertyClaimRepository;
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  notify: NotifyPropertyClaimSubmittedUseCase;
}

const REPEAT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class SubmitPropertyClaimUseCase {
  constructor(private deps: SubmitPropertyClaimDependencies) {}

  async execute(
    input: SubmitPropertyClaimInput
  ): Promise<Result<PropertyClaim, string>> {
    if (
      !(await this.deps.organizationRepository.isUserMember(
        input.userId,
        input.organizationId
      ))
    ) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const aRes = await this.deps.assetRepository.findAssetById(input.assetId);
    if (!aRes.success || !aRes.value || aRes.value.isArchived()) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }
    const asset = aRes.value;
    const pRes = await this.deps.propertyRepository.findById(asset.propertyId);
    if (
      !pRes.success ||
      !pRes.value ||
      pRes.value.organizationId !== input.organizationId ||
      pRes.value.isArchived()
    ) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    // Verify asset is still placeholder-owned (at least one active row with userId = null).
    const active = await this.deps.assetRepository.findActiveOwnershipForAsset(
      asset.id
    );
    if (!active.success) {
      return failure(active.error);
    }
    const hasPlaceholder = active.value.some((r) => r.userId === null);
    if (!hasPlaceholder) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    // Existing pending claim on the same asset (by anyone) blocks this submission.
    const pending = await this.deps.claimRepository.findPendingForAsset(
      asset.id
    );
    if (!pending.success) {
      return failure(pending.error);
    }
    if (pending.value.length > 0) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ALREADY_PENDING_FOR_ASSET
      );
    }

    // Repeat-after-denial cooldown: same user, same asset, within 24h of last decision.
    const latest =
      await this.deps.claimRepository.findLatestDecidedForUserAndAsset(
        input.userId,
        asset.id
      );
    if (!latest.success) {
      return failure(latest.error);
    }
    if (latest.value && latest.value.decidedAt) {
      const age = Date.now() - latest.value.decidedAt.getTime();
      if (age < REPEAT_COOLDOWN_MS) {
        return failure(
          OrganizationDomainCodes.PROPERTY_CLAIM_REPEAT_BLOCKED_WITHIN_24H
        );
      }
    }

    const created = PropertyClaim.submit(
      input.organizationId,
      input.userId,
      asset.id
    );
    if (!created.success) {
      return failure(created.error);
    }
    const saved = await this.deps.claimRepository.save(created.value);
    if (!saved.success) {
      return failure(saved.error);
    }

    await this.deps.notify.execute({ claimId: saved.value.id });
    return success(saved.value);
  }
}
```

- [ ] **Step 2: Create `SubmitPropertyClaimUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/SubmitPropertyClaimUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { SubmitPropertyClaimUseCase } from '../SubmitPropertyClaimUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../../domain/organization/PropertyAssetOwnership';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});
const asset = PropertyAsset.reconstitute({
  id: 'a-1',
  propertyId: 'p-1',
  name: 'Apt',
  size: 50,
  createdAt: new Date(),
  archivedAt: null,
});
const placeholder = PropertyAssetOwnership.reconstitute({
  id: 'o-1',
  assetId: 'a-1',
  userId: null,
  externalOwnerLabel: 'Record owner',
  share: 1,
  effectiveFrom: new Date(),
  effectiveUntil: null,
  createdAt: new Date(),
});

function mkDeps(
  overrides: Partial<{
    isMember: boolean;
    pendingClaims: any[];
    latestDecided: any | null;
    notify: () => void;
  }> = {}
) {
  const cfg = {
    isMember: true,
    pendingClaims: [],
    latestDecided: null,
    notify: () => {},
    ...overrides,
  };
  const saved: any[] = [];
  const deps = {
    claimRepository: {
      findPendingForAsset: async () => success(cfg.pendingClaims),
      findLatestDecidedForUserAndAsset: async () => success(cfg.latestDecided),
      save: async (c: PropertyClaim) => {
        saved.push(c);
        return success(c);
      },
    } as any,
    assetRepository: {
      findAssetById: async () => success(asset),
      findActiveOwnershipForAsset: async () => success([placeholder]),
    } as any,
    propertyRepository: { findById: async () => success(prop) } as any,
    organizationRepository: { isUserMember: async () => cfg.isMember } as any,
    notify: { execute: async () => cfg.notify() } as any,
  };
  return { deps, saved };
}

describe('SubmitPropertyClaimUseCase', () => {
  it('creates a PENDING claim and sends notification', async () => {
    let notified = false;
    const { deps, saved } = mkDeps({ notify: () => (notified = true) });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(true);
    expect(saved.length).toBe(1);
    expect(notified).toBe(true);
  });

  it('rejects when another claim is already pending for the asset', async () => {
    const dup = PropertyClaim.submit('org-1', 'u-2', 'a-1');
    if (!dup.success) {
      throw new Error('setup');
    }
    const { deps } = mkDeps({ pendingClaims: [dup.value] });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ALREADY_PENDING_FOR_ASSET
      );
    }
  });

  it('blocks re-claim within 24h of a prior decision', async () => {
    const prior = PropertyClaim.submit('org-1', 'u-1', 'a-1');
    if (!prior.success) {
      throw new Error('setup');
    }
    prior.value.deny('admin', 'no', new Date()); // decidedAt = now
    const { deps } = mkDeps({ latestDecided: prior.value });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_REPEAT_BLOCKED_WITHIN_24H
      );
    }
  });

  it('rejects non-member', async () => {
    const { deps } = mkDeps({ isMember: false });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'stranger',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Create `ApprovePropertyClaimUseCase`**

```typescript
// src/application/organization/ApprovePropertyClaimUseCase.ts
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimApprovedUseCase } from '../notification/NotifyPropertyClaimApprovedUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface ApprovePropertyClaimInput {
  claimId: string;
  adminUserId: string;
}

export interface ApprovePropertyClaimDependencies {
  claimRepository: PropertyClaimRepository;
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notifyApproved: NotifyPropertyClaimApprovedUseCase;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class ApprovePropertyClaimUseCase {
  constructor(private deps: ApprovePropertyClaimDependencies) {}

  async execute(
    input: ApprovePropertyClaimInput
  ): Promise<Result<void, string>> {
    const cRes = await this.deps.claimRepository.findById(input.claimId);
    if (!cRes.success) {
      return failure(cRes.error);
    }
    if (!cRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_FOUND);
    }
    const claim = cRes.value;

    if (!(await this.authorize(input.adminUserId, claim.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Find the single active placeholder ownership row for the claimed asset.
    const active = await this.deps.assetRepository.findActiveOwnershipForAsset(
      claim.assetId
    );
    if (!active.success) {
      return failure(active.error);
    }
    const placeholder = active.value.find((o) => o.userId === null);
    if (!placeholder) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    const transition = claim.approve(input.adminUserId, new Date());
    if (!transition.success) {
      return failure(transition.error);
    }
    const saved = await this.deps.claimRepository.update(claim);
    if (!saved.success) {
      return failure(saved.error);
    }

    const linked = await this.deps.assetRepository.linkOwnershipToUser({
      ownershipId: placeholder.id,
      userId: claim.userId,
    });
    if (!linked.success) {
      return failure(linked.error);
    }

    // Auto-deny sibling pending claims on the same asset.
    const siblings = await this.deps.claimRepository.findPendingForAsset(
      claim.assetId
    );
    if (siblings.success) {
      for (const s of siblings.value) {
        if (s.id === claim.id) {
          continue;
        }
        const auto = s.autoDeny('another claim approved', new Date());
        if (auto.success) {
          await this.deps.claimRepository.update(s);
          await this.deps.notifyDenied.execute({ claimId: s.id });
        }
      }
    }

    await this.deps.notifyApproved.execute({ claimId: claim.id });
    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 4: Create `ApprovePropertyClaimUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/ApprovePropertyClaimUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { ApprovePropertyClaimUseCase } from '../ApprovePropertyClaimUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { PropertyAssetOwnership } from '../../../domain/organization/PropertyAssetOwnership';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { success } from '../../../domain/shared/Result';

const claim = (() => {
  const r = PropertyClaim.submit('org-1', 'u-42', 'a-1');
  if (!r.success) {
    throw new Error('setup');
  }
  return r.value;
})();

const placeholder = PropertyAssetOwnership.reconstitute({
  id: 'o-1',
  assetId: 'a-1',
  userId: null,
  externalOwnerLabel: 'Record owner',
  share: 1,
  effectiveFrom: new Date(),
  effectiveUntil: null,
  createdAt: new Date(),
});

describe('ApprovePropertyClaimUseCase', () => {
  it('links user, auto-denies siblings, notifies', async () => {
    const sibling = (() => {
      const r = PropertyClaim.submit('org-1', 'u-7', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      return r.value;
    })();
    const updated: string[] = [];
    let linked: any = null;
    let approvedNotified = 0;
    let deniedNotified = 0;
    const uc = new ApprovePropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(claim),
        update: async (c: PropertyClaim) => {
          updated.push(c.id);
          return success(undefined);
        },
        findPendingForAsset: async () => success([sibling]),
      } as any,
      assetRepository: {
        findActiveOwnershipForAsset: async () => success([placeholder]),
        linkOwnershipToUser: async (input: any) => {
          linked = input;
          return success(undefined);
        },
      } as any,
      propertyRepository: { findById: async () => success(null) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      notifyApproved: {
        execute: async () => {
          approvedNotified++;
        },
      } as any,
      notifyDenied: {
        execute: async () => {
          deniedNotified++;
        },
      } as any,
    });
    const r = await uc.execute({ claimId: claim.id, adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(claim.status).toBe('APPROVED');
    expect(linked.userId).toBe('u-42');
    expect(sibling.status).toBe('DENIED');
    expect(approvedNotified).toBe(1);
    expect(deniedNotified).toBe(1);
  });
});
```

- [ ] **Step 5: Create `DenyPropertyClaimUseCase`**

```typescript
// src/application/organization/DenyPropertyClaimUseCase.ts
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface DenyPropertyClaimInput {
  claimId: string;
  adminUserId: string;
  reason: string;
}

export interface DenyPropertyClaimDependencies {
  claimRepository: PropertyClaimRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class DenyPropertyClaimUseCase {
  constructor(private deps: DenyPropertyClaimDependencies) {}

  async execute(input: DenyPropertyClaimInput): Promise<Result<void, string>> {
    const cRes = await this.deps.claimRepository.findById(input.claimId);
    if (!cRes.success) {
      return failure(cRes.error);
    }
    if (!cRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_FOUND);
    }
    const claim = cRes.value;
    if (!(await this.authorize(input.adminUserId, claim.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }
    const t = claim.deny(
      input.adminUserId,
      input.reason,
      new Date(),
      this.deps.profanityChecker
    );
    if (!t.success) {
      return failure(t.error);
    }
    const saved = await this.deps.claimRepository.update(claim);
    if (!saved.success) {
      return failure(saved.error);
    }
    await this.deps.notifyDenied.execute({ claimId: claim.id });
    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }
    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
```

- [ ] **Step 6: Create `DenyPropertyClaimUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/DenyPropertyClaimUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { DenyPropertyClaimUseCase } from '../DenyPropertyClaimUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const claim = (() => {
  const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
  if (!r.success) {
    throw new Error('setup');
  }
  return r.value;
})();

describe('DenyPropertyClaimUseCase', () => {
  it('denies with reason and notifies', async () => {
    let notified = 0;
    const uc = new DenyPropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(claim),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
      notifyDenied: {
        execute: async () => {
          notified++;
        },
      } as any,
    });
    const r = await uc.execute({
      claimId: claim.id,
      adminUserId: 'admin',
      reason: 'Cannot verify',
    });
    expect(r.success).toBe(true);
    expect(claim.status).toBe('DENIED');
    expect(notified).toBe(1);
  });

  it('rejects empty reason', async () => {
    const fresh = (() => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');
      if (!r.success) {
        throw new Error('setup');
      }
      return r.value;
    })();
    const uc = new DenyPropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(fresh),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
      notifyDenied: { execute: async () => {} } as any,
    });
    const r = await uc.execute({
      claimId: fresh.id,
      adminUserId: 'admin',
      reason: ' ',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }
  });
});
```

- [ ] **Step 7: Create `AutoDenyPendingClaimsOnArchiveUseCase`**

```typescript
// src/application/organization/AutoDenyPendingClaimsOnArchiveUseCase.ts
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface AutoDenyDependencies {
  claimRepository: PropertyClaimRepository;
  assetRepository: PropertyAssetRepository;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class AutoDenyPendingClaimsOnArchiveUseCase {
  constructor(private deps: AutoDenyDependencies) {}

  async executeForAsset(input: {
    assetId: string;
    systemReason: string;
  }): Promise<void> {
    const r = await this.deps.claimRepository.findPendingForAsset(
      input.assetId
    );
    if (!r.success) {
      return;
    }
    const now = new Date();
    for (const c of r.value) {
      const t = c.autoDeny(input.systemReason, now);
      if (t.success) {
        await this.deps.claimRepository.update(c);
        await this.deps.notifyDenied.execute({ claimId: c.id });
      }
    }
  }

  async executeForProperty(input: {
    propertyId: string;
    systemReason: string;
  }): Promise<void> {
    // Find every non-archived or archived asset under this property.
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      input.propertyId,
      true
    );
    if (!assets.success) {
      return;
    }
    const assetIds = assets.value.map((a) => a.id);
    const pending =
      await this.deps.claimRepository.findPendingForAssets(assetIds);
    if (!pending.success) {
      return;
    }
    const now = new Date();
    for (const c of pending.value) {
      const t = c.autoDeny(input.systemReason, now);
      if (t.success) {
        await this.deps.claimRepository.update(c);
        await this.deps.notifyDenied.execute({ claimId: c.id });
      }
    }
  }
}
```

- [ ] **Step 8: Create `AutoDenyPendingClaimsOnArchiveUseCase.test.ts`**

```typescript
// src/application/organization/__tests__/AutoDenyPendingClaimsOnArchiveUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { AutoDenyPendingClaimsOnArchiveUseCase } from '../AutoDenyPendingClaimsOnArchiveUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('AutoDenyPendingClaimsOnArchiveUseCase', () => {
  it('denies every pending claim for an asset and notifies each', async () => {
    const c1 = (() => {
      const r = PropertyClaim.submit('o', 'u1', 'a-1');
      if (!r.success) {
        throw new Error('s');
      }
      return r.value;
    })();
    const c2 = (() => {
      const r = PropertyClaim.submit('o', 'u2', 'a-1');
      if (!r.success) {
        throw new Error('s');
      }
      return r.value;
    })();
    const notified: string[] = [];
    const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
      claimRepository: {
        findPendingForAsset: async () => success([c1, c2]),
        update: async () => success(undefined),
      } as any,
      assetRepository: {} as any,
      notifyDenied: {
        execute: async (input: any) => {
          notified.push(input.claimId);
        },
      } as any,
    });
    await uc.executeForAsset({ assetId: 'a-1', systemReason: 'archived' });
    expect(c1.status).toBe('DENIED');
    expect(c2.status).toBe('DENIED');
    expect(notified.length).toBe(2);
  });

  it('denies across all assets in a property', async () => {
    const c1 = (() => {
      const r = PropertyClaim.submit('o', 'u1', 'a-1');
      if (!r.success) {
        throw new Error('s');
      }
      return r.value;
    })();
    const notified: string[] = [];
    const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
      claimRepository: {
        findPendingForAssets: async () => success([c1]),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () =>
          success([
            PropertyAsset.reconstitute({
              id: 'a-1',
              propertyId: 'p-1',
              name: 'X',
              size: 1,
              createdAt: new Date(),
              archivedAt: null,
            }),
          ]),
      } as any,
      notifyDenied: {
        execute: async (input: any) => {
          notified.push(input.claimId);
        },
      } as any,
    });
    await uc.executeForProperty({
      propertyId: 'p-1',
      systemReason: 'archived',
    });
    expect(c1.status).toBe('DENIED');
    expect(notified.length).toBe(1);
  });
});
```

- [ ] **Step 9: Run tests + commit**

```bash
yarn vitest run src/application/organization/__tests__
git add src/application/organization/SubmitPropertyClaimUseCase.ts src/application/organization/ApprovePropertyClaimUseCase.ts src/application/organization/DenyPropertyClaimUseCase.ts src/application/organization/AutoDenyPendingClaimsOnArchiveUseCase.ts src/application/organization/__tests__/SubmitPropertyClaimUseCase.test.ts src/application/organization/__tests__/ApprovePropertyClaimUseCase.test.ts src/application/organization/__tests__/DenyPropertyClaimUseCase.test.ts src/application/organization/__tests__/AutoDenyPendingClaimsOnArchiveUseCase.test.ts
git commit -m "feat(app): PropertyClaim submit/approve/deny/auto-deny use cases"
```

---

## Task 21: Application — Claim notification use cases

**Files:**

- Create: `src/application/notification/NotifyPropertyClaimSubmittedUseCase.ts`
- Create: `src/application/notification/NotifyPropertyClaimApprovedUseCase.ts`
- Create: `src/application/notification/NotifyPropertyClaimDeniedUseCase.ts`

All three follow the same shape as existing `NotifyOrgArchivedUseCase`. Title/body use localization keys (not literal strings).

- [ ] **Step 1: `NotifyPropertyClaimSubmittedUseCase.ts`**

```typescript
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';

export interface NotifyPropertyClaimSubmittedDependencies {
  notificationRepository: NotificationRepository;
  claimRepository: PropertyClaimRepository;
}

export class NotifyPropertyClaimSubmittedUseCase {
  constructor(private deps: NotifyPropertyClaimSubmittedDependencies) {}

  async execute(input: { claimId: string }): Promise<void> {
    const claimRes = await this.deps.claimRepository.findById(input.claimId);
    if (!claimRes.success || !claimRes.value) {
      return;
    }
    const admins = await this.deps.claimRepository.getOrgAdminUserIds(
      claimRes.value.organizationId
    );
    if (!admins.success || admins.value.length === 0) {
      return;
    }
    const notifications: Notification[] = [];
    for (const adminUserId of admins.value) {
      const n = Notification.create({
        userId: adminUserId,
        type: 'property_claim_submitted',
        title: 'notification.types.propertyClaimSubmitted.title',
        body: 'notification.types.propertyClaimSubmitted.body',
        data: {
          claimId: claimRes.value.id,
          organizationId: claimRes.value.organizationId,
          assetId: claimRes.value.assetId,
        },
      });
      if (n.success) {
        notifications.push(n.value);
      }
    }
    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
```

- [ ] **Step 2: `NotifyPropertyClaimApprovedUseCase.ts`**

```typescript
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';

export interface NotifyPropertyClaimApprovedDependencies {
  notificationRepository: NotificationRepository;
  claimRepository: PropertyClaimRepository;
}

export class NotifyPropertyClaimApprovedUseCase {
  constructor(private deps: NotifyPropertyClaimApprovedDependencies) {}

  async execute(input: { claimId: string }): Promise<void> {
    const claimRes = await this.deps.claimRepository.findById(input.claimId);
    if (!claimRes.success || !claimRes.value) {
      return;
    }
    const n = Notification.create({
      userId: claimRes.value.userId,
      type: 'property_claim_approved',
      title: 'notification.types.propertyClaimApproved.title',
      body: 'notification.types.propertyClaimApproved.body',
      data: {
        claimId: claimRes.value.id,
        organizationId: claimRes.value.organizationId,
        assetId: claimRes.value.assetId,
      },
    });
    if (!n.success) {
      return;
    }
    await this.deps.notificationRepository.save(n.value);
  }
}
```

- [ ] **Step 3: `NotifyPropertyClaimDeniedUseCase.ts`**

```typescript
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';

export interface NotifyPropertyClaimDeniedDependencies {
  notificationRepository: NotificationRepository;
  claimRepository: PropertyClaimRepository;
}

export class NotifyPropertyClaimDeniedUseCase {
  constructor(private deps: NotifyPropertyClaimDeniedDependencies) {}

  async execute(input: { claimId: string }): Promise<void> {
    const claimRes = await this.deps.claimRepository.findById(input.claimId);
    if (!claimRes.success || !claimRes.value) {
      return;
    }
    const n = Notification.create({
      userId: claimRes.value.userId,
      type: 'property_claim_denied',
      title: 'notification.types.propertyClaimDenied.title',
      body: 'notification.types.propertyClaimDenied.body',
      data: {
        claimId: claimRes.value.id,
        organizationId: claimRes.value.organizationId,
        assetId: claimRes.value.assetId,
        reason: claimRes.value.deniedReason,
      },
    });
    if (!n.success) {
      return;
    }
    await this.deps.notificationRepository.save(n.value);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/application/notification/NotifyPropertyClaimSubmittedUseCase.ts src/application/notification/NotifyPropertyClaimApprovedUseCase.ts src/application/notification/NotifyPropertyClaimDeniedUseCase.ts
git commit -m "feat(app): PropertyClaim notification use cases"
```

---

## Task 22: Web actions — `property.ts` (property + asset + ownership)

**Files:**

- Create: `src/web/actions/organization/property.ts`

- [ ] **Step 1: Create the file with DI block and actions**

Follow the same import/DI pattern as `src/web/actions/organization/organization.ts`. Each action:

1. Starts with `checkRateLimit()`.
2. Validates auth via `getCurrentUser()`.
3. Delegates to a use case.
4. Returns `ActionResult<T>` translated via `translateErrorCode`.

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaOrganizationPropertyRepository,
  PrismaPropertyAssetRepository,
  PrismaPropertyClaimRepository,
  PrismaPropertyLockRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { CreatePropertyUseCase } from '@/application/organization/CreatePropertyUseCase';
import { UpdatePropertyUseCase } from '@/application/organization/UpdatePropertyUseCase';
import { ArchivePropertyUseCase } from '@/application/organization/ArchivePropertyUseCase';
import { UnarchivePropertyUseCase } from '@/application/organization/UnarchivePropertyUseCase';
import { CreateAssetUseCase } from '@/application/organization/CreateAssetUseCase';
import { UpdateAssetUseCase } from '@/application/organization/UpdateAssetUseCase';
import { ArchiveAssetUseCase } from '@/application/organization/ArchiveAssetUseCase';
import { UnarchiveAssetUseCase } from '@/application/organization/UnarchiveAssetUseCase';
import {
  ReplaceAssetOwnersUseCase,
  OwnerInput,
} from '@/application/organization/ReplaceAssetOwnersUseCase';
import { CorrectOwnershipUseCase } from '@/application/organization/CorrectOwnershipUseCase';
import { AutoDenyPendingClaimsOnArchiveUseCase } from '@/application/organization/AutoDenyPendingClaimsOnArchiveUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '@/application/notification/NotifyPropertyClaimDeniedUseCase';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);
const assetRepository = new PrismaPropertyAssetRepository(prisma);
const claimRepository = new PrismaPropertyClaimRepository(prisma);
const lockRepository = new PrismaPropertyLockRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();

const notifyDenied = new NotifyPropertyClaimDeniedUseCase({
  notificationRepository,
  claimRepository,
});
const autoDenyClaims = new AutoDenyPendingClaimsOnArchiveUseCase({
  claimRepository,
  assetRepository,
  notifyDenied,
});

const createProperty = new CreatePropertyUseCase({
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const updateProperty = new UpdatePropertyUseCase({
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const archiveProperty = new ArchivePropertyUseCase({
  propertyRepository,
  assetRepository,
  organizationRepository,
  userRepository,
  autoDenyClaims,
});
const unarchiveProperty = new UnarchivePropertyUseCase({
  propertyRepository,
  assetRepository,
  organizationRepository,
  userRepository,
});
const createAsset = new CreateAssetUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const updateAsset = new UpdateAssetUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const archiveAsset = new ArchiveAssetUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  autoDenyClaims,
});
const unarchiveAsset = new UnarchiveAssetUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
});
const replaceOwners = new ReplaceAssetOwnersUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
});
const correctOwnership = new CorrectOwnershipUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  lockRepository,
  profanityChecker,
});

async function requireUser() {
  const u = await getCurrentUser();
  if (!u) {
    const t = await getTranslations('common.errors');
    return { error: t('unauthorized') as string };
  }
  return { userId: u.id };
}

export async function createPropertyAction(input: {
  organizationId: string;
  name: string;
  address: string | null;
  sizeUnit: string;
}): Promise<ActionResult<{ propertyId: string }>> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await createProperty.execute({
    organizationId: input.organizationId,
    adminUserId: auth.userId,
    name: input.name,
    address: input.address,
    sizeUnit: input.sizeUnit,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  revalidatePath(`/organizations/${input.organizationId}/manage-properties`);
  return { success: true, data: { propertyId: r.value.property.id } };
}

export async function updatePropertyAction(input: {
  propertyId: string;
  name?: string;
  address?: string | null;
  sizeUnit?: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await updateProperty.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
    name: input.name,
    address: input.address,
    sizeUnit: input.sizeUnit,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function archivePropertyAction(input: {
  propertyId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await archiveProperty.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function unarchivePropertyAction(input: {
  propertyId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await unarchiveProperty.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function createAssetAction(input: {
  propertyId: string;
  name: string;
  size: number;
}): Promise<ActionResult<{ assetId: string }>> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await createAsset.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
    name: input.name,
    size: input.size,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: { assetId: r.value.asset.id } };
}

export async function updateAssetAction(input: {
  assetId: string;
  name?: string;
  size?: number;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await updateAsset.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
    name: input.name,
    size: input.size,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function archiveAssetAction(input: {
  assetId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await archiveAsset.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function unarchiveAssetAction(input: {
  assetId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await unarchiveAsset.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function replaceAssetOwnersAction(input: {
  assetId: string;
  owners: OwnerInput[];
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await replaceOwners.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
    owners: input.owners,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function correctOwnershipAction(input: {
  ownershipId: string;
  newShare: number;
  reason: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await correctOwnership.execute({
    ownershipId: input.ownershipId,
    newShare: input.newShare,
    reason: input.reason,
    adminUserId: auth.userId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function listPropertiesAction(input: {
  organizationId: string;
}): Promise<
  ActionResult<{
    properties: {
      id: string;
      name: string;
      address: string | null;
      sizeUnit: string;
      archivedAt: string | null;
    }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    input.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);
  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }
  const r = await propertyRepository.findAllByOrganizationIncludingArchived(
    input.organizationId
  );
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return {
    success: true,
    data: {
      properties: r.value.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        sizeUnit: p.sizeUnit,
        archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
      })),
    },
  };
}

export async function listAssetsAction(input: {
  propertyId: string;
  includeArchived: boolean;
}): Promise<
  ActionResult<{
    assets: {
      id: string;
      name: string;
      size: number;
      archivedAt: string | null;
    }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const pRes = await propertyRepository.findById(input.propertyId);
  if (!pRes.success || !pRes.value) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.propertyNotFound'),
    };
  }
  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    pRes.value.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);
  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }
  const r = await assetRepository.findAssetsByProperty(
    input.propertyId,
    input.includeArchived
  );
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return {
    success: true,
    data: {
      assets: r.value.map((a) => ({
        id: a.id,
        name: a.name,
        size: a.size,
        archivedAt: a.archivedAt ? a.archivedAt.toISOString() : null,
      })),
    },
  };
}

export async function listActiveOwnershipForAssetAction(input: {
  assetId: string;
}): Promise<
  ActionResult<{
    ownerships: {
      id: string;
      userId: string | null;
      externalOwnerLabel: string | null;
      share: number;
    }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const aRes = await assetRepository.findAssetById(input.assetId);
  if (!aRes.success || !aRes.value) {
    return {
      success: false,
      error: await translateErrorCode(
        'domain.organization.propertyAssetNotFound'
      ),
    };
  }
  const pRes = await propertyRepository.findById(aRes.value.propertyId);
  if (!pRes.success || !pRes.value) {
    return { success: false, error: 'property not found' };
  }
  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    pRes.value.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);
  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }
  const r = await assetRepository.findActiveOwnershipForAsset(input.assetId);
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return {
    success: true,
    data: {
      ownerships: r.value.map((o) => ({
        id: o.id,
        userId: o.userId,
        externalOwnerLabel: o.externalOwnerLabel,
        share: o.share,
      })),
    },
  };
}

export async function listOwnershipRowsAction(input: {
  organizationId: string;
  activeOnly: boolean;
  userId?: string;
  assetId?: string;
  propertyId?: string;
}): Promise<
  ActionResult<{
    rows: {
      id: string;
      assetId: string;
      assetName: string;
      propertyId: string;
      propertyName: string;
      userId: string | null;
      externalOwnerLabel: string | null;
      share: number;
      effectiveFrom: string;
      effectiveUntil: string | null;
    }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    input.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);
  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }
  const r = await assetRepository.findOwnershipRows(input);
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return {
    success: true,
    data: {
      rows: r.value.map((x) => ({
        id: x.id,
        assetId: x.assetId,
        assetName: x.assetName,
        propertyId: x.propertyId,
        propertyName: x.propertyName,
        userId: x.userId,
        externalOwnerLabel: x.externalOwnerLabel,
        share: x.share,
        effectiveFrom: x.effectiveFrom.toISOString(),
        effectiveUntil: x.effectiveUntil
          ? x.effectiveUntil.toISOString()
          : null,
      })),
    },
  };
}
```

- [ ] **Step 2: `tsc` check + commit**

```bash
yarn tsc --noEmit
git add src/web/actions/organization/property.ts
git commit -m "feat(web): property/asset/ownership server actions"
```

---

## Task 23: Web actions — `propertyClaim.ts`

**Files:**

- Create: `src/web/actions/organization/propertyClaim.ts`

- [ ] **Step 1: Create the file**

```typescript
'use server';

import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaPropertyClaimRepository,
  PrismaPropertyAssetRepository,
  PrismaOrganizationPropertyRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { SubmitPropertyClaimUseCase } from '@/application/organization/SubmitPropertyClaimUseCase';
import { ApprovePropertyClaimUseCase } from '@/application/organization/ApprovePropertyClaimUseCase';
import { DenyPropertyClaimUseCase } from '@/application/organization/DenyPropertyClaimUseCase';
import { ListOrgPropertiesForMemberUseCase } from '@/application/organization/ListOrgPropertiesForMemberUseCase';
import { ListClaimableAssetsUseCase } from '@/application/organization/ListClaimableAssetsUseCase';
import { NotifyPropertyClaimSubmittedUseCase } from '@/application/notification/NotifyPropertyClaimSubmittedUseCase';
import { NotifyPropertyClaimApprovedUseCase } from '@/application/notification/NotifyPropertyClaimApprovedUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '@/application/notification/NotifyPropertyClaimDeniedUseCase';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const claimRepository = new PrismaPropertyClaimRepository(prisma);
const assetRepository = new PrismaPropertyAssetRepository(prisma);
const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();

const notifySubmitted = new NotifyPropertyClaimSubmittedUseCase({
  notificationRepository,
  claimRepository,
});
const notifyApproved = new NotifyPropertyClaimApprovedUseCase({
  notificationRepository,
  claimRepository,
});
const notifyDenied = new NotifyPropertyClaimDeniedUseCase({
  notificationRepository,
  claimRepository,
});

const submit = new SubmitPropertyClaimUseCase({
  claimRepository,
  assetRepository,
  propertyRepository,
  organizationRepository,
  notify: notifySubmitted,
});
const approve = new ApprovePropertyClaimUseCase({
  claimRepository,
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  notifyApproved,
  notifyDenied,
});
const deny = new DenyPropertyClaimUseCase({
  claimRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
  notifyDenied,
});
const listOrgProperties = new ListOrgPropertiesForMemberUseCase({
  propertyRepository,
  organizationRepository,
  userRepository,
});
const listClaimableAssets = new ListClaimableAssetsUseCase({
  propertyRepository,
  assetRepository,
  organizationRepository,
  userRepository,
});

async function requireUser() {
  const u = await getCurrentUser();
  if (!u) {
    const t = await getTranslations('common.errors');
    return { error: t('unauthorized') as string };
  }
  return { userId: u.id };
}

export async function submitPropertyClaimAction(input: {
  organizationId: string;
  assetId: string;
}): Promise<ActionResult<{ claimId: string }>> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await submit.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
    assetId: input.assetId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: { claimId: r.value.id } };
}

export async function approvePropertyClaimAction(input: {
  claimId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await approve.execute({
    claimId: input.claimId,
    adminUserId: auth.userId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function denyPropertyClaimAction(input: {
  claimId: string;
  reason: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await deny.execute({
    claimId: input.claimId,
    adminUserId: auth.userId,
    reason: input.reason,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: undefined };
}

export async function listOrgPropertiesForMemberAction(input: {
  organizationId: string;
}): Promise<
  ActionResult<{
    properties: { id: string; name: string; address: string | null }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await listOrgProperties.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: { properties: r.value } };
}

export async function listClaimableAssetsAction(input: {
  organizationId: string;
  propertyId: string;
}): Promise<ActionResult<{ assets: { id: string; name: string }[] }>> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const r = await listClaimableAssets.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
    propertyId: input.propertyId,
  });
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return { success: true, data: { assets: r.value } };
}

export async function listPendingClaimsForOrgAction(input: {
  organizationId: string;
}): Promise<
  ActionResult<{
    rows: {
      id: string;
      assetId: string;
      assetName: string;
      propertyId: string;
      propertyName: string;
      claimantFirstName: string;
      claimantLastName: string;
      claimantMiddleName: string | null;
      externalOwnerLabel: string | null;
      createdAt: string;
    }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    input.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);
  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }
  const r = await claimRepository.findPendingForOrg(input.organizationId);
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return {
    success: true,
    data: {
      rows: r.value.map((x) => ({
        id: x.claim.id,
        assetId: x.claim.assetId,
        assetName: x.assetName,
        propertyId: x.propertyId,
        propertyName: x.propertyName,
        claimantFirstName: x.claimantFirstName,
        claimantLastName: x.claimantLastName,
        claimantMiddleName: x.claimantMiddleName,
        externalOwnerLabel: x.externalOwnerLabel,
        createdAt: x.claim.createdAt.toISOString(),
      })),
    },
  };
}

export async function listMyClaimsForPropertyAction(input: {
  organizationId: string;
  propertyId: string;
}): Promise<
  ActionResult<{
    rows: {
      id: string;
      assetName: string;
      status: string;
      deniedReason: string | null;
      createdAt: string;
      decidedAt: string | null;
    }[];
  }>
> {
  const rl = await checkRateLimit();
  if (rl) {
    return rl;
  }
  const auth = await requireUser();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  const isMember = await organizationRepository.isUserMember(
    auth.userId,
    input.organizationId
  );
  if (!isMember) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.notOrgMember'),
    };
  }
  const r = await claimRepository.findMyClaimsForProperty(
    auth.userId,
    input.propertyId
  );
  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }
  return {
    success: true,
    data: {
      rows: r.value.map((x) => ({
        id: x.claim.id,
        assetName: x.assetName,
        status: x.claim.status,
        deniedReason: x.claim.deniedReason,
        createdAt: x.claim.createdAt.toISOString(),
        decidedAt: x.claim.decidedAt ? x.claim.decidedAt.toISOString() : null,
      })),
    },
  };
}
```

- [ ] **Step 2: `tsc` check + commit**

```bash
yarn tsc --noEmit
git add src/web/actions/organization/propertyClaim.ts
git commit -m "feat(web): property-claim server actions"
```

---

## Task 24: Admin UI — `manage-properties` page (adaptive)

**Files:**

- Create: `src/app/[locale]/organizations/[id]/manage-properties/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/ManagePropertiesClient.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/PropertyEditorInline.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/AssetsTable.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-properties/EditOwnersModal.tsx`

Reference pattern: `src/app/[locale]/organizations/[id]/manage-admins/page.tsx`. Use `AuthenticatedLayout`, `getCurrentUser()`, `getOrganizationDetailsAction()`, Catalyst components (`Heading`, `Text`, `Button`, `Dialog`, `Input`, `Select`).

- [ ] **Step 1: Create `page.tsx` (Server Component — guard + initial data fetch)**

```tsx
// src/app/[locale]/organizations/[id]/manage-properties/page.tsx
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getOrganizationDetailsAction } from '@/src/web/actions/organization/organization';
import { listPropertiesAction } from '@/src/web/actions/organization/property';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { ManagePropertiesClient } from './ManagePropertiesClient';
import { Heading } from '@/src/web/components/catalyst/heading';

const userRepository = new PrismaUserRepository(prisma);

export default async function ManagePropertiesPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('propertyAdmin');
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const orgRes = await getOrganizationDetailsAction(id);
  if (!orgRes.success) {
    redirect(`/${locale}`);
  }

  const isSuper = await userRepository.isSuperAdmin(user.id);
  if (!orgRes.data.isUserAdmin && !isSuper) {
    redirect(`/${locale}/organizations/${id}`);
  }

  const props = await listPropertiesAction({ organizationId: id });
  const properties = props.success ? props.data.properties : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <ManagePropertiesClient
          organizationId={id}
          initialProperties={properties}
        />
      </div>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create `ManagePropertiesClient.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/manage-properties/ManagePropertiesClient.tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { createPropertyAction } from '@/src/web/actions/organization/property';
import { PropertyEditorInline } from './PropertyEditorInline';
import { AssetsTable } from './AssetsTable';

export interface ClientProperty {
  id: string;
  name: string;
  address: string | null;
  sizeUnit: string;
  archivedAt: string | null;
}

const SIZE_UNITS = [
  'SQUARE_METERS',
  'SQUARE_FEET',
  'HECTARES',
  'ACRES',
  'CUBIC_METERS',
  'LINEAR_METERS',
  'UNIT_COUNT',
  'SHARES',
];

export function ManagePropertiesClient({
  organizationId,
  initialProperties,
}: {
  organizationId: string;
  initialProperties: ClientProperty[];
}) {
  const t = useTranslations('propertyAdmin');
  const tUnit = useTranslations('propertyAdmin.sizeUnit');
  const [properties, setProperties] = useState(initialProperties);
  const nonArchived = properties.filter((p) => p.archivedAt === null);
  const [selectedId, setSelectedId] = useState<string | null>(
    nonArchived[0]?.id ?? null
  );
  const [showCreate, setShowCreate] = useState(nonArchived.length === 0);
  const [form, setForm] = useState({
    name: '',
    address: '',
    sizeUnit: 'SQUARE_METERS',
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshSelected(id: string | null) {
    setSelectedId(id);
  }

  async function submitCreate() {
    setErr(null);
    startTransition(async () => {
      const r = await createPropertyAction({
        organizationId,
        name: form.name,
        address: form.address.trim() === '' ? null : form.address,
        sizeUnit: form.sizeUnit,
      });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      // Reload page to refresh server-rendered list.
      window.location.reload();
    });
  }

  if (nonArchived.length === 0) {
    return (
      <div className="space-y-4">
        <Text>{t('empty.cta')}</Text>
        <Button onClick={() => setShowCreate(true)}>{t('empty.create')}</Button>
        {showCreate && (
          <Dialog open onClose={() => setShowCreate(false)}>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogBody>
              <div className="space-y-3">
                <Input
                  placeholder={t('fields.name')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  placeholder={t('fields.address')}
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
                <Select
                  value={form.sizeUnit}
                  onChange={(e) =>
                    setForm({ ...form, sizeUnit: e.target.value })
                  }
                >
                  {SIZE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {tUnit(toCamel(u))}
                    </option>
                  ))}
                </Select>
                {err && <Text className="text-red-600">{err}</Text>}
              </div>
            </DialogBody>
            <DialogActions>
              <Button plain onClick={() => setShowCreate(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={submitCreate} disabled={pending}>
                {t('save')}
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </div>
    );
  }

  const useTabs = nonArchived.length >= 2 && nonArchived.length <= 5;
  const selected =
    nonArchived.find((p) => p.id === selectedId) ?? nonArchived[0];

  return (
    <div className="space-y-6">
      {nonArchived.length >= 2 && (
        <div className="flex flex-wrap items-center gap-2">
          {useTabs ? (
            nonArchived.map((p) => (
              <Button
                key={p.id}
                color={p.id === selected.id ? 'brand-green' : 'zinc'}
                onClick={() => refreshSelected(p.id)}
              >
                {p.name}
              </Button>
            ))
          ) : (
            <Select
              value={selected.id}
              onChange={(e) => refreshSelected(e.target.value)}
            >
              {nonArchived.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Button plain onClick={() => setShowCreate(true)}>
            {t('addProperty')}
          </Button>
        </div>
      )}

      {nonArchived.length === 1 && (
        <div>
          <Button plain onClick={() => setShowCreate(true)}>
            {t('addProperty')}
          </Button>
        </div>
      )}

      <PropertyEditorInline property={selected} />
      <AssetsTable propertyId={selected.id} sizeUnit={selected.sizeUnit} />

      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)}>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogBody>
            <div className="space-y-3">
              <Input
                placeholder={t('fields.name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder={t('fields.address')}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <Select
                value={form.sizeUnit}
                onChange={(e) => setForm({ ...form, sizeUnit: e.target.value })}
              >
                {SIZE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {tUnit(toCamel(u))}
                  </option>
                ))}
              </Select>
              {err && <Text className="text-red-600">{err}</Text>}
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitCreate} disabled={pending}>
              {t('save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

function toCamel(v: string): string {
  const [head, ...rest] = v.toLowerCase().split('_');
  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
```

- [ ] **Step 3: Create `PropertyEditorInline.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/manage-properties/PropertyEditorInline.tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import {
  updatePropertyAction,
  archivePropertyAction,
  unarchivePropertyAction,
} from '@/src/web/actions/organization/property';
import type { ClientProperty } from './ManagePropertiesClient';

const SIZE_UNITS = [
  'SQUARE_METERS',
  'SQUARE_FEET',
  'HECTARES',
  'ACRES',
  'CUBIC_METERS',
  'LINEAR_METERS',
  'UNIT_COUNT',
  'SHARES',
];

export function PropertyEditorInline({
  property,
}: {
  property: ClientProperty;
}) {
  const t = useTranslations('propertyAdmin');
  const tUnit = useTranslations('propertyAdmin.sizeUnit');
  const [form, setForm] = useState({
    name: property.name,
    address: property.address ?? '',
    sizeUnit: property.sizeUnit,
  });
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    startTransition(async () => {
      const r = await updatePropertyAction({
        propertyId: property.id,
        name: form.name,
        address: form.address.trim() === '' ? null : form.address,
        sizeUnit: form.sizeUnit,
      });
      if (!r.success) {
        setErr(r.error);
        return;
      }
    });
  }

  async function archive() {
    if (!window.confirm(t('archive.confirm'))) {
      return;
    }
    startTransition(async () => {
      const r = await archivePropertyAction({ propertyId: property.id });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      window.location.reload();
    });
  }

  async function unarchive() {
    startTransition(async () => {
      const r = await unarchivePropertyAction({ propertyId: property.id });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          placeholder={t('fields.address')}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Select
          value={form.sizeUnit}
          onChange={(e) => setForm({ ...form, sizeUnit: e.target.value })}
        >
          {SIZE_UNITS.map((u) => (
            <option key={u} value={u}>
              {tUnit(toCamel(u))}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {t('save')}
        </Button>
        {property.archivedAt ? (
          <Button plain onClick={unarchive} disabled={pending}>
            {t('unarchive.button')}
          </Button>
        ) : (
          <Button color="red" onClick={archive} disabled={pending}>
            {t('archive.button')}
          </Button>
        )}
      </div>
      {err && <Text className="text-red-600">{err}</Text>}
    </div>
  );
}

function toCamel(v: string): string {
  const [head, ...rest] = v.toLowerCase().split('_');
  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
```

- [ ] **Step 4: Create `AssetsTable.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/manage-properties/AssetsTable.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import {
  listAssetsAction,
  createAssetAction,
  updateAssetAction,
  archiveAssetAction,
  unarchiveAssetAction,
} from '@/src/web/actions/organization/property';
import { EditOwnersModal } from './EditOwnersModal';

export function AssetsTable({
  propertyId,
  sizeUnit,
}: {
  propertyId: string;
  sizeUnit: string;
}) {
  const t = useTranslations('propertyAdmin');
  const tUnit = useTranslations('propertyAdmin.sizeUnit');
  const [assets, setAssets] = useState<
    {
      id: string;
      name: string;
      size: number;
      archivedAt: string | null;
    }[]
  >([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ name: '', size: '' });
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const r = await listAssetsAction({ propertyId, includeArchived });
    if (r.success) {
      setAssets(r.data.assets);
    }
  }

  useEffect(() => {
    reload();
  }, [propertyId, includeArchived]);

  async function create() {
    setErr(null);
    const size = Number(newForm.size);
    if (!Number.isFinite(size) || size <= 0) {
      setErr(t('fields.sizeMustBePositive'));
      return;
    }
    startTransition(async () => {
      const r = await createAssetAction({
        propertyId,
        name: newForm.name,
        size,
      });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      setNewForm({ name: '', size: '' });
      await reload();
    });
  }

  async function renameAsset(id: string, name: string) {
    startTransition(async () => {
      const r = await updateAssetAction({ assetId: id, name });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      await reload();
    });
  }

  async function resizeAsset(id: string, size: number) {
    startTransition(async () => {
      const r = await updateAssetAction({ assetId: id, size });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      await reload();
    });
  }

  async function toggleArchive(id: string, archived: boolean) {
    if (!archived && !window.confirm(t('archive.assetConfirm'))) {
      return;
    }
    startTransition(async () => {
      const r = archived
        ? await unarchiveAssetAction({ assetId: id })
        : await archiveAssetAction({ assetId: id });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      await reload();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('assets.heading')}</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          {t('assets.includeArchived')}
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-center">
        <Input
          placeholder={t('fields.assetName')}
          value={newForm.name}
          onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
        />
        <Input
          placeholder={tUnit(toCamel(sizeUnit))}
          value={newForm.size}
          onChange={(e) => setNewForm({ ...newForm, size: e.target.value })}
        />
        <Button onClick={create} disabled={pending}>
          {t('assets.add')}
        </Button>
      </div>
      {err && <Text className="text-red-600">{err}</Text>}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {assets.map((a) => (
          <li
            key={a.id}
            className={`py-3 grid grid-cols-1 sm:grid-cols-[1fr_120px_auto_auto_auto] gap-2 items-center ${
              a.archivedAt ? 'opacity-60' : ''
            }`}
          >
            <Input
              defaultValue={a.name}
              onBlur={(e) => {
                if (e.target.value !== a.name) {
                  renameAsset(a.id, e.target.value);
                }
              }}
            />
            <Input
              defaultValue={a.size.toString()}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0 && n !== a.size) {
                  resizeAsset(a.id, n);
                }
              }}
            />
            <Button plain onClick={() => setEditing(a.id)}>
              {t('assets.editOwners')}
            </Button>
            <Button
              plain
              color={a.archivedAt ? 'zinc' : 'red'}
              onClick={() => toggleArchive(a.id, a.archivedAt !== null)}
            >
              {a.archivedAt ? t('unarchive.button') : t('archive.button')}
            </Button>
          </li>
        ))}
      </ul>
      {editing && (
        <EditOwnersModal assetId={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function toCamel(v: string): string {
  const [head, ...rest] = v.toLowerCase().split('_');
  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
```

- [ ] **Step 5: Create `EditOwnersModal.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/manage-properties/EditOwnersModal.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { Text } from '@/src/web/components/catalyst/text';
import {
  listActiveOwnershipForAssetAction,
  replaceAssetOwnersAction,
} from '@/src/web/actions/organization/property';

type Row =
  | { kind: 'user'; userId: string; share: string }
  | { kind: 'external'; label: string; share: string };

export function EditOwnersModal({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const t = useTranslations('propertyAdmin.editOwners');
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const r = await listActiveOwnershipForAssetAction({ assetId });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      setRows(
        r.data.ownerships.map((o) =>
          o.userId
            ? {
                kind: 'user',
                userId: o.userId,
                share: o.share.toString(),
              }
            : {
                kind: 'external',
                label: o.externalOwnerLabel ?? '',
                share: o.share.toString(),
              }
        )
      );
    })();
  }, [assetId]);

  const sum = rows.reduce((s, r) => s + (Number(r.share) || 0), 0);
  const TOLERANCE = 1e-6;
  const validSum = Math.abs(sum - 1) <= TOLERANCE || rows.length === 0;

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(
      rows.map((r, idx) => (idx === i ? ({ ...r, ...patch } as Row) : r))
    );
  }

  async function save() {
    setErr(null);
    startTransition(async () => {
      const r = await replaceAssetOwnersAction({
        assetId,
        owners: rows.map((row) =>
          row.kind === 'user'
            ? {
                kind: 'user',
                userId: row.userId,
                share: Number(row.share),
              }
            : {
                kind: 'external',
                label: row.label,
                share: Number(row.share),
              }
        ),
      });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogBody>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[100px_1fr_120px_auto] gap-2 items-center"
            >
              <Select
                value={row.kind}
                onChange={(e) =>
                  updateRow(i, {
                    kind: e.target.value as 'user' | 'external',
                    ...(e.target.value === 'user'
                      ? { userId: '', label: undefined as any }
                      : { label: '', userId: undefined as any }),
                  })
                }
              >
                <option value="user">{t('kind.user')}</option>
                <option value="external">{t('kind.external')}</option>
              </Select>
              {row.kind === 'user' ? (
                <Input
                  placeholder={t('fields.userId')}
                  value={row.userId}
                  onChange={(e) => updateRow(i, { userId: e.target.value })}
                />
              ) : (
                <Input
                  placeholder={t('fields.externalLabel')}
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                />
              )}
              <Input
                value={row.share}
                onChange={(e) => updateRow(i, { share: e.target.value })}
              />
              <Button
                plain
                color="red"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              >
                {t('remove')}
              </Button>
            </div>
          ))}
          <Button
            plain
            onClick={() =>
              setRows([...rows, { kind: 'user', userId: '', share: '0' }])
            }
          >
            {t('addRow')}
          </Button>
          <Text className={validSum ? 'text-green-700' : 'text-red-600'}>
            {validSum
              ? t('totalValid')
              : t('totalInvalid', { percent: Math.round(sum * 100) })}
          </Text>
          {err && <Text className="text-red-600">{err}</Text>}
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button onClick={save} disabled={!validSum || pending}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 6: Visually verify + commit**

```bash
yarn dev
```

Navigate to `http://localhost:3000/en/organizations/<org-id>/manage-properties` as an admin. Verify:

- Empty org shows CTA.
- Create a property → it appears.
- Rename, change size unit, add assets, edit owners (sum 100% check).

```bash
git add "src/app/[locale]/organizations/[id]/manage-properties"
git commit -m "feat(web): manage-properties admin page (adaptive 0/1/2+) + owners modal"
```

---

## Task 25: Admin UI — `manage-ownership` (cross-property flat table)

**Files:**

- Create: `src/app/[locale]/organizations/[id]/manage-ownership/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/manage-ownership/OwnershipTable.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/manage-ownership/page.tsx
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getOrganizationDetailsAction } from '@/src/web/actions/organization/organization';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { Heading } from '@/src/web/components/catalyst/heading';
import { OwnershipTable } from './OwnershipTable';

const userRepository = new PrismaUserRepository(prisma);

export default async function ManageOwnershipPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('propertyAdmin.ownership');
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const orgRes = await getOrganizationDetailsAction(id);
  if (!orgRes.success) {
    redirect(`/${locale}`);
  }
  const isSuper = await userRepository.isSuperAdmin(user.id);
  if (!orgRes.data.isUserAdmin && !isSuper) {
    redirect(`/${locale}/organizations/${id}`);
  }
  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <OwnershipTable organizationId={id} />
      </div>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create `OwnershipTable.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/manage-ownership/OwnershipTable.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import { listOwnershipRowsAction } from '@/src/web/actions/organization/property';

export function OwnershipTable({ organizationId }: { organizationId: string }) {
  const t = useTranslations('propertyAdmin.ownership');
  const [rows, setRows] = useState<any[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');

  async function reload() {
    const r = await listOwnershipRowsAction({
      organizationId,
      activeOnly,
      userId: userFilter || undefined,
      assetId: assetFilter || undefined,
    });
    if (r.success) {
      setRows(r.data.rows);
    }
  }
  useEffect(() => {
    reload();
  }, [organizationId, activeOnly, userFilter, assetFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          {t('activeOnly')}
        </label>
        <Input
          placeholder={t('filters.userId')}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        />
        <Input
          placeholder={t('filters.assetId')}
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">{t('cols.property')}</th>
              <th>{t('cols.asset')}</th>
              <th>{t('cols.owner')}</th>
              <th>{t('cols.share')}</th>
              <th>{t('cols.from')}</th>
              <th>{t('cols.until')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-1 pr-2">{r.propertyName}</td>
                <td className="pr-2">{r.assetName}</td>
                <td className="pr-2">
                  {r.userId ? r.userId : r.externalOwnerLabel}
                </td>
                <td className="pr-2">{(r.share * 100).toFixed(2)}%</td>
                <td className="pr-2">
                  {new Date(r.effectiveFrom).toLocaleDateString()}
                </td>
                <td className="pr-2">
                  {r.effectiveUntil
                    ? new Date(r.effectiveUntil).toLocaleDateString()
                    : t('active')}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-center">
                  <Text>{t('empty')}</Text>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/organizations/[id]/manage-ownership"
git commit -m "feat(web): manage-ownership admin page (flat cross-property table)"
```

---

## Task 26: Admin UI — `property-claims` pending queue

**Files:**

- Create: `src/app/[locale]/organizations/[id]/property-claims/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/property-claims/ClaimsQueue.tsx`

- [ ] **Step 1: Create `page.tsx`**

Same auth pattern as manage-ownership. Then render `ClaimsQueue`.

```tsx
// src/app/[locale]/organizations/[id]/property-claims/page.tsx
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getOrganizationDetailsAction } from '@/src/web/actions/organization/organization';
import { listPendingClaimsForOrgAction } from '@/src/web/actions/organization/propertyClaim';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { Heading } from '@/src/web/components/catalyst/heading';
import { ClaimsQueue } from './ClaimsQueue';

const userRepository = new PrismaUserRepository(prisma);

export default async function PropertyClaimsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('propertyClaim.admin');
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const orgRes = await getOrganizationDetailsAction(id);
  if (!orgRes.success) {
    redirect(`/${locale}`);
  }
  const isSuper = await userRepository.isSuperAdmin(user.id);
  if (!orgRes.data.isUserAdmin && !isSuper) {
    redirect(`/${locale}/organizations/${id}`);
  }
  const r = await listPendingClaimsForOrgAction({ organizationId: id });
  const rows = r.success ? r.data.rows : [];
  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <ClaimsQueue initialRows={rows} />
      </div>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create `ClaimsQueue.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/property-claims/ClaimsQueue.tsx
'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import {
  approvePropertyClaimAction,
  denyPropertyClaimAction,
} from '@/src/web/actions/organization/propertyClaim';

export interface ClaimRow {
  id: string;
  assetId: string;
  assetName: string;
  propertyId: string;
  propertyName: string;
  claimantFirstName: string;
  claimantLastName: string;
  claimantMiddleName: string | null;
  externalOwnerLabel: string | null;
  createdAt: string;
}

export function ClaimsQueue({ initialRows }: { initialRows: ClaimRow[] }) {
  const t = useTranslations('propertyClaim.admin');
  const [rows, setRows] = useState(initialRows);
  const [denying, setDenying] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function approve(id: string) {
    if (!window.confirm(t('approve.confirm'))) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await approvePropertyClaimAction({ claimId: id });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      setRows(rows.filter((x) => x.id !== id));
    });
  }

  async function deny() {
    if (!denying) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await denyPropertyClaimAction({
        claimId: denying,
        reason,
      });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      setRows(rows.filter((x) => x.id !== denying));
      setDenying(null);
      setReason('');
    });
  }

  return (
    <div className="space-y-3">
      {err && <Text className="text-red-600">{err}</Text>}
      {rows.length === 0 && <Text>{t('empty')}</Text>}
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="py-3 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium">
                {r.claimantLastName} {r.claimantFirstName}{' '}
                {r.claimantMiddleName}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {r.propertyName} · {r.assetName}
                {r.externalOwnerLabel && (
                  <>
                    {' '}
                    · {t('label')}: {r.externalOwnerLabel}
                  </>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <Button
              color="brand-green"
              onClick={() => approve(r.id)}
              disabled={pending}
            >
              {t('approve.button')}
            </Button>
            <Button
              color="red"
              onClick={() => {
                setDenying(r.id);
                setReason('');
              }}
              disabled={pending}
            >
              {t('deny.button')}
            </Button>
          </li>
        ))}
      </ul>
      {denying && (
        <Dialog open onClose={() => setDenying(null)}>
          <DialogTitle>{t('deny.title')}</DialogTitle>
          <DialogBody>
            <Input
              placeholder={t('deny.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setDenying(null)}>
              {t('cancel')}
            </Button>
            <Button color="red" onClick={deny} disabled={pending}>
              {t('deny.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/organizations/[id]/property-claims"
git commit -m "feat(web): property-claims admin queue"
```

---

## Task 27: Member UI — "Properties" section on org page (server-side gated)

**Files:**

- Modify: `src/app/[locale]/organizations/[id]/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/PropertiesSection.tsx`

- [ ] **Step 1: Create `PropertiesSection.tsx` (Client Component)**

```tsx
// src/app/[locale]/organizations/[id]/PropertiesSection.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { Divider } from '@/src/web/components/catalyst/divider';

export interface SafeProperty {
  id: string;
  name: string;
  address: string | null;
}

export function PropertiesSection({
  organizationId,
  properties,
}: {
  organizationId: string;
  properties: SafeProperty[];
}) {
  const t = useTranslations('propertyClaim.section');
  return (
    <div id="properties">
      <Divider />
      <div className="space-y-4">
        <Heading level={2}>{t('title')}</Heading>
        {properties.length === 0 && <Text>{t('empty')}</Text>}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {properties.map((p) => (
            <li key={p.id} className="py-3 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{p.name}</div>
                {p.address && (
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.address}
                  </div>
                )}
              </div>
              <Link
                href={`/organizations/${organizationId}/properties/${p.id}/claim-assets`}
              >
                <Button color="brand-green">{t('claim')}</Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `src/app/[locale]/organizations/[id]/page.tsx`**

Add a server-side gate that skips fetching entirely for non-members/non-admins/non-superadmins. Add these new additions:

Imports (append to existing imports):

```tsx
import { listOrgPropertiesForMemberAction } from '@/src/web/actions/organization/propertyClaim';
import { PropertiesSection } from './PropertiesSection';
```

Inside the component, after the existing `isSuperAdmin` resolution and **before** the return statement, add:

```tsx
let safeProperties:
  | { id: string; name: string; address: string | null }[]
  | null = null;
if (user && (isUserMember || isUserAdmin || isSuperAdmin)) {
  const r = await listOrgPropertiesForMemberAction({ organizationId: id });
  if (r.success) {
    safeProperties = r.data.properties;
  }
}
```

In the JSX, add (right after the existing `MembershipSection` block, before the Members section):

```tsx
{
  safeProperties && (
    <PropertiesSection organizationId={id} properties={safeProperties} />
  );
}
```

- [ ] **Step 3: Security verification**

Visually confirm in browser DevTools → Network:

- As a non-member (logged out or different user), inspect the rendered HTML of the org page. `PropertiesSection` must be absent; no property data in JSON responses.
- As a member, verify the response contains only `{ id, name, address }` — no `sizeUnit`, no `archivedAt`, no asset/ownership data.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/organizations/[id]/page.tsx" "src/app/[locale]/organizations/[id]/PropertiesSection.tsx"
git commit -m "feat(web): org page Properties section (server-side gated, projection-safe)"
```

---

## Task 28: Member UI — Per-property claim page

**Files:**

- Create: `src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/page.tsx`
- Create: `src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/ClaimAssetsClient.tsx`
- Create: `src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/MyClaimsList.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/page.tsx
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getCurrentUser } from '@/web/lib/session';
import {
  listClaimableAssetsAction,
  listMyClaimsForPropertyAction,
} from '@/src/web/actions/organization/propertyClaim';
import { Heading } from '@/src/web/components/catalyst/heading';
import { ClaimAssetsClient } from './ClaimAssetsClient';
import { MyClaimsList } from './MyClaimsList';

export default async function ClaimAssetsPage({
  params,
}: {
  params: Promise<{ id: string; propertyId: string; locale: string }>;
}) {
  const { id, propertyId, locale } = await params;
  const t = await getTranslations('propertyClaim.page');
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const [assetsRes, myClaimsRes] = await Promise.all([
    listClaimableAssetsAction({ organizationId: id, propertyId }),
    listMyClaimsForPropertyAction({ organizationId: id, propertyId }),
  ]);

  if (!assetsRes.success) {
    redirect(`/${locale}/organizations/${id}`);
  }
  const myClaims = myClaimsRes.success ? myClaimsRes.data.rows : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <ClaimAssetsClient organizationId={id} assets={assetsRes.data.assets} />
        <MyClaimsList claims={myClaims} />
      </div>
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create `ClaimAssetsClient.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/ClaimAssetsClient.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import { submitPropertyClaimAction } from '@/src/web/actions/organization/propertyClaim';

export function ClaimAssetsClient({
  organizationId,
  assets,
}: {
  organizationId: string;
  assets: { id: string; name: string }[];
}) {
  const t = useTranslations('propertyClaim.page');
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      assets.filter((a) =>
        a.name.toLowerCase().includes(q.trim().toLowerCase())
      ),
    [assets, q]
  );

  async function submit(assetId: string) {
    setErr(null);
    startTransition(async () => {
      const r = await submitPropertyClaimAction({
        organizationId,
        assetId,
      });
      if (!r.success) {
        setErr(r.error);
        return;
      }
      setSuccessId(assetId);
      setConfirming(null);
    });
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder={t('search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {err && <Text className="text-red-600">{err}</Text>}
      <ul className="divide-y">
        {filtered.map((a) => (
          <li key={a.id} className="py-2 flex items-center justify-between">
            <span>{a.name}</span>
            {successId === a.id ? (
              <Text className="text-green-700">{t('submitted')}</Text>
            ) : (
              <Button
                color="brand-green"
                onClick={() => setConfirming(a.id)}
                disabled={pending}
              >
                {t('claim')}
              </Button>
            )}
          </li>
        ))}
        {filtered.length === 0 && <Text>{t('empty')}</Text>}
      </ul>
      {confirming && (
        <Dialog open onClose={() => setConfirming(null)}>
          <DialogTitle>{t('confirm.title')}</DialogTitle>
          <DialogBody>
            <Text>{t('confirm.body')}</Text>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setConfirming(null)}>
              {t('cancel')}
            </Button>
            <Button
              color="brand-green"
              onClick={() => submit(confirming)}
              disabled={pending}
            >
              {t('confirm.submit')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `MyClaimsList.tsx`**

```tsx
// src/app/[locale]/organizations/[id]/properties/[propertyId]/claim-assets/MyClaimsList.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';

export function MyClaimsList({
  claims,
}: {
  claims: {
    id: string;
    assetName: string;
    status: string;
    deniedReason: string | null;
    createdAt: string;
    decidedAt: string | null;
  }[];
}) {
  const t = useTranslations('propertyClaim.myClaims');
  const tStatus = useTranslations('propertyClaim.status');
  if (claims.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      <Heading level={2}>{t('title')}</Heading>
      <ul className="divide-y">
        {claims.map((c) => (
          <li key={c.id} className="py-2">
            <div className="font-medium">{c.assetName}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {tStatus(c.status.toLowerCase())} ·{' '}
              {new Date(c.createdAt).toLocaleDateString()}
            </div>
            {c.status === 'DENIED' && c.deniedReason && (
              <Text className="text-sm text-red-600">
                {t('reasonLabel')}: {c.deniedReason}
              </Text>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/organizations/[id]/properties"
git commit -m "feat(web): per-property claim-assets page (projection-safe)"
```

---

## Task 29: Member UI — Home-page org-card "Claim property" shortcut

**Files:**

- Modify: `src/web/actions/organization/organization.ts` (or the specific action that feeds home-page cards — see Step 0)
- Modify: home-page org-card component (discovered in Step 0)

- [ ] **Step 0: Locate home-page org-card**

Run:

```bash
grep -rn "organizations/\${" "src/app/[locale]/home" src/web/components 2>/dev/null | head
grep -rn "getUserOrganizationsAction\|getUserOrganizations" src/web 2>/dev/null | head
```

Identify:

1. The server action returning the home user's orgs (e.g. `getUserOrganizationsAction` or an action inside `organization.ts`).
2. The component that renders a card per returned org.

- [ ] **Step 1: Extend the action to include `hasProperties`**

In the relevant action, after fetching the list of orgs the user is a member of, call `propertyRepository.hasAnyNonArchived(orgIds)` (added in Task 10), and include a `hasProperties: boolean` flag per org in the returned payload.

Example diff (adjust to match actual file):

```typescript
import { PrismaOrganizationPropertyRepository } from '@/infrastructure/index';
const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);

// ...inside action...
const orgIds = orgs.map((o) => o.id);
const flags = await propertyRepository.hasAnyNonArchived(orgIds);
const hasPropertiesMap = flags.success
  ? flags.value
  : new Map<string, boolean>();
return {
  success: true,
  data: {
    organizations: orgs.map((o) => ({
      ...existingProjection(o),
      hasProperties: hasPropertiesMap.get(o.id) === true,
    })),
  },
};
```

- [ ] **Step 2: Extend the home-card component to show the shortcut**

Add props `hasProperties: boolean`. If true (and the viewer is a member of that org — already implicit in home-page query), render a secondary `Button`:

```tsx
import { Link } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import { useTranslations } from 'next-intl';

// inside the component JSX:
{
  hasProperties && (
    <Link href={`/organizations/${org.id}#properties`}>
      <Button plain color="brand-green">
        {useTranslations('propertyClaim.shortcut')('claim')}
      </Button>
    </Link>
  );
}
```

- [ ] **Step 3: Visually verify**

```bash
yarn dev
```

As a member of an org that has at least one property, the home page card shows "Claim property". Clicking navigates to `/organizations/<id>#properties` — the Properties section anchor. As a member of an org with zero properties, the button is absent.

- [ ] **Step 4: Commit**

```bash
git add src/web/actions/organization/organization.ts
git add <home-card component path from Step 0>
git commit -m "feat(web): home-page org card Claim-property shortcut"
```

---

## Task 30: Localization — `propertyAdmin.*` + `propertyClaim.*` keys

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add keys to `messages/en.json`**

Open `messages/en.json`. Add a new top-level section (alphabetical position is OK; both languages must match):

```json
"propertyAdmin": {
  "title": "Manage properties",
  "save": "Save",
  "cancel": "Cancel",
  "addProperty": "Add property",
  "empty": {
    "cta": "You don't have any properties yet.",
    "create": "Create your first property"
  },
  "create": { "title": "Create property" },
  "fields": {
    "name": "Name",
    "address": "Address",
    "assetName": "Asset name",
    "sizeMustBePositive": "Size must be greater than 0"
  },
  "archive": {
    "button": "Archive",
    "confirm": "Archive this property? Its assets will also be archived.",
    "assetConfirm": "Archive this asset?"
  },
  "unarchive": { "button": "Unarchive" },
  "assets": {
    "heading": "Assets",
    "add": "Add asset",
    "editOwners": "Edit owners",
    "includeArchived": "Show archived"
  },
  "editOwners": {
    "title": "Edit owners",
    "kind": { "user": "Registered user", "external": "External owner" },
    "fields": { "userId": "User ID", "externalLabel": "Owner label" },
    "addRow": "Add owner",
    "remove": "Remove",
    "totalValid": "Total 100% — OK",
    "totalInvalid": "Total {percent}% — adjust to 100%"
  },
  "sizeUnit": {
    "squareMeters": "m²",
    "squareFeet": "ft²",
    "hectares": "ha",
    "acres": "ac",
    "cubicMeters": "m³",
    "linearMeters": "m",
    "unitCount": "units",
    "shares": "shares"
  },
  "ownership": {
    "title": "Ownership",
    "activeOnly": "Active only",
    "filters": { "userId": "Filter by user id", "assetId": "Filter by asset id" },
    "cols": {
      "property": "Property",
      "asset": "Asset",
      "owner": "Owner",
      "share": "Share",
      "from": "From",
      "until": "Until"
    },
    "active": "Active",
    "empty": "No ownership rows"
  }
},
"propertyClaim": {
  "section": {
    "title": "Properties",
    "empty": "This organization has no properties yet.",
    "claim": "Claim"
  },
  "shortcut": { "claim": "Claim property" },
  "page": {
    "title": "Claim an asset",
    "search": "Search",
    "claim": "Claim",
    "submitted": "Submitted",
    "empty": "No claimable assets here right now.",
    "confirm": {
      "title": "Submit claim?",
      "body": "An admin will verify and approve your claim.",
      "submit": "Submit"
    },
    "cancel": "Cancel"
  },
  "myClaims": {
    "title": "Your claims for this property",
    "reasonLabel": "Denial reason"
  },
  "status": {
    "pending": "Pending",
    "approved": "Approved",
    "denied": "Denied"
  },
  "admin": {
    "title": "Pending property claims",
    "empty": "No pending claims.",
    "label": "Recorded as",
    "cancel": "Cancel",
    "approve": {
      "button": "Approve",
      "confirm": "Approve this claim? Any other pending claims for this asset will be auto-denied."
    },
    "deny": {
      "button": "Deny",
      "title": "Deny claim",
      "reasonPlaceholder": "Reason (required)",
      "confirm": "Deny"
    }
  },
  "submit": { "success": "Claim submitted. An admin will review." },
  "deny": { "reasonRequired": "Denial reason is required." },
  "banner": { "alreadyClaimed": "This asset is already under review for another claim." }
}
```

Also add notification keys under the existing `notification.types` namespace:

```json
"propertyClaimSubmitted": {
  "title": "New property claim",
  "body": "A member submitted a claim. Review in the queue."
},
"propertyClaimApproved": {
  "title": "Your claim was approved",
  "body": "You are now linked as the owner of this asset."
},
"propertyClaimDenied": {
  "title": "Your claim was denied",
  "body": "See the denial reason for details."
}
```

Also add the domain-code keys under `domain.organization`:

```json
"propertyNotFound": "Property not found",
"propertyAlreadyArchived": "Property is already archived",
"propertyNotArchived": "Property is not archived",
"propertyAssetNotFound": "Asset not found",
"propertyAssetAlreadyArchived": "Asset is already archived",
"propertyAssetNotArchived": "Asset is not archived",
"sizeUnitInvalid": "Unsupported size unit",
"sharesDoNotSumToOne": "Shares must sum to 100%",
"ownerRepresentationInvalid": "Exactly one of user or external owner label must be set",
"externalOwnerLabelEmpty": "External owner label is required",
"correctionReasonEmpty": "Correction reason is required",
"cannotCorrectLockedProperty": "Cannot correct ownership: property is locked by a past poll",
"ownershipRowNotFound": "Ownership row not found",
"ownershipRowNotActive": "Ownership row is no longer active",
"propertyClaimNotFound": "Property claim not found",
"propertyClaimNotPending": "Property claim is not pending",
"propertyClaimDenialReasonEmpty": "Denial reason is required",
"propertyClaimAlreadyPendingForAsset": "This asset is already under review for another claim",
"propertyClaimRepeatBlockedWithin24h": "Wait 24 hours before re-submitting a claim for this asset",
"propertyClaimAssetNotClaimable": "This asset is no longer claimable",
"notOrgMember": "You are not a member of this organization"
```

- [ ] **Step 2: Mirror the same keys in `messages/ru.json` with Russian translations**

Use natural Russian for each key (e.g. `"title": "Управление объектами недвижимости"`, `"claim": "Заявить"`, `"squareMeters": "м²"`, `"sharesDoNotSumToOne": "Доли должны в сумме давать 100%"`, etc.). Keys must mirror the en.json structure exactly.

- [ ] **Step 3: Verify next-intl compiles**

```bash
yarn tsc --noEmit
yarn dev
```

Switch between `/en/` and `/ru/` routes on the new pages. No `MISSING_MESSAGE` warnings in console.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ru.json
git commit -m "i18n: propertyAdmin + propertyClaim localization (en, ru)"
```

---

## Task 31: Manual QA + final verification

**Files:** none.

- [ ] **Step 1: Run all tests**

```bash
yarn test
```

Expected: all existing + new tests pass. Investigate failures before continuing.

- [ ] **Step 2: Type-check the codebase**

```bash
yarn tsc --noEmit
```

Expected: no new errors introduced by this PR (pre-existing errors in unrelated test files are acceptable — do not fix project-wide tsc issues in this PR).

- [ ] **Step 3: Lint**

```bash
yarn lint
```

Expected: clean.

- [ ] **Step 4: Manual QA — end-to-end walkthrough**

Start the dev server: `yarn dev`. Seed or manually create an org with you as admin. Walk through:

1. **Create property with `SQUARE_METERS`** → add 3 assets: two with registered-user owners, one with `externalOwnerLabel` (use Edit owners modal, select "External owner", enter label like "Record owner of Apt #101", share 1.0). Verify the sum-check UI shows 100% before enabling Save.
2. **Register a second user** in the org and accept their join. Log in as them.
3. **Home page**: verify the new org card shows "Claim property" button.
4. **Click "Claim property"** → redirects to `/organizations/<id>#properties`. The "Properties" section is visible. Inspect DevTools → Network. The response fed into `PropertiesSection` carries ONLY `{ id, name, address }` per property. No `sizeUnit`, `archivedAt`, or any asset/ownership data.
5. **Log out, revisit the org page as anonymous** → "Properties" section is absent from the HTML. The `listOrgPropertiesForMemberAction` response in the Network tab is an error response, never leaking property data.
6. **Log back in as the second user**, click "Claim" on the property → per-property claim page. Verify the asset list response carries ONLY `{ id, name }[]`. Search the page source for the `externalOwnerLabel` string — it must not appear.
7. **Click "Claim" on the external-owner asset**, confirm the dialog. "Submitted" badge appears; refresh the page and confirm the claim shows in "Your claims" with status "Pending".
8. **Admin notification**: as the admin, check the notifications bell — a new notification "New property claim" is there.
9. **Admin visits `/organizations/<id>/property-claims`** → the queue shows the claim with the claimant name, asset, property, and the `externalOwnerLabel`. **Approve**.
10. **Claimant notification**: switch to the claimant — notification "Your claim was approved" appears.
11. **Run a poll with `OWNERSHIP_SIZE_WEIGHTED`** scoped to this property → take snapshot → verify the newly-registered user is now in `poll_eligible_members` and their weight reflects the claimed asset.
12. **Correct vs End-and-replace**: on an unlocked property, click "Edit owners" on a different asset, reduce one user's share and add another — sum must stay 100%. Save. In `manage-ownership`, verify a new row was inserted with today's `effectiveFrom` and the old row has `effectiveUntil` set (SCD-2).
13. **Lock verification**: after the snapshot from Step 11, try to "Correct" (in-place) an ownership row on the scoped property — expect an error `Cannot correct ownership: property is locked by a past poll`. Meanwhile "End-and-replace" should still work.
14. **Archive a property**: cascade-archives its assets; any pending claims auto-deny with notification; poll weights taken earlier remain unchanged.
15. **Unarchive**: property and its archived assets reappear; current ownership query returns them again.
16. **Switch to Russian locale** (`/ru/organizations/<id>/manage-properties`): all UI strings display in Russian; no `MISSING_MESSAGE` in console.

- [ ] **Step 5: If everything passes — mark the PR ready**

No commit — the completion of this task is ephemeral verification.

---

## Open Questions

None at plan-writing time; the spec in `readmes/2026-04-19-property-admin-design.md` captures every decision made during brainstorming. If the implementer surfaces a new ambiguity during any Step 0 discovery, pause and escalate.
