# Weight Distribution Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let polls compute participant weights automatically from organization-level asset ownership, scoped to selected properties (buildings, parking lots, etc.), with a preview/save workflow for later type or scope changes.

**Architecture:** DDD. New `organization_properties`, `property_assets`, `property_asset_ownerships`, `poll_properties`, `poll_eligible_members` tables. Pure domain function `WeightDistribution` handles every mode × aggregation combination. Use cases `TakeSnapshot` (updated), `PreviewPollWeightConfig` (new), `UpdatePollWeightConfig` (new). Multi-select UI on poll creation + Participants page, shared preview/save. Admin data-entry UI for properties/assets is a **follow-up PR** — this plan assumes test data is seeded programmatically.

**Tech Stack:** Prisma 7 (PostgreSQL), Vitest 4, Next.js 15 (App Router), React, Tailwind + Catalyst, next-intl.

**Spec:** `readmes/2026-04-18-weight-distribution-types-design.md`

---

## File Map

### Task 1 — Prisma schema (tables, columns, precision)

- Modify: `prisma/schema.prisma`

### Task 2 — Backfill migration for `poll_eligible_members`

- Create: `prisma/migrations/<timestamp>_backfill_poll_eligible_members/migration.sql` (via `prisma migrate dev --create-only`)

### Task 3 — Domain: `DistributionType` value object

- Create: `src/domain/poll/DistributionType.ts`
- Create: `src/domain/poll/__tests__/DistributionType.test.ts`

### Task 4 — Domain: `PropertyAggregation` value object

- Create: `src/domain/poll/PropertyAggregation.ts`
- Create: `src/domain/poll/__tests__/PropertyAggregation.test.ts`

### Task 5 — Domain: `PollWeightConfig` value object

- Create: `src/domain/poll/PollWeightConfig.ts`
- Create: `src/domain/poll/__tests__/PollWeightConfig.test.ts`

### Task 6 — Domain: new codes + error-code union updates

- Modify: `src/domain/poll/PollDomainCodes.ts`
- Modify: `src/domain/organization/OrganizationDomainCodes.ts`
- Modify: `src/application/poll/PollErrors.ts`

### Task 7 — Domain: `OrganizationProperty` entity

- Create: `src/domain/organization/OrganizationProperty.ts`
- Create: `src/domain/organization/__tests__/OrganizationProperty.test.ts`

### Task 8 — Domain: `PropertyAsset` entity (with `size > 0` invariant)

- Create: `src/domain/organization/PropertyAsset.ts`
- Create: `src/domain/organization/__tests__/PropertyAsset.test.ts`

### Task 9 — Domain: `PropertyAssetOwnership` entity

- Create: `src/domain/organization/PropertyAssetOwnership.ts`
- Create: `src/domain/organization/__tests__/PropertyAssetOwnership.test.ts`

### Task 10 — Domain: `PollEligibleMember` entity

- Create: `src/domain/poll/PollEligibleMember.ts`
- Create: `src/domain/poll/__tests__/PollEligibleMember.test.ts`

### Task 11 — Domain: repository ports

- Create: `src/domain/organization/OrganizationPropertyRepository.ts`
- Create: `src/domain/organization/PropertyAssetRepository.ts`
- Create: `src/domain/poll/PollEligibleMemberRepository.ts`

### Task 12 — Domain: `WeightDistribution` pure function (TDD, multi-step)

- Create: `src/domain/poll/WeightDistribution.ts`
- Create: `src/domain/poll/__tests__/WeightDistribution.test.ts`

### Task 13 — Infrastructure: `PrismaOrganizationPropertyRepository`

- Create: `src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts`

### Task 14 — Infrastructure: `PrismaPropertyAssetRepository`

- Create: `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`

### Task 15 — Infrastructure: `PrismaPollEligibleMemberRepository`

- Create: `src/infrastructure/repositories/PrismaPollEligibleMemberRepository.ts`

### Task 16 — Infrastructure: extend `PrismaParticipantRepository` with batched reconfigure + `poll_properties` writes

- Modify: `src/infrastructure/repositories/PrismaParticipantRepository.ts`

### Task 17 — Infrastructure: extend `PrismaPollRepository` to read/write `distribution_type`, `property_aggregation`, and `poll_properties`

- Modify: `src/infrastructure/repositories/PrismaPollRepository.ts`
- Modify: `src/domain/poll/Poll.ts` (add `distributionType`, `propertyAggregation`, `propertyIds` fields)
- Modify: `src/domain/poll/PollRepository.ts` (adjust signatures if needed)

### Task 18 — Application: update `TakeSnapshotUseCase`

- Modify: `src/application/poll/TakeSnapshotUseCase.ts`
- Modify: `src/application/poll/__tests__/TakeSnapshotUseCase.test.ts` (create if missing)

### Task 19 — Application: `PreviewPollWeightConfigUseCase`

- Create: `src/application/poll/PreviewPollWeightConfigUseCase.ts`
- Create: `src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts`

### Task 20 — Application: `UpdatePollWeightConfigUseCase`

- Create: `src/application/poll/UpdatePollWeightConfigUseCase.ts`
- Create: `src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts`

### Task 21 — Web server actions: preview + update

- Modify: `src/web/actions/poll/poll.ts` (add `previewPollWeightConfig`, `updatePollWeightConfig`, extend `createPoll` to accept config)

### Task 22 — Localization

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

### Task 23 — UI: `WeightConfigEditor` + sub-components

- Create: `src/web/components/polls/participants/WeightConfigEditor.tsx`
- Create: `src/web/components/polls/participants/DistributionTypeSelector.tsx`
- Create: `src/web/components/polls/participants/PropertyScopeSelector.tsx`
- Create: `src/web/components/polls/participants/PropertyAggregationSelector.tsx`
- Create: `src/web/components/polls/shared/weightDisplay.ts` (pure helper)

### Task 24 — UI: wire editor into `ParticipantManagement`

- Modify: `src/web/components/polls/participants/ParticipantManagement.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/participants/page.tsx`

### Task 25 — UI: poll creation form integration

- Modify: poll creation form (path discovered in Task 25 Step 0)

### Task 26 — UI: results-page label

- Create: `src/web/components/polls/results/WeightConfigLabel.tsx`
- Modify: poll results page (path discovered in Task 26 Step 0)

### Task 27 — Seed data for QA

- Modify: `prisma/seed.ts`

---

## Task 1: Prisma schema

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Read the existing polls model**

Run:

```bash
grep -n "model Poll\b\|@@map(\"polls\")" prisma/schema.prisma
```

Open `prisma/schema.prisma` and locate the `Poll` model block. Keep its line range in mind for later edits.

- [ ] **Step 2: Add `distributionType` and `propertyAggregation` columns to `Poll`**

Inside the `Poll` model, add (near the other scalar fields, before the relation block):

```prisma
distributionType     String  @default("EQUAL")    @map("distribution_type")
propertyAggregation  String  @default("RAW_SUM")  @map("property_aggregation")

properties      PollProperty[]
eligibleMembers PollEligibleMember[]
```

- [ ] **Step 3: Widen `Decimal(10, 2)` to `Decimal(15, 6)` on three columns**

In the `Vote` model, change:

```prisma
userWeight Decimal  @default(1.0) @map("user_weight") @db.Decimal(15, 6)
```

In the `PollParticipant` model:

```prisma
userWeight          Decimal  @default(1.0) @map("user_weight") @db.Decimal(15, 6)
```

In the `ParticipantWeightHistory` model:

```prisma
oldWeight     Decimal  @db.Decimal(15, 6) @map("old_weight")
newWeight     Decimal  @db.Decimal(15, 6) @map("new_weight")
```

- [ ] **Step 4: Add `OrganizationProperty` model**

Append to the bottom of the file (before the final closing brace of the file, outside any model):

```prisma
model OrganizationProperty {
  id             String    @id @default(cuid())
  organizationId String    @map("organization_id")
  name           String
  address        String?
  createdAt      DateTime  @default(now()) @map("created_at")
  archivedAt     DateTime? @map("archived_at")

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  assets       PropertyAsset[]
  polls        PollProperty[]

  @@index([organizationId])
  @@map("organization_properties")
}
```

Also add the reverse relation inside the `Organization` model (find the existing relations block and append):

```prisma
properties OrganizationProperty[]
```

- [ ] **Step 5: Add `PropertyAsset` model**

```prisma
model PropertyAsset {
  id          String    @id @default(cuid())
  propertyId  String    @map("property_id")
  name        String
  size        Decimal   @db.Decimal(15, 6)
  createdAt   DateTime  @default(now()) @map("created_at")
  archivedAt  DateTime? @map("archived_at")

  property   OrganizationProperty     @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  ownerships PropertyAssetOwnership[]

  @@index([propertyId])
  @@map("property_assets")
}
```

- [ ] **Step 6: Add `PropertyAssetOwnership` model**

```prisma
model PropertyAssetOwnership {
  id             String    @id @default(cuid())
  assetId        String    @map("asset_id")
  userId         String    @map("user_id")
  share          Decimal   @db.Decimal(9, 8)
  effectiveFrom  DateTime  @default(now()) @map("effective_from")
  effectiveUntil DateTime? @map("effective_until")
  createdAt      DateTime  @default(now()) @map("created_at")

  asset PropertyAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  user  User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([assetId, effectiveUntil])
  @@index([userId, effectiveUntil])
  @@map("property_asset_ownerships")
}
```

Also add the reverse relation inside the `User` model:

```prisma
propertyOwnerships PropertyAssetOwnership[]
```

- [ ] **Step 7: Add `PollProperty` junction model**

```prisma
model PollProperty {
  pollId     String @map("poll_id")
  propertyId String @map("property_id")

  poll     Poll                 @relation(fields: [pollId], references: [id], onDelete: Cascade)
  property OrganizationProperty @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  @@id([pollId, propertyId])
  @@index([pollId])
  @@map("poll_properties")
}
```

- [ ] **Step 8: Add `PollEligibleMember` model**

```prisma
model PollEligibleMember {
  id         String   @id @default(cuid())
  pollId     String   @map("poll_id")
  userId     String   @map("user_id")
  snapshotAt DateTime @map("snapshot_at")
  createdAt  DateTime @default(now()) @map("created_at")

  poll Poll @relation(fields: [pollId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([pollId, userId])
  @@index([pollId])
  @@map("poll_eligible_members")
}
```

Also add reverse relation inside `User`:

```prisma
pollEligibilities PollEligibleMember[]
```

- [ ] **Step 9: Generate migration**

```bash
yarn prisma migrate dev --name add_weight_distribution_types --create-only
```

Expected: new directory under `prisma/migrations/<timestamp>_add_weight_distribution_types/` with a `migration.sql` file.

- [ ] **Step 10: Open migration.sql and add `CHECK (size > 0)`**

Prisma doesn't generate CHECK constraints for decimals. Open the newly created `migration.sql` and append (at the very end):

```sql
ALTER TABLE "property_assets" ADD CONSTRAINT "property_assets_size_positive_chk" CHECK ("size" > 0);
ALTER TABLE "property_asset_ownerships" ADD CONSTRAINT "property_asset_ownerships_share_range_chk" CHECK ("share" >= 0 AND "share" <= 1);
```

- [ ] **Step 11: Apply migration + generate client**

```bash
yarn prisma migrate dev
yarn prisma generate
```

Expected: migration applied, Prisma client regenerated.

- [ ] **Step 12: Verify type-check passes**

```bash
yarn tsc --noEmit 2>&1 | head -30
```

Expected: no schema-related errors. Other parts of the code may complain about new `Poll.distributionType` / `propertyAggregation` fields on the entity class — we'll address them in Task 17.

- [ ] **Step 13: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add tables and columns for weight distribution types"
```

---

## Task 2: Backfill migration for `poll_eligible_members`

**Files:**

- Create: `prisma/migrations/<timestamp>_backfill_poll_eligible_members/migration.sql`

Goal: existing polls were all taken under implicit `EQUAL` semantics, so their `poll_eligible_members` set equals their current `poll_participants` set. Seed that data now so post-deploy behavior is immediate and does not require re-snapshotting.

- [ ] **Step 1: Create empty migration**

```bash
yarn prisma migrate dev --name backfill_poll_eligible_members --create-only
```

- [ ] **Step 2: Replace the generated SQL**

Open the newly created `migration.sql` and replace its contents with:

```sql
-- Backfill poll_eligible_members from poll_participants for pre-feature polls.
-- Uses UUIDv4 via gen_random_uuid if available; fall back to a CUID-compatible string generator is unnecessary
-- because existing poll_participants rows have cuid ids and we only need uniqueness, not a specific format.
INSERT INTO "poll_eligible_members" ("id", "poll_id", "user_id", "snapshot_at", "created_at")
SELECT
  concat('bk_', pp."id") AS id,
  pp."poll_id",
  pp."user_id",
  pp."snapshot_at",
  NOW()
FROM "poll_participants" pp
ON CONFLICT ("poll_id", "user_id") DO NOTHING;
```

- [ ] **Step 3: Apply migration**

```bash
yarn prisma migrate dev
```

Expected: migration applied; `SELECT COUNT(*) FROM poll_eligible_members;` equals `SELECT COUNT(*) FROM poll_participants;` in your dev DB.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations
git commit -m "feat(db): backfill poll_eligible_members from existing snapshots"
```

---

## Task 3: Domain — `DistributionType`

**Files:**

- Create: `src/domain/poll/DistributionType.ts`
- Create: `src/domain/poll/__tests__/DistributionType.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/poll/__tests__/DistributionType.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DistributionType, parseDistributionType } from '../DistributionType';

describe('DistributionType', () => {
  it('has three values', () => {
    expect(DistributionType.EQUAL).toBe('EQUAL');
    expect(DistributionType.OWNERSHIP_UNIT_COUNT).toBe('OWNERSHIP_UNIT_COUNT');
    expect(DistributionType.OWNERSHIP_SIZE_WEIGHTED).toBe(
      'OWNERSHIP_SIZE_WEIGHTED'
    );
  });

  describe('parseDistributionType', () => {
    it.each(['EQUAL', 'OWNERSHIP_UNIT_COUNT', 'OWNERSHIP_SIZE_WEIGHTED'])(
      'accepts %s',
      (v) => {
        const result = parseDistributionType(v);
        expect(result.success).toBe(true);
      }
    );

    it('rejects unknown values', () => {
      const result = parseDistributionType('SOMETHING_ELSE');
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = parseDistributionType('');
      expect(result.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
yarn test src/domain/poll/__tests__/DistributionType.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/domain/poll/DistributionType.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export const DistributionType = {
  EQUAL: 'EQUAL',
  OWNERSHIP_UNIT_COUNT: 'OWNERSHIP_UNIT_COUNT',
  OWNERSHIP_SIZE_WEIGHTED: 'OWNERSHIP_SIZE_WEIGHTED',
} as const;

export type DistributionType =
  (typeof DistributionType)[keyof typeof DistributionType];

export function parseDistributionType(
  value: string
): Result<DistributionType, string> {
  if (
    value === DistributionType.EQUAL ||
    value === DistributionType.OWNERSHIP_UNIT_COUNT ||
    value === DistributionType.OWNERSHIP_SIZE_WEIGHTED
  ) {
    return success(value);
  }
  return failure(PollDomainCodes.DISTRIBUTION_TYPE_INVALID);
}

export function isOwnershipMode(type: DistributionType): boolean {
  return (
    type === DistributionType.OWNERSHIP_UNIT_COUNT ||
    type === DistributionType.OWNERSHIP_SIZE_WEIGHTED
  );
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
yarn test src/domain/poll/__tests__/DistributionType.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/poll/DistributionType.ts src/domain/poll/__tests__/DistributionType.test.ts
git commit -m "feat(domain): add DistributionType value object"
```

---

## Task 4: Domain — `PropertyAggregation`

**Files:**

- Create: `src/domain/poll/PropertyAggregation.ts`
- Create: `src/domain/poll/__tests__/PropertyAggregation.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/poll/__tests__/PropertyAggregation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  PropertyAggregation,
  parsePropertyAggregation,
} from '../PropertyAggregation';

describe('PropertyAggregation', () => {
  it('has two values', () => {
    expect(PropertyAggregation.RAW_SUM).toBe('RAW_SUM');
    expect(PropertyAggregation.NORMALIZE_PER_PROPERTY).toBe(
      'NORMALIZE_PER_PROPERTY'
    );
  });

  describe('parsePropertyAggregation', () => {
    it.each(['RAW_SUM', 'NORMALIZE_PER_PROPERTY'])('accepts %s', (v) => {
      const result = parsePropertyAggregation(v);
      expect(result.success).toBe(true);
    });

    it('rejects unknown values', () => {
      const result = parsePropertyAggregation('ROOT_MEAN_SQUARE');
      expect(result.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
yarn test src/domain/poll/__tests__/PropertyAggregation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/poll/PropertyAggregation.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes } from './PollDomainCodes';

export const PropertyAggregation = {
  RAW_SUM: 'RAW_SUM',
  NORMALIZE_PER_PROPERTY: 'NORMALIZE_PER_PROPERTY',
} as const;

export type PropertyAggregation =
  (typeof PropertyAggregation)[keyof typeof PropertyAggregation];

export function parsePropertyAggregation(
  value: string
): Result<PropertyAggregation, string> {
  if (
    value === PropertyAggregation.RAW_SUM ||
    value === PropertyAggregation.NORMALIZE_PER_PROPERTY
  ) {
    return success(value);
  }
  return failure(PollDomainCodes.PROPERTY_AGGREGATION_INVALID);
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
yarn test src/domain/poll/__tests__/PropertyAggregation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/poll/PropertyAggregation.ts src/domain/poll/__tests__/PropertyAggregation.test.ts
git commit -m "feat(domain): add PropertyAggregation value object"
```

---

## Task 5: Domain — `PollWeightConfig`

**Files:**

- Create: `src/domain/poll/PollWeightConfig.ts`
- Create: `src/domain/poll/__tests__/PollWeightConfig.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/poll/__tests__/PollWeightConfig.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PollWeightConfig } from '../PollWeightConfig';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

describe('PollWeightConfig', () => {
  const base = PollWeightConfig.create({
    distributionType: DistributionType.EQUAL,
    propertyAggregation: PropertyAggregation.RAW_SUM,
    propertyIds: [],
  });

  it('stores fields', () => {
    expect(base.distributionType).toBe(DistributionType.EQUAL);
    expect(base.propertyAggregation).toBe(PropertyAggregation.RAW_SUM);
    expect(base.propertyIds).toEqual([]);
  });

  it('equals another config with the same fields', () => {
    const other = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
    });
    expect(base.equals(other)).toBe(true);
  });

  it('is not equal when distributionType differs', () => {
    const other = PollWeightConfig.create({
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
    });
    expect(base.equals(other)).toBe(false);
  });

  it('is not equal when propertyAggregation differs', () => {
    const other = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: [],
    });
    expect(base.equals(other)).toBe(false);
  });

  it('treats propertyIds as order-insensitive', () => {
    const a = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['a', 'b'],
    });
    const b = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['b', 'a'],
    });
    expect(a.equals(b)).toBe(true);
  });

  describe('merge', () => {
    it('overrides only supplied fields', () => {
      const merged = base.merge({
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      });
      expect(merged.distributionType).toBe(
        DistributionType.OWNERSHIP_UNIT_COUNT
      );
      expect(merged.propertyAggregation).toBe(PropertyAggregation.RAW_SUM);
      expect(merged.propertyIds).toEqual([]);
    });

    it('leaves base untouched', () => {
      base.merge({ distributionType: DistributionType.OWNERSHIP_UNIT_COUNT });
      expect(base.distributionType).toBe(DistributionType.EQUAL);
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
yarn test src/domain/poll/__tests__/PollWeightConfig.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/poll/PollWeightConfig.ts`:

```typescript
import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';

export interface PollWeightConfigProps {
  distributionType: DistributionType;
  propertyAggregation: PropertyAggregation;
  propertyIds: string[]; // empty = no property filter (all)
}

export class PollWeightConfig {
  private constructor(private readonly props: PollWeightConfigProps) {}

  public static create(props: PollWeightConfigProps): PollWeightConfig {
    return new PollWeightConfig({
      distributionType: props.distributionType,
      propertyAggregation: props.propertyAggregation,
      propertyIds: [...props.propertyIds],
    });
  }

  public get distributionType(): DistributionType {
    return this.props.distributionType;
  }

  public get propertyAggregation(): PropertyAggregation {
    return this.props.propertyAggregation;
  }

  public get propertyIds(): string[] {
    return [...this.props.propertyIds];
  }

  public equals(other: PollWeightConfig): boolean {
    if (this.props.distributionType !== other.props.distributionType)
      return false;
    if (this.props.propertyAggregation !== other.props.propertyAggregation)
      return false;
    const a = [...this.props.propertyIds].sort();
    const b = [...other.props.propertyIds].sort();
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  public merge(partial: Partial<PollWeightConfigProps>): PollWeightConfig {
    return PollWeightConfig.create({
      distributionType: partial.distributionType ?? this.props.distributionType,
      propertyAggregation:
        partial.propertyAggregation ?? this.props.propertyAggregation,
      propertyIds: partial.propertyIds ?? this.props.propertyIds,
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
yarn test src/domain/poll/__tests__/PollWeightConfig.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/poll/PollWeightConfig.ts src/domain/poll/__tests__/PollWeightConfig.test.ts
git commit -m "feat(domain): add PollWeightConfig value object"
```

---

## Task 6: Domain — new codes + error-code union updates

**Files:**

- Modify: `src/domain/poll/PollDomainCodes.ts`
- Modify: `src/domain/organization/OrganizationDomainCodes.ts`
- Modify: `src/application/poll/PollErrors.ts`

- [ ] **Step 1: Add poll domain codes**

Append inside the `PollDomainCodes` object in `src/domain/poll/PollDomainCodes.ts` (before the closing `}`):

```typescript
  // Weight distribution
  DISTRIBUTION_TYPE_INVALID: 'domain.poll.distributionTypeInvalid',
  PROPERTY_AGGREGATION_INVALID: 'domain.poll.propertyAggregationInvalid',
  OWNERSHIP_DATA_MISSING: 'domain.poll.ownershipDataMissing',
  PROPERTY_NOT_IN_ORG: 'domain.poll.propertyNotInOrg',
  VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG:
    'domain.poll.votesCastCannotChangeWeightConfig',
```

- [ ] **Step 2: Add organization domain codes**

Open `src/domain/organization/OrganizationDomainCodes.ts`. Verify it exports a similar `OrganizationDomainCodes` object. Append inside it:

```typescript
  PROPERTY_NAME_EMPTY: 'domain.organization.propertyNameEmpty',
  PROPERTY_ASSET_NAME_EMPTY: 'domain.organization.propertyAssetNameEmpty',
  PROPERTY_ASSET_SIZE_NON_POSITIVE:
    'domain.organization.propertyAssetSizeNonPositive',
  PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE:
    'domain.organization.propertyAssetOwnershipShareOutOfRange',
```

If `OrganizationDomainCodes.ts` doesn't already exist or doesn't follow the same `as const` pattern, mirror the shape of `PollDomainCodes.ts` exactly (constant object + `type` alias).

- [ ] **Step 3: Add application-layer poll error**

Open `src/application/poll/PollErrors.ts` (inspect with `cat src/application/poll/PollErrors.ts` if needed). Append one key:

```typescript
  CANNOT_CHANGE_WEIGHT_CONFIG: 'poll.errors.cannotChangeWeightConfig',
```

- [ ] **Step 4: Type-check**

```bash
yarn tsc --noEmit 2>&1 | head -30
```

Expected: no new errors from these files.

- [ ] **Step 5: Commit**

```bash
git add src/domain/poll/PollDomainCodes.ts src/domain/organization/OrganizationDomainCodes.ts src/application/poll/PollErrors.ts
git commit -m "feat(domain): add weight-config error codes"
```

---

## Task 7: Domain — `OrganizationProperty` entity

**Files:**

- Create: `src/domain/organization/OrganizationProperty.ts`
- Create: `src/domain/organization/__tests__/OrganizationProperty.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/organization/__tests__/OrganizationProperty.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { OrganizationProperty } from '../OrganizationProperty';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('OrganizationProperty', () => {
  describe('create', () => {
    it('creates with name and optional address', () => {
      const result = OrganizationProperty.create(
        'org-1',
        'Apt house #13',
        '5th St.'
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organizationId).toBe('org-1');
        expect(result.value.name).toBe('Apt house #13');
        expect(result.value.address).toBe('5th St.');
        expect(result.value.archivedAt).toBeNull();
      }
    });

    it('creates with null address', () => {
      const result = OrganizationProperty.create(
        'org-1',
        'Apt house #13',
        null
      );
      expect(result.success).toBe(true);
      if (result.success) expect(result.value.address).toBeNull();
    });

    it('rejects empty name', () => {
      const result = OrganizationProperty.create('org-1', '', null);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error).toBe(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    });

    it('rejects whitespace-only name', () => {
      const result = OrganizationProperty.create('org-1', '   ', null);
      expect(result.success).toBe(false);
    });
  });

  describe('archive', () => {
    it('sets archivedAt', () => {
      const result = OrganizationProperty.create('org-1', 'X', null);
      if (!result.success) throw new Error('setup');
      const prop = result.value;
      expect(prop.isArchived()).toBe(false);
      prop.archive();
      expect(prop.isArchived()).toBe(true);
      expect(prop.archivedAt).not.toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
yarn test src/domain/organization/__tests__/OrganizationProperty.test.ts
```

- [ ] **Step 3: Implement**

`src/domain/organization/OrganizationProperty.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

export interface OrganizationPropertyProps {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  createdAt: Date;
  archivedAt: Date | null;
}

export class OrganizationProperty {
  private constructor(private props: OrganizationPropertyProps) {}

  public static create(
    organizationId: string,
    name: string,
    address: string | null
  ): Result<OrganizationProperty, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }
    return success(
      new OrganizationProperty({
        id: '',
        organizationId,
        name: name.trim(),
        address: address && address.trim().length > 0 ? address.trim() : null,
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
  public get createdAt(): Date {
    return this.props.createdAt;
  }
  public get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  public isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  public archive(): void {
    if (!this.props.archivedAt) this.props.archivedAt = new Date();
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
yarn test src/domain/organization/__tests__/OrganizationProperty.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/OrganizationProperty.ts src/domain/organization/__tests__/OrganizationProperty.test.ts
git commit -m "feat(domain): add OrganizationProperty entity"
```

---

## Task 8: Domain — `PropertyAsset` entity (size > 0 invariant)

**Files:**

- Create: `src/domain/organization/PropertyAsset.ts`
- Create: `src/domain/organization/__tests__/PropertyAsset.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/organization/__tests__/PropertyAsset.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PropertyAsset } from '../PropertyAsset';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('PropertyAsset', () => {
  describe('create', () => {
    it('creates with a positive size', () => {
      const result = PropertyAsset.create('prop-1', 'Apt #101', 75);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.propertyId).toBe('prop-1');
        expect(result.value.name).toBe('Apt #101');
        expect(result.value.size).toBe(75);
      }
    });

    it('rejects size = 0', () => {
      const result = PropertyAsset.create('prop-1', 'Apt', 0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE
        );
      }
    });

    it('rejects negative size', () => {
      const result = PropertyAsset.create('prop-1', 'Apt', -10);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = PropertyAsset.create('prop-1', '', 75);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY
        );
      }
    });

    it('accepts fractional size', () => {
      const result = PropertyAsset.create('prop-1', 'Lot', 12.5);
      expect(result.success).toBe(true);
    });
  });

  describe('archive', () => {
    it('marks the asset archived', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 75);
      if (!r.success) throw new Error('setup');
      r.value.archive();
      expect(r.value.isArchived()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
yarn test src/domain/organization/__tests__/PropertyAsset.test.ts
```

- [ ] **Step 3: Implement**

`src/domain/organization/PropertyAsset.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

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
    size: number
  ): Result<PropertyAsset, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }
    if (!(size > 0)) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }
    return success(
      new PropertyAsset({
        id: '',
        propertyId,
        name: name.trim(),
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

  public archive(): void {
    if (!this.props.archivedAt) this.props.archivedAt = new Date();
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
yarn test src/domain/organization/__tests__/PropertyAsset.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/PropertyAsset.ts src/domain/organization/__tests__/PropertyAsset.test.ts
git commit -m "feat(domain): add PropertyAsset entity with size>0 invariant"
```

---

## Task 9: Domain — `PropertyAssetOwnership` entity

**Files:**

- Create: `src/domain/organization/PropertyAssetOwnership.ts`
- Create: `src/domain/organization/__tests__/PropertyAssetOwnership.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/organization/__tests__/PropertyAssetOwnership.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PropertyAssetOwnership } from '../PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('PropertyAssetOwnership', () => {
  describe('create', () => {
    it('creates with share in [0, 1]', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', 0.5);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.value.share).toBe(0.5);
        expect(r.value.effectiveUntil).toBeNull();
      }
    });

    it('allows share = 1', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', 1);
      expect(r.success).toBe(true);
    });

    it('allows share = 0', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', 0);
      expect(r.success).toBe(true);
    });

    it('rejects share > 1', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', 1.5);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
        );
      }
    });

    it('rejects share < 0', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', -0.1);
      expect(r.success).toBe(false);
    });
  });

  describe('endEffect', () => {
    it('sets effectiveUntil to a given date', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', 0.5);
      if (!r.success) throw new Error('setup');
      const d = new Date('2026-05-01');
      r.value.endEffect(d);
      expect(r.value.effectiveUntil).toEqual(d);
    });

    it('does not overwrite an already-ended row', () => {
      const r = PropertyAssetOwnership.create('asset-1', 'user-1', 0.5);
      if (!r.success) throw new Error('setup');
      const d1 = new Date('2026-05-01');
      const d2 = new Date('2026-06-01');
      r.value.endEffect(d1);
      r.value.endEffect(d2);
      expect(r.value.effectiveUntil).toEqual(d1);
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
yarn test src/domain/organization/__tests__/PropertyAssetOwnership.test.ts
```

- [ ] **Step 3: Implement**

`src/domain/organization/PropertyAssetOwnership.ts`:

```typescript
import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

export interface PropertyAssetOwnershipProps {
  id: string;
  assetId: string;
  userId: string;
  share: number; // 0..1
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  createdAt: Date;
}

export class PropertyAssetOwnership {
  private constructor(private props: PropertyAssetOwnershipProps) {}

  public static create(
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
  public get userId(): string {
    return this.props.userId;
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
    if (!this.props.effectiveUntil) this.props.effectiveUntil = at;
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
yarn test src/domain/organization/__tests__/PropertyAssetOwnership.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/PropertyAssetOwnership.ts src/domain/organization/__tests__/PropertyAssetOwnership.test.ts
git commit -m "feat(domain): add PropertyAssetOwnership entity"
```

---

## Task 10: Domain — `PollEligibleMember` entity

**Files:**

- Create: `src/domain/poll/PollEligibleMember.ts`
- Create: `src/domain/poll/__tests__/PollEligibleMember.test.ts`

- [ ] **Step 1: Write failing tests**

`src/domain/poll/__tests__/PollEligibleMember.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PollEligibleMember } from '../PollEligibleMember';

describe('PollEligibleMember', () => {
  it('creates with poll, user, and snapshotAt', () => {
    const at = new Date('2026-04-01');
    const m = PollEligibleMember.create('poll-1', 'user-1', at);
    expect(m.pollId).toBe('poll-1');
    expect(m.userId).toBe('user-1');
    expect(m.snapshotAt).toEqual(at);
  });

  it('reconstitutes with id', () => {
    const at = new Date('2026-04-01');
    const m = PollEligibleMember.reconstitute({
      id: 'x',
      pollId: 'poll-1',
      userId: 'user-1',
      snapshotAt: at,
      createdAt: new Date(),
    });
    expect(m.id).toBe('x');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
yarn test src/domain/poll/__tests__/PollEligibleMember.test.ts
```

- [ ] **Step 3: Implement**

`src/domain/poll/PollEligibleMember.ts`:

```typescript
export interface PollEligibleMemberProps {
  id: string;
  pollId: string;
  userId: string;
  snapshotAt: Date;
  createdAt: Date;
}

export class PollEligibleMember {
  private constructor(private props: PollEligibleMemberProps) {}

  public static create(
    pollId: string,
    userId: string,
    snapshotAt: Date
  ): PollEligibleMember {
    return new PollEligibleMember({
      id: '',
      pollId,
      userId,
      snapshotAt,
      createdAt: new Date(),
    });
  }

  public static reconstitute(
    props: PollEligibleMemberProps
  ): PollEligibleMember {
    return new PollEligibleMember(props);
  }

  public get id(): string {
    return this.props.id;
  }
  public get pollId(): string {
    return this.props.pollId;
  }
  public get userId(): string {
    return this.props.userId;
  }
  public get snapshotAt(): Date {
    return this.props.snapshotAt;
  }
  public get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
yarn test src/domain/poll/__tests__/PollEligibleMember.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/poll/PollEligibleMember.ts src/domain/poll/__tests__/PollEligibleMember.test.ts
git commit -m "feat(domain): add PollEligibleMember entity"
```

---

## Task 11: Domain — repository ports

**Files:**

- Create: `src/domain/organization/OrganizationPropertyRepository.ts`
- Create: `src/domain/organization/PropertyAssetRepository.ts`
- Create: `src/domain/poll/PollEligibleMemberRepository.ts`

- [ ] **Step 1: Create `OrganizationPropertyRepository`**

```typescript
// src/domain/organization/OrganizationPropertyRepository.ts
import { Result } from '../shared/Result';
import { OrganizationProperty } from './OrganizationProperty';

export interface OrganizationPropertyRepository {
  findByOrganization(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>>;
  findById(id: string): Promise<Result<OrganizationProperty | null, string>>;
  countNonArchived(organizationId: string): Promise<Result<number, string>>;
}
```

- [ ] **Step 2: Create `PropertyAssetRepository`**

```typescript
// src/domain/organization/PropertyAssetRepository.ts
import { Result } from '../shared/Result';
import { PropertyAsset } from './PropertyAsset';
import { PropertyAssetOwnership } from './PropertyAssetOwnership';

/** A single row from the joined "asset + current-effective ownership" view. */
export interface AssetOwnershipRow {
  asset: PropertyAsset;
  ownership: PropertyAssetOwnership;
}

export interface PropertyAssetRepository {
  /**
   * Current-effective (effectiveUntil IS NULL) ownership rows for a given org,
   * optionally filtered to a set of property ids.
   * If propertyIds is empty, returns all non-archived assets of the org.
   */
  findCurrentOwnershipByOrg(
    organizationId: string,
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>>;

  /** True if the org has ≥ 1 non-archived asset with ≥ 1 effective ownership row. */
  orgHasOwnershipData(organizationId: string): Promise<Result<boolean, string>>;
}
```

- [ ] **Step 3: Create `PollEligibleMemberRepository`**

```typescript
// src/domain/poll/PollEligibleMemberRepository.ts
import { Result } from '../shared/Result';
import { PollEligibleMember } from './PollEligibleMember';

export interface PollEligibleMemberRepository {
  createMany(members: PollEligibleMember[]): Promise<Result<void, string>>;
  findByPollId(pollId: string): Promise<Result<PollEligibleMember[], string>>;
}
```

- [ ] **Step 4: Type-check**

```bash
yarn tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/OrganizationPropertyRepository.ts src/domain/organization/PropertyAssetRepository.ts src/domain/poll/PollEligibleMemberRepository.ts
git commit -m "feat(domain): add repository ports for properties, assets, eligible members"
```

---

## Task 12: Domain — `WeightDistribution` pure function (TDD)

**Files:**

- Create: `src/domain/poll/WeightDistribution.ts`
- Create: `src/domain/poll/__tests__/WeightDistribution.test.ts`

This is the single most important piece of the feature. We build it up via TDD in several passes. Each step adds a failing test, gets it to green, then moves on.

- [ ] **Step 1: Write top-of-file test scaffold**

`src/domain/poll/__tests__/WeightDistribution.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeWeights, WeightDistributionInput } from '../WeightDistribution';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

// Mini helpers so tests read like specs.
const asset = (id: string, propertyId: string, size: number) => ({
  id,
  propertyId,
  size,
});
const own = (assetId: string, userId: string, share: number) => ({
  assetId,
  userId,
  share,
});

describe('computeWeights — EQUAL', () => {
  it('no scope: every candidate gets weight 1.0', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [],
      ownerships: [],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBe(1.0);
    expect(out.get('bob')).toBe(1.0);
  });

  it('scope: candidate eligible iff they own ≥1 in-scope asset', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob', 'carol'],
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['P1'],
      assets: [asset('a1', 'P1', 10), asset('a2', 'P2', 20)],
      ownerships: [
        own('a1', 'alice', 1), // in scope
        own('a2', 'bob', 1), // out of scope
        // carol owns nothing
      ],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBe(1.0);
    expect(out.has('bob')).toBe(false);
    expect(out.has('carol')).toBe(false);
  });
});
```

- [ ] **Step 2: Create `WeightDistribution.ts` shell**

`src/domain/poll/WeightDistribution.ts`:

```typescript
import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';

export interface WeightAsset {
  id: string;
  propertyId: string;
  size: number;
}

export interface WeightOwnership {
  assetId: string;
  userId: string;
  share: number;
}

export interface WeightDistributionInput {
  candidates: string[];
  distributionType: DistributionType;
  propertyAggregation: PropertyAggregation;
  propertyIds: string[]; // empty = no filter
  assets: WeightAsset[];
  ownerships: WeightOwnership[];
}

export function computeWeights(
  input: WeightDistributionInput
): Map<string, number> {
  throw new Error('not implemented');
}
```

- [ ] **Step 3: Run — confirm failure**

```bash
yarn test src/domain/poll/__tests__/WeightDistribution.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement EQUAL semantics**

Replace the body of `computeWeights`:

```typescript
export function computeWeights(
  input: WeightDistributionInput
): Map<string, number> {
  const inScopeAssets = filterAssets(input.assets, input.propertyIds);
  const ownershipByUser = groupOwnershipByUser(
    input.ownerships,
    new Set(inScopeAssets.map((a) => a.id))
  );

  const out = new Map<string, number>();

  if (input.distributionType === DistributionType.EQUAL) {
    const scopeEmpty = input.propertyIds.length === 0;
    for (const userId of input.candidates) {
      if (scopeEmpty) {
        out.set(userId, 1);
      } else if ((ownershipByUser.get(userId)?.length ?? 0) > 0) {
        out.set(userId, 1);
      }
    }
    return out;
  }

  // Ownership modes — implemented in later steps
  throw new Error('not implemented');
}

function filterAssets(
  assets: WeightAsset[],
  propertyIds: string[]
): WeightAsset[] {
  if (propertyIds.length === 0) return assets;
  const set = new Set(propertyIds);
  return assets.filter((a) => set.has(a.propertyId));
}

function groupOwnershipByUser(
  ownerships: WeightOwnership[],
  inScopeAssetIds: Set<string>
): Map<string, WeightOwnership[]> {
  const map = new Map<string, WeightOwnership[]>();
  for (const o of ownerships) {
    if (!inScopeAssetIds.has(o.assetId)) continue;
    const list = map.get(o.userId) ?? [];
    list.push(o);
    map.set(o.userId, list);
  }
  return map;
}
```

- [ ] **Step 5: Run — EQUAL tests pass**

```bash
yarn test src/domain/poll/__tests__/WeightDistribution.test.ts
```

Expected: the two EQUAL tests pass; no ownership tests yet.

- [ ] **Step 6: Add tests for `OWNERSHIP_UNIT_COUNT` × `RAW_SUM`**

Append to `WeightDistribution.test.ts`:

```typescript
describe('computeWeights — OWNERSHIP_UNIT_COUNT × RAW_SUM', () => {
  it('sums shares across assets; size ignored', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 75), asset('a2', 'P1', 100)],
      ownerships: [own('a1', 'alice', 1), own('a2', 'alice', 0.5)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBeCloseTo(1.5, 6);
  });

  it('filters out zero-weight users', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 10)],
      ownerships: [own('a1', 'alice', 1)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBe(1);
    expect(out.has('bob')).toBe(false);
  });

  it('co-ownership: each owner gets fractional share, no double-count', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 100)],
      ownerships: [own('a1', 'alice', 0.5), own('a1', 'bob', 0.5)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBeCloseTo(0.5, 6);
    expect(out.get('bob')).toBeCloseTo(0.5, 6);
  });
});
```

Run: `yarn test src/domain/poll/__tests__/WeightDistribution.test.ts` — expect 3 failures.

- [ ] **Step 7: Implement `OWNERSHIP_UNIT_COUNT` × `RAW_SUM`**

Replace the `throw new Error('not implemented')` block with:

```typescript
  const isOwnership =
    input.distributionType === DistributionType.OWNERSHIP_UNIT_COUNT ||
    input.distributionType === DistributionType.OWNERSHIP_SIZE_WEIGHTED;

  if (!isOwnership) return out;

  const effectiveSize = (a: WeightAsset): number =>
    input.distributionType === DistributionType.OWNERSHIP_UNIT_COUNT ? 1 : a.size;

  // Pre-index assets by id for lookup.
  const assetById = new Map<string, WeightAsset>(
    inScopeAssets.map((a) => [a.id, a])
  );

  // Pre-group assets by property.
  const assetsByProperty = new Map<string, WeightAsset[]>();
  for (const a of inScopeAssets) {
    const list = assetsByProperty.get(a.propertyId) ?? [];
    list.push(a);
    assetsByProperty.set(a.propertyId, list);
  }

  const useNormalize =
    input.propertyAggregation === PropertyAggregation.NORMALIZE_PER_PROPERTY;

  for (const userId of input.candidates) {
    const userOwnerships = ownershipByUser.get(userId) ?? [];
    if (userOwnerships.length === 0) continue;

    if (!useNormalize) {
      // RAW_SUM
      let weight = 0;
      for (const o of userOwnerships) {
        const a = assetById.get(o.assetId);
        if (!a) continue;
        weight += o.share * effectiveSize(a);
      }
      if (weight > 0) out.set(userId, weight);
      continue;
    }

    // NORMALIZE_PER_PROPERTY
    const userByProp = new Map<string, WeightOwnership[]>();
    for (const o of userOwnerships) {
      const a = assetById.get(o.assetId);
      if (!a) continue;
      const list = userByProp.get(a.propertyId) ?? [];
      list.push(o);
      userByProp.set(a.propertyId, list);
    }

    let weight = 0;
    for (const [propId, list] of userByProp) {
      const propAssets = assetsByProperty.get(propId) ?? [];
      const denom = propAssets.reduce((s, a) => s + effectiveSize(a), 0);
      if (denom === 0) continue;
      let num = 0;
      for (const o of list) {
        const a = assetById.get(o.assetId);
        if (!a) continue;
        num += o.share * effectiveSize(a);
      }
      weight += num / denom;
    }
    if (weight > 0) out.set(userId, weight);
  }

  return out;
}
```

Remove the `throw` statement that used to live there. The ownership branch is now below the `if (EQUAL)` block.

- [ ] **Step 8: Run — all tests pass so far**

```bash
yarn test src/domain/poll/__tests__/WeightDistribution.test.ts
```

Expected: 5 pass (2 EQUAL + 3 UNIT_COUNT).

- [ ] **Step 9: Add tests for `OWNERSHIP_SIZE_WEIGHTED` × `RAW_SUM`**

Append to the test file:

```typescript
describe('computeWeights — OWNERSHIP_SIZE_WEIGHTED × RAW_SUM', () => {
  it('uses asset.size as effective_size', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 100), asset('a2', 'P1', 50)],
      ownerships: [own('a1', 'alice', 1), own('a2', 'bob', 1)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBeCloseTo(100, 6);
    expect(out.get('bob')).toBeCloseTo(50, 6);
  });
});
```

Run — expect pass (implementation already handles SIZE_WEIGHTED).

- [ ] **Step 10: Add tests for `NORMALIZE_PER_PROPERTY`**

Append:

```typescript
describe('computeWeights — NORMALIZE_PER_PROPERTY', () => {
  // Alice example from the spec.
  // Apt house P1: 850 total m², Parking P2: 240 total m².
  // Alice owns 100% of a1 (75), 50% of a2 (100), 100% of a3, a4 (12 each), 50% of a5 (12).
  it('Alice example — SIZE_WEIGHTED', () => {
    const apt = (id: string, size: number) => asset(id, 'P1', size);
    const park = (id: string, size: number) => asset(id, 'P2', size);
    const input: WeightDistributionInput = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: ['P1', 'P2'],
      assets: [
        apt('a1', 75),
        apt('a2', 100),
        apt('aR1', 80),
        apt('aR2', 80),
        apt('aR3', 80),
        apt('aR4', 85),
        apt('aR5', 85),
        apt('aR6', 85),
        apt('aR7', 90),
        apt('aR8', 90), // 10 apts totalling 850
        park('p1', 12),
        park('p2', 12),
        park('p3', 12),
        park('p4', 12),
        park('p5', 12),
        park('p6', 12),
        park('p7', 12),
        park('p8', 12),
        park('p9', 12),
        park('p10', 12),
        park('p11', 12),
        park('p12', 12),
        park('p13', 12),
        park('p14', 12),
        park('p15', 12),
        park('p16', 12),
        park('p17', 12),
        park('p18', 12),
        park('p19', 12),
        park('p20', 12), // 20 spots × 12 = 240
      ],
      ownerships: [
        own('a1', 'alice', 1),
        own('a2', 'alice', 0.5),
        own('p1', 'alice', 1),
        own('p2', 'alice', 1),
        own('p3', 'alice', 0.5),
      ],
    };
    const w = computeWeights(input).get('alice')!;
    // Apt share = (75 + 50) / 850 ≈ 0.147058
    // Parking share = (12 + 12 + 6) / 240 = 0.125
    // Sum ≈ 0.272058
    expect(w).toBeCloseTo(0.272058, 5);
  });

  it('NORMALIZE_PER_PROPERTY UNIT_COUNT: property of N assets → share capped at 1', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: ['P1'],
      assets: [
        asset('a1', 'P1', 10),
        asset('a2', 'P1', 10),
        asset('a3', 'P1', 10),
        asset('a4', 'P1', 10),
      ],
      ownerships: [own('a1', 'alice', 1), own('a2', 'alice', 1)],
    };
    const w = computeWeights(input).get('alice')!;
    // Two of four apts → 2 / 4 = 0.5
    expect(w).toBeCloseTo(0.5, 6);
  });

  it('Single-property scope: both aggregations produce proportional rankings', () => {
    const common = {
      candidates: ['a', 'b', 'c'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyIds: ['P'],
      assets: [
        asset('x1', 'P', 100),
        asset('x2', 'P', 50),
        asset('x3', 'P', 25),
      ],
      ownerships: [own('x1', 'a', 1), own('x2', 'b', 1), own('x3', 'c', 1)],
    };
    const raw = computeWeights({
      ...common,
      propertyAggregation: PropertyAggregation.RAW_SUM,
    });
    const norm = computeWeights({
      ...common,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
    });
    // Rankings must match: a > b > c under both.
    expect(raw.get('a')! > raw.get('b')!).toBe(true);
    expect(raw.get('b')! > raw.get('c')!).toBe(true);
    expect(norm.get('a')! > norm.get('b')!).toBe(true);
    expect(norm.get('b')! > norm.get('c')!).toBe(true);
    // Ratios equal (scaling only).
    expect(norm.get('a')! / raw.get('a')!).toBeCloseTo(
      norm.get('b')! / raw.get('b')!,
      6
    );
  });
});
```

Run — all tests should pass (the NORMALIZE_PER_PROPERTY branch is already implemented in Step 7).

```bash
yarn test src/domain/poll/__tests__/WeightDistribution.test.ts
```

Expected: all 9 test cases pass.

- [ ] **Step 11: Commit**

```bash
git add src/domain/poll/WeightDistribution.ts src/domain/poll/__tests__/WeightDistribution.test.ts
git commit -m "feat(domain): pure WeightDistribution covering 3 modes × 2 aggregations"
```

---

## Task 13: Infrastructure — `PrismaOrganizationPropertyRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts`

- [ ] **Step 1: Inspect an existing Prisma repo for the shape**

Run:

```bash
ls src/infrastructure/repositories/ | head -20
head -40 src/infrastructure/repositories/PrismaOrganizationRepository.ts
```

Note the imports and construction pattern (`PrismaClient` passed in constructor; uses `Result`).

- [ ] **Step 2: Implement**

`src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';

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

  private toEntity(row: {
    id: string;
    organizationId: string;
    name: string;
    address: string | null;
    createdAt: Date;
    archivedAt: Date | null;
  }): OrganizationProperty {
    return OrganizationProperty.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      address: row.address,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    });
  }
}
```

- [ ] **Step 3: Type-check**

```bash
yarn tsc --noEmit 2>&1 | grep PrismaOrganizationPropertyRepository | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/repositories/PrismaOrganizationPropertyRepository.ts
git commit -m "feat(infra): add PrismaOrganizationPropertyRepository"
```

---

## Task 14: Infrastructure — `PrismaPropertyAssetRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`

- [ ] **Step 1: Implement**

`src/infrastructure/repositories/PrismaPropertyAssetRepository.ts`:

```typescript
import { PrismaClient, Prisma } from '@prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../domain/organization/PropertyAssetOwnership';
import {
  PropertyAssetRepository,
  AssetOwnershipRow,
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
}
```

- [ ] **Step 2: Type-check**

```bash
yarn tsc --noEmit 2>&1 | grep PropertyAssetRepository | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/PrismaPropertyAssetRepository.ts
git commit -m "feat(infra): add PrismaPropertyAssetRepository"
```

---

## Task 15: Infrastructure — `PrismaPollEligibleMemberRepository`

**Files:**

- Create: `src/infrastructure/repositories/PrismaPollEligibleMemberRepository.ts`

- [ ] **Step 1: Implement**

`src/infrastructure/repositories/PrismaPollEligibleMemberRepository.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollEligibleMember } from '../../domain/poll/PollEligibleMember';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';

export class PrismaPollEligibleMemberRepository implements PollEligibleMemberRepository {
  constructor(private prisma: PrismaClient) {}

  async createMany(
    members: PollEligibleMember[]
  ): Promise<Result<void, string>> {
    try {
      if (members.length === 0) return success(undefined);
      await this.prisma.pollEligibleMember.createMany({
        data: members.map((m) => ({
          pollId: m.pollId,
          userId: m.userId,
          snapshotAt: m.snapshotAt,
        })),
        skipDuplicates: true,
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findByPollId(
    pollId: string
  ): Promise<Result<PollEligibleMember[], string>> {
    try {
      const rows = await this.prisma.pollEligibleMember.findMany({
        where: { pollId },
      });
      return success(
        rows.map((r) =>
          PollEligibleMember.reconstitute({
            id: r.id,
            pollId: r.pollId,
            userId: r.userId,
            snapshotAt: r.snapshotAt,
            createdAt: r.createdAt,
          })
        )
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }
}
```

- [ ] **Step 2: Type-check + commit**

```bash
yarn tsc --noEmit 2>&1 | grep PollEligibleMember | head -5
git add src/infrastructure/repositories/PrismaPollEligibleMemberRepository.ts
git commit -m "feat(infra): add PrismaPollEligibleMemberRepository"
```

---

## Task 16: Infrastructure — extend `PrismaParticipantRepository` with batched reconfigure

**Files:**

- Modify: `src/infrastructure/repositories/PrismaParticipantRepository.ts`
- Modify: `src/domain/poll/ParticipantRepository.ts` (add method signature)

- [ ] **Step 1: Add method signature to the port**

Inside `src/domain/poll/ParticipantRepository.ts`, add to the interface:

```typescript
  /**
   * Atomic reconfigure: applies adds/removes/updates to poll_participants,
   * writes one ParticipantWeightHistory per change, and replaces poll_properties.
   */
  applyWeightConfigChange(
    pollId: string,
    newDistributionType: string,
    newPropertyAggregation: string,
    newPropertyIds: string[],
    add: Array<{ userId: string; weight: number }>,
    remove: Array<{ participantId: string; userId: string; oldWeight: number }>,
    update: Array<{ participantId: string; userId: string; oldWeight: number; newWeight: number }>,
    adminUserId: string,
    reason: string
  ): Promise<import('../shared/Result').Result<void, string>>;
```

- [ ] **Step 2: Implement in the Prisma class**

In `src/infrastructure/repositories/PrismaParticipantRepository.ts`, add the method. Example skeleton — adapt to imports already present in the file:

```typescript
  async applyWeightConfigChange(
    pollId: string,
    newDistributionType: string,
    newPropertyAggregation: string,
    newPropertyIds: string[],
    add: Array<{ userId: string; weight: number }>,
    remove: Array<{ participantId: string; userId: string; oldWeight: number }>,
    update: Array<{ participantId: string; userId: string; oldWeight: number; newWeight: number }>,
    adminUserId: string,
    reason: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Update polls columns
        await tx.poll.update({
          where: { id: pollId },
          data: {
            distributionType: newDistributionType,
            propertyAggregation: newPropertyAggregation,
          },
        });

        // 2. Replace poll_properties
        await tx.pollProperty.deleteMany({ where: { pollId } });
        if (newPropertyIds.length > 0) {
          await tx.pollProperty.createMany({
            data: newPropertyIds.map((propertyId) => ({ pollId, propertyId })),
          });
        }

        // 3. Deletes
        if (remove.length > 0) {
          await tx.pollParticipant.deleteMany({
            where: { id: { in: remove.map((r) => r.participantId) } },
          });
          await tx.participantWeightHistory.createMany({
            data: remove.map((r) => ({
              participantId: r.participantId,
              pollId,
              userId: r.userId,
              oldWeight: r.oldWeight,
              newWeight: 0,
              changedBy: adminUserId,
              reason,
            })),
          });
        }

        // 4. Inserts
        for (const a of add) {
          const created = await tx.pollParticipant.create({
            data: { pollId, userId: a.userId, userWeight: a.weight },
          });
          await tx.participantWeightHistory.create({
            data: {
              participantId: created.id,
              pollId,
              userId: a.userId,
              oldWeight: 0,
              newWeight: a.weight,
              changedBy: adminUserId,
              reason,
            },
          });
        }

        // 5. Updates
        for (const u of update) {
          await tx.pollParticipant.update({
            where: { id: u.participantId },
            data: { userWeight: u.newWeight },
          });
          await tx.participantWeightHistory.create({
            data: {
              participantId: u.participantId,
              pollId,
              userId: u.userId,
              oldWeight: u.oldWeight,
              newWeight: u.newWeight,
              changedBy: adminUserId,
              reason,
            },
          });
        }
      });
      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }
```

- [ ] **Step 3: Type-check**

```bash
yarn tsc --noEmit 2>&1 | grep -i participant | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/repositories/PrismaParticipantRepository.ts src/domain/poll/ParticipantRepository.ts
git commit -m "feat(infra): ParticipantRepository.applyWeightConfigChange for atomic reconfigure"
```

---

## Task 17: Infrastructure — Poll entity + repo: `distributionType`, `propertyAggregation`, `propertyIds`

**Files:**

- Modify: `src/domain/poll/Poll.ts`
- Modify: `src/infrastructure/repositories/PrismaPollRepository.ts`

- [ ] **Step 1: Extend `Poll` entity props**

Open `src/domain/poll/Poll.ts`. Locate the `PollProps` interface. Add:

```typescript
  distributionType: string;
  propertyAggregation: string;
  propertyIds: string[];
```

Add corresponding getters (returning the stored values; no logic changes).

In any `Poll.create(...)` factory, default: `distributionType = 'EQUAL'`, `propertyAggregation = 'RAW_SUM'`, `propertyIds = []`.

In `Poll.reconstitute(...)`, pass through from props.

Add a method to update the config (used by the update use case; actual persistence happens in the participant-repository transaction):

```typescript
  public applyWeightConfig(
    distributionType: string,
    propertyAggregation: string,
    propertyIds: string[]
  ): void {
    this.props.distributionType = distributionType;
    this.props.propertyAggregation = propertyAggregation;
    this.props.propertyIds = [...propertyIds];
  }
```

- [ ] **Step 2: Update `PrismaPollRepository` to read/write the new columns and relations**

Open `src/infrastructure/repositories/PrismaPollRepository.ts`. In the query that fetches polls (look for `findUnique` / `findMany` on `poll`), add `include: { properties: true }` where appropriate.

In the mapper that converts a row to a `Poll` entity, include:

```typescript
  distributionType: row.distributionType,
  propertyAggregation: row.propertyAggregation,
  propertyIds: (row.properties ?? []).map((p: { propertyId: string }) => p.propertyId),
```

In the create / update paths, write `distributionType` and `propertyAggregation`. The participant-repository handles `poll_properties` changes — the poll repository does not need to duplicate that.

- [ ] **Step 3: Run type-check + existing tests to catch regressions**

```bash
yarn tsc --noEmit 2>&1 | grep -E "Poll(Repository|\.ts)" | head -20
yarn test src/domain/poll/__tests__/Poll.test.ts
```

Expected: no new type errors; existing `Poll.test.ts` still passes (add new field to its fixtures if it constructs `Poll` directly).

- [ ] **Step 4: Commit**

```bash
git add src/domain/poll/Poll.ts src/infrastructure/repositories/PrismaPollRepository.ts
git commit -m "feat: Poll entity and repository carry distributionType, propertyAggregation, propertyIds"
```

---

## Task 18: Application — update `TakeSnapshotUseCase`

**Files:**

- Modify: `src/application/poll/TakeSnapshotUseCase.ts`
- Create: `src/application/poll/__tests__/TakeSnapshotUseCase.test.ts` (if none exists)

- [ ] **Step 1: Write failing tests**

`src/application/poll/__tests__/TakeSnapshotUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TakeSnapshotUseCase } from '../TakeSnapshotUseCase';
import { DistributionType } from '../../domain/poll/DistributionType';
import { PropertyAggregation } from '../../domain/poll/PropertyAggregation';
// Assume the test file builds in-memory stub repositories; if the codebase already has
// a harness (e.g. in src/test-utils/), prefer that. Otherwise, mock via vi.fn() wrappers
// that return Result-typed responses as done in existing use-case tests.

// Minimal example — shape; fill in with real stubs per existing test conventions:
function makeSetup(config: {
  distributionType: string;
  propertyAggregation: string;
  propertyIds: string[];
  members: string[];
  assets?: Array<{ id: string; propertyId: string; size: number }>;
  ownerships?: Array<{ assetId: string; userId: string; share: number }>;
}) {
  // ... construct stub repos/uc with the supplied state
}

describe('TakeSnapshotUseCase', () => {
  it('EQUAL: every member becomes a participant with weight 1', async () => {
    // arrange a poll with distributionType EQUAL, members [alice, bob]
    // act: run TakeSnapshot
    // assert: poll_participants == 2, each weight 1, poll_eligible_members == 2
    expect(true).toBe(true);
  });

  it('OWNERSHIP_UNIT_COUNT: non-owners are not participants but ARE eligible members', async () => {
    // arrange alice owns 1 apt in P1; bob owns nothing.
    // act
    // assert: participants == [alice], eligible == [alice, bob]
    expect(true).toBe(true);
  });

  it('Property scope filters assets; non-scope owners are not participants', async () => {
    expect(true).toBe(true);
  });
});
```

> NOTE: The stubs for `PollRepository`, `ParticipantRepository`, `BoardRepository`, `OrganizationRepository`, `UserRepository`, `PropertyAssetRepository`, `PollEligibleMemberRepository` should mirror the pattern in existing use-case tests. Flesh these out against whatever harness the repo already uses (see `src/application/poll/__tests__/` for precedent).

- [ ] **Step 2: Update `TakeSnapshotUseCase`**

Update `src/application/poll/TakeSnapshotUseCase.ts` to:

1. Accept two new repo dependencies: `PropertyAssetRepository` and `PollEligibleMemberRepository`.
2. After computing `memberUserIds`, always write `PollEligibleMember` rows for the full set.
3. If distribution is an ownership mode, load current ownership via the asset repo and call `computeWeights(...)`.
4. Create `PollParticipant` rows only for users with positive weight under the current config.

Concretely:

```typescript
import { computeWeights } from '../../domain/poll/WeightDistribution';
import { PollEligibleMember } from '../../domain/poll/PollEligibleMember';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';
import { isOwnershipMode, DistributionType } from '../../domain/poll/DistributionType';

export class TakeSnapshotUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private propertyAssetRepository: PropertyAssetRepository,
    private eligibleRepository: PollEligibleMemberRepository
  ) {}
  // ...existing execute() body, with these additions:
```

After `memberUserIds` is computed:

```typescript
const snapshotAt = new Date();

// Always write eligible members — the frozen ceiling.
const eligibles = memberUserIds.map((uid) =>
  PollEligibleMember.create(poll.id, uid, snapshotAt)
);
const elResult = await this.eligibleRepository.createMany(eligibles);
if (!elResult.success) return failure(elResult.error);

// Compute weights per config.
let weights = new Map<string, number>();
if (isOwnershipMode(poll.distributionType as DistributionType)) {
  const rowsResult =
    await this.propertyAssetRepository.findCurrentOwnershipByOrg(
      poll.organizationId,
      poll.propertyIds
    );
  if (!rowsResult.success) return failure(rowsResult.error);
  weights = computeWeights({
    candidates: memberUserIds,
    distributionType: poll.distributionType as DistributionType,
    propertyAggregation: poll.propertyAggregation as any,
    propertyIds: poll.propertyIds,
    assets: rowsResult.value.map((r) => ({
      id: r.asset.id,
      propertyId: r.asset.propertyId,
      size: r.asset.size,
    })),
    ownerships: rowsResult.value.map((r) => ({
      assetId: r.ownership.assetId,
      userId: r.ownership.userId,
      share: r.ownership.share,
    })),
  });
} else if (poll.distributionType === DistributionType.EQUAL) {
  // EQUAL respects property scope too:
  weights = computeWeights({
    candidates: memberUserIds,
    distributionType: DistributionType.EQUAL,
    propertyAggregation: 'RAW_SUM' as any,
    propertyIds: poll.propertyIds,
    assets: [], // not needed under EQUAL+no-scope
    ownerships: [],
  });

  // If EQUAL with scope, we need ownership to decide eligibility.
  if (poll.propertyIds.length > 0) {
    const rowsResult =
      await this.propertyAssetRepository.findCurrentOwnershipByOrg(
        poll.organizationId,
        poll.propertyIds
      );
    if (!rowsResult.success) return failure(rowsResult.error);
    weights = computeWeights({
      candidates: memberUserIds,
      distributionType: DistributionType.EQUAL,
      propertyAggregation: 'RAW_SUM' as any,
      propertyIds: poll.propertyIds,
      assets: rowsResult.value.map((r) => ({
        id: r.asset.id,
        propertyId: r.asset.propertyId,
        size: r.asset.size,
      })),
      ownerships: rowsResult.value.map((r) => ({
        assetId: r.ownership.assetId,
        userId: r.ownership.userId,
        share: r.ownership.share,
      })),
    });
  }
}

// Create participants only for users with a positive weight.
const participants: PollParticipant[] = [];
const historyRecords: ParticipantWeightHistory[] = [];
for (const [userId, w] of weights) {
  const p = PollParticipant.create(poll.id, userId, w);
  if (!p.success) return failure(p.error);
  participants.push(p.value);
  const h = ParticipantWeightHistory.create(
    '',
    poll.id,
    userId,
    0,
    w,
    command.userId,
    'Initial snapshot on poll preparation'
  );
  if (h.success) historyRecords.push(h.value);
}
```

The existing `executeActivation(poll, participants, historyRecords)` call continues to persist `poll_participants` + history atomically.

- [ ] **Step 3: Update the DI / construction site**

Search for `new TakeSnapshotUseCase(` — update every construction site (action helpers, tests) to pass the two new repos.

- [ ] **Step 4: Run tests**

```bash
yarn test src/application/poll/__tests__/TakeSnapshotUseCase.test.ts
```

Fix any broken assertions; fill in the test stubs using real repo mock patterns from neighboring tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/poll/TakeSnapshotUseCase.ts src/application/poll/__tests__/TakeSnapshotUseCase.test.ts
git commit -m "feat(app): TakeSnapshot respects distribution_type, aggregation, property scope"
```

---

## Task 19: Application — `PreviewPollWeightConfigUseCase`

**Files:**

- Create: `src/application/poll/PreviewPollWeightConfigUseCase.ts`
- Create: `src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts`

- [ ] **Step 1: Write failing test**

`src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PreviewPollWeightConfigUseCase } from '../PreviewPollWeightConfigUseCase';
import { DistributionType } from '../../domain/poll/DistributionType';
import { PropertyAggregation } from '../../domain/poll/PropertyAggregation';

// Stub repos mirroring Task 18's harness. Keep the scenarios focused:
// - diff correctness (added/removed/reweighted)
// - votes-cast rejection
// - missing ownership data for ownership modes

describe('PreviewPollWeightConfigUseCase', () => {
  it('returns a diff without writing', async () => {
    // arrange poll in EQUAL, switch to OWNERSHIP_UNIT_COUNT, verify diff and no write calls
    expect(true).toBe(true);
  });

  it('rejects when the poll already has votes', async () => {
    // arrange pollHasVotes=true; expect failure with votesCastCannotChangeWeightConfig
    expect(true).toBe(true);
  });

  it('rejects ownership modes when org has no ownership data', async () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm failure**

```bash
yarn test src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts
```

- [ ] **Step 3: Implement**

`src/application/poll/PreviewPollWeightConfigUseCase.ts`:

```typescript
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { computeWeights } from '../../domain/poll/WeightDistribution';
import {
  DistributionType,
  isOwnershipMode,
  parseDistributionType,
} from '../../domain/poll/DistributionType';
import {
  PropertyAggregation,
  parsePropertyAggregation,
} from '../../domain/poll/PropertyAggregation';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';

export interface PreviewInput {
  pollId: string;
  newConfig: {
    distributionType?: string;
    propertyAggregation?: string;
    propertyIds?: string[];
  };
  actingUserId: string;
}

export interface PreviewOutput {
  effectiveConfig: {
    distributionType: DistributionType;
    propertyAggregation: PropertyAggregation;
    propertyIds: string[];
  };
  addedParticipants: Array<{ userId: string; newWeight: number }>;
  removedParticipants: Array<{ userId: string }>;
  reweightedParticipants: Array<{
    userId: string;
    oldWeight: number;
    newWeight: number;
  }>;
  totalWeight: number;
}

export class PreviewPollWeightConfigUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private userRepository: UserRepository,
    private organizationRepository: OrganizationRepository,
    private eligibleRepository: PollEligibleMemberRepository,
    private propertyAssetRepository: PropertyAssetRepository
  ) {}

  async execute(input: PreviewInput): Promise<Result<PreviewOutput, string>> {
    const pollR = await this.pollRepository.getPollById(input.pollId);
    if (!pollR.success) return failure(pollR.error);
    const poll = pollR.value;
    if (!poll) return failure(PollErrors.NOT_FOUND);

    // Auth
    const isSuper = await this.userRepository.isSuperAdmin(input.actingUserId);
    if (!isSuper) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.actingUserId,
        poll.organizationId
      );
      if (!isAdmin) return failure(PollErrors.NOT_AUTHORIZED);
    }

    // Votes-cast guard
    const hasVotesR = await this.participantRepository.pollHasVotes(poll.id);
    if (!hasVotesR.success) return failure(hasVotesR.error);
    if (hasVotesR.value) {
      return failure(PollDomainCodes.VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG);
    }

    // Merge config
    const dtStr = input.newConfig.distributionType ?? poll.distributionType;
    const paStr =
      input.newConfig.propertyAggregation ?? poll.propertyAggregation;
    const propIds = input.newConfig.propertyIds ?? poll.propertyIds;

    const dtR = parseDistributionType(dtStr);
    if (!dtR.success) return failure(dtR.error);
    const paR = parsePropertyAggregation(paStr);
    if (!paR.success) return failure(paR.error);

    // Ownership-data check for ownership modes
    if (isOwnershipMode(dtR.value)) {
      const hasData = await this.propertyAssetRepository.orgHasOwnershipData(
        poll.organizationId
      );
      if (!hasData.success) return failure(hasData.error);
      if (!hasData.value)
        return failure(PollDomainCodes.OWNERSHIP_DATA_MISSING);
    }

    // Load eligible members (the ceiling)
    const elR = await this.eligibleRepository.findByPollId(poll.id);
    if (!elR.success) return failure(elR.error);
    const candidates = elR.value.map((m) => m.userId);

    // Load ownership rows (if relevant)
    let assets: any[] = [];
    let ownerships: any[] = [];
    if (isOwnershipMode(dtR.value) || propIds.length > 0) {
      const rowsR =
        await this.propertyAssetRepository.findCurrentOwnershipByOrg(
          poll.organizationId,
          propIds
        );
      if (!rowsR.success) return failure(rowsR.error);
      assets = rowsR.value.map((r) => ({
        id: r.asset.id,
        propertyId: r.asset.propertyId,
        size: r.asset.size,
      }));
      ownerships = rowsR.value.map((r) => ({
        assetId: r.ownership.assetId,
        userId: r.ownership.userId,
        share: r.ownership.share,
      }));
    }

    const newWeights = computeWeights({
      candidates,
      distributionType: dtR.value,
      propertyAggregation: paR.value,
      propertyIds: propIds,
      assets,
      ownerships,
    });

    // Load current participants for diffing
    const currentR = await this.participantRepository.getParticipants(poll.id);
    if (!currentR.success) return failure(currentR.error);
    const currentByUser = new Map(
      currentR.value.map((p) => [p.userId, p] as const)
    );

    const added: Array<{ userId: string; newWeight: number }> = [];
    const removed: Array<{ userId: string }> = [];
    const reweighted: Array<{
      userId: string;
      oldWeight: number;
      newWeight: number;
    }> = [];

    for (const userId of candidates) {
      const newW = newWeights.get(userId);
      const current = currentByUser.get(userId);
      if (newW === undefined && current) {
        removed.push({ userId });
      } else if (newW !== undefined && !current) {
        added.push({ userId, newWeight: newW });
      } else if (newW !== undefined && current && current.userWeight !== newW) {
        reweighted.push({
          userId,
          oldWeight: current.userWeight,
          newWeight: newW,
        });
      }
    }

    const totalWeight = [...newWeights.values()].reduce((s, v) => s + v, 0);

    return success({
      effectiveConfig: {
        distributionType: dtR.value,
        propertyAggregation: paR.value,
        propertyIds: propIds,
      },
      addedParticipants: added,
      removedParticipants: removed,
      reweightedParticipants: reweighted,
      totalWeight,
    });
  }
}
```

- [ ] **Step 4: `ParticipantRepository.pollHasVotes` — confirm it exists**

```bash
grep -n "pollHasVotes" src/domain/poll/ParticipantRepository.ts src/infrastructure/repositories/PrismaParticipantRepository.ts
```

If it doesn't exist, add it to the port + Prisma impl. It should return `Result<boolean, string>` and query `vote` with `where: { participant: { pollId } }` or similar.

- [ ] **Step 5: Run tests; fill in stubs to make them pass**

```bash
yarn test src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/application/poll/PreviewPollWeightConfigUseCase.ts src/application/poll/__tests__/PreviewPollWeightConfigUseCase.test.ts src/domain/poll/ParticipantRepository.ts src/infrastructure/repositories/PrismaParticipantRepository.ts
git commit -m "feat(app): PreviewPollWeightConfigUseCase with votes-cast + ownership-data guards"
```

---

## Task 20: Application — `UpdatePollWeightConfigUseCase`

**Files:**

- Create: `src/application/poll/UpdatePollWeightConfigUseCase.ts`
- Create: `src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts`

- [ ] **Step 1: Write failing tests**

`src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UpdatePollWeightConfigUseCase } from '../UpdatePollWeightConfigUseCase';
import { DistributionType } from '../../domain/poll/DistributionType';
import { PropertyAggregation } from '../../domain/poll/PropertyAggregation';

describe('UpdatePollWeightConfigUseCase', () => {
  it('commits added/removed/reweighted with history rows', async () => {
    // arrange: currentParticipants=[alice=1,bob=1]; switching to ownership yields
    // alice=2.5, bob removed. Expect applyWeightConfigChange called with add=[], remove=[bob], update=[alice: 1→2.5]
    expect(true).toBe(true);
  });

  it('wipes manual overrides — changes not owned by distributed weight are replaced', async () => {
    expect(true).toBe(true);
  });

  it('rejects when votes have been cast', async () => {
    expect(true).toBe(true);
  });

  it('uses frozen eligible set; previously-zero-weight member can be added on switch to EQUAL', async () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

`src/application/poll/UpdatePollWeightConfigUseCase.ts`:

```typescript
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { computeWeights } from '../../domain/poll/WeightDistribution';
import {
  DistributionType,
  isOwnershipMode,
  parseDistributionType,
} from '../../domain/poll/DistributionType';
import {
  PropertyAggregation,
  parsePropertyAggregation,
} from '../../domain/poll/PropertyAggregation';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';

export interface UpdateInput {
  pollId: string;
  newConfig: {
    distributionType?: string;
    propertyAggregation?: string;
    propertyIds?: string[];
  };
  adminUserId: string;
}

export class UpdatePollWeightConfigUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private userRepository: UserRepository,
    private organizationRepository: OrganizationRepository,
    private eligibleRepository: PollEligibleMemberRepository,
    private propertyAssetRepository: PropertyAssetRepository
  ) {}

  async execute(input: UpdateInput): Promise<Result<void, string>> {
    const pollR = await this.pollRepository.getPollById(input.pollId);
    if (!pollR.success) return failure(pollR.error);
    const poll = pollR.value;
    if (!poll) return failure(PollErrors.NOT_FOUND);

    // Auth
    const isSuper = await this.userRepository.isSuperAdmin(input.adminUserId);
    if (!isSuper) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.adminUserId,
        poll.organizationId
      );
      if (!isAdmin) return failure(PollErrors.NOT_AUTHORIZED);
    }

    // Votes-cast guard
    const hasVotesR = await this.participantRepository.pollHasVotes(poll.id);
    if (!hasVotesR.success) return failure(hasVotesR.error);
    if (hasVotesR.value) {
      return failure(PollDomainCodes.VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG);
    }

    // Merge + validate config
    const dtStr = input.newConfig.distributionType ?? poll.distributionType;
    const paStr =
      input.newConfig.propertyAggregation ?? poll.propertyAggregation;
    const propIds = input.newConfig.propertyIds ?? poll.propertyIds;

    const dtR = parseDistributionType(dtStr);
    if (!dtR.success) return failure(dtR.error);
    const paR = parsePropertyAggregation(paStr);
    if (!paR.success) return failure(paR.error);

    if (isOwnershipMode(dtR.value)) {
      const hasData = await this.propertyAssetRepository.orgHasOwnershipData(
        poll.organizationId
      );
      if (!hasData.success) return failure(hasData.error);
      if (!hasData.value)
        return failure(PollDomainCodes.OWNERSHIP_DATA_MISSING);
    }

    // Validate property ids belong to the org
    if (propIds.length > 0) {
      // Implementation: call OrganizationPropertyRepository.findByOrganization
      // and verify every id in propIds is present. If not, return PROPERTY_NOT_IN_ORG.
      // (Dependency-inject the repo or pass via constructor. Keep this explicit.)
    }

    // Load eligible ceiling + current participants
    const elR = await this.eligibleRepository.findByPollId(poll.id);
    if (!elR.success) return failure(elR.error);
    const candidates = elR.value.map((m) => m.userId);

    const currentR = await this.participantRepository.getParticipants(poll.id);
    if (!currentR.success) return failure(currentR.error);
    const currentByUser = new Map(
      currentR.value.map((p) => [p.userId, p] as const)
    );

    // Load ownership rows
    let assets: any[] = [];
    let ownerships: any[] = [];
    if (isOwnershipMode(dtR.value) || propIds.length > 0) {
      const rowsR =
        await this.propertyAssetRepository.findCurrentOwnershipByOrg(
          poll.organizationId,
          propIds
        );
      if (!rowsR.success) return failure(rowsR.error);
      assets = rowsR.value.map((r) => ({
        id: r.asset.id,
        propertyId: r.asset.propertyId,
        size: r.asset.size,
      }));
      ownerships = rowsR.value.map((r) => ({
        assetId: r.ownership.assetId,
        userId: r.ownership.userId,
        share: r.ownership.share,
      }));
    }

    const newWeights = computeWeights({
      candidates,
      distributionType: dtR.value,
      propertyAggregation: paR.value,
      propertyIds: propIds,
      assets,
      ownerships,
    });

    // Compute add/remove/update lists
    const add: Array<{ userId: string; weight: number }> = [];
    const remove: Array<{
      participantId: string;
      userId: string;
      oldWeight: number;
    }> = [];
    const update: Array<{
      participantId: string;
      userId: string;
      oldWeight: number;
      newWeight: number;
    }> = [];

    for (const userId of candidates) {
      const w = newWeights.get(userId);
      const cur = currentByUser.get(userId);
      if (w === undefined && cur) {
        remove.push({
          participantId: cur.id,
          userId,
          oldWeight: cur.userWeight,
        });
      } else if (w !== undefined && !cur) {
        add.push({ userId, weight: w });
      } else if (w !== undefined && cur && cur.userWeight !== w) {
        update.push({
          participantId: cur.id,
          userId,
          oldWeight: cur.userWeight,
          newWeight: w,
        });
      }
    }

    const reason = this.buildReason(
      poll.distributionType,
      dtR.value,
      poll.propertyAggregation,
      paR.value,
      poll.propertyIds,
      propIds
    );

    const applyR = await this.participantRepository.applyWeightConfigChange(
      poll.id,
      dtR.value,
      paR.value,
      propIds,
      add,
      remove,
      update,
      input.adminUserId,
      reason
    );
    if (!applyR.success) return failure(applyR.error);

    return success(undefined);
  }

  private buildReason(
    oldDT: string,
    newDT: string,
    oldPA: string,
    newPA: string,
    oldIds: string[],
    newIds: string[]
  ): string {
    const dtChanged = oldDT !== newDT;
    const paChanged = oldPA !== newPA;
    const scopeChanged =
      oldIds.length !== newIds.length ||
      !oldIds.every((id) => newIds.includes(id));

    const changeCount = [dtChanged, paChanged, scopeChanged].filter(
      Boolean
    ).length;
    if (changeCount > 1) return 'Weight config changed';
    if (dtChanged) return `Distribution type changed to ${newDT}`;
    if (paChanged) return `Property aggregation changed to ${newPA}`;
    if (scopeChanged) return 'Property scope changed';
    return 'Weight config reconfirmed'; // no-op case
  }
}
```

- [ ] **Step 3: Run tests, fill in stubs, adjust**

```bash
yarn test src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/application/poll/UpdatePollWeightConfigUseCase.ts src/application/poll/__tests__/UpdatePollWeightConfigUseCase.test.ts
git commit -m "feat(app): UpdatePollWeightConfigUseCase (atomic add/remove/update + history)"
```

---

## Task 21: Web server actions

**Files:**

- Modify: `src/web/actions/poll/poll.ts`

- [ ] **Step 1: Inspect the file**

```bash
head -40 src/web/actions/poll/poll.ts
```

Note the imports, rate-limit pattern (`checkRateLimit()`), auth helper usage, and how use cases are instantiated.

- [ ] **Step 2: Add `previewPollWeightConfig` action**

Append to `src/web/actions/poll/poll.ts`:

```typescript
'use server';
// ...existing imports...
import { PreviewPollWeightConfigUseCase } from '@/src/application/poll/PreviewPollWeightConfigUseCase';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';

export async function previewPollWeightConfig(args: {
  pollId: string;
  distributionType?: string;
  propertyAggregation?: string;
  propertyIds?: string[];
}) {
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;

  const user = await getCurrentUser(); // existing helper
  if (!user)
    return {
      success: false as const,
      error: await translateErrorCode('auth.errors.unauthorized'),
    };

  const useCase = new PreviewPollWeightConfigUseCase(
    getPollRepository(),
    getParticipantRepository(),
    getUserRepository(),
    getOrganizationRepository(),
    getPollEligibleMemberRepository(),
    getPropertyAssetRepository()
  );

  const result = await useCase.execute({
    pollId: args.pollId,
    newConfig: {
      distributionType: args.distributionType,
      propertyAggregation: args.propertyAggregation,
      propertyIds: args.propertyIds,
    },
    actingUserId: user.id,
  });

  if (!result.success) {
    return {
      success: false as const,
      error: await translateErrorCode(result.error),
    };
  }
  return { success: true as const, data: result.value };
}
```

> Adjust the exact repo-factory helper names to match conventions already present in `poll.ts` (`getPollRepository`, etc. — if helpers don't exist, pull `getPrisma()` and new repos directly).

- [ ] **Step 3: Add `updatePollWeightConfig` action**

Analogously. Uses `UpdatePollWeightConfigUseCase`. Same auth, rate-limit, translation pattern. Returns `{ success: true }` on success.

- [ ] **Step 4: Extend `createPoll` action input schema to accept config**

Find the existing `createPoll` action. Add optional fields to its Zod input schema:

```typescript
distributionType: z.enum(['EQUAL', 'OWNERSHIP_UNIT_COUNT', 'OWNERSHIP_SIZE_WEIGHTED']).optional(),
propertyAggregation: z.enum(['RAW_SUM', 'NORMALIZE_PER_PROPERTY']).optional(),
propertyIds: z.array(z.string()).optional(),
```

Pass these through to `CreatePollUseCase`. Update `CreatePollUseCase` to accept them (pass through to `Poll.create`).

- [ ] **Step 5: Type-check**

```bash
yarn tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add src/web/actions/poll/poll.ts src/application/poll/CreatePollUseCase.ts
git commit -m "feat(web): preview + update + create poll with weight config"
```

---

## Task 22: Localization

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Open `messages/en.json`, add keys under the `poll` object**

```json
"distribution": {
  "label": "Weight distribution",
  "type": {
    "equal": "Equal (1 per participant)",
    "ownershipUnitCount": "By unit count",
    "ownershipSizeWeighted": "By unit size"
  },
  "ownershipOptionDisabledTooltip": "Organization has no ownership data configured"
},
"propertyScope": {
  "label": "Properties",
  "allByDefault": "(all properties)",
  "empty": "No properties selected"
},
"aggregation": {
  "label": "Property aggregation",
  "rawSum": "Raw sum",
  "normalizePerProperty": "Normalize per property",
  "tooltip": "Raw sum: absolute size dominates across properties. Normalize per property: each property contributes equally up to 1.0."
},
"weightConfig": {
  "preview": {
    "added": "{count, plural, one {# participant will be added} other {# participants will be added}}",
    "removed": "{count, plural, one {# participant will be removed} other {# participants will be removed}}",
    "reweighted": "{count, plural, one {# participant will be reweighted} other {# participants will be reweighted}}",
    "save": "Save",
    "cancel": "Cancel"
  },
  "changeReason": {
    "distributionType": "Distribution type changed to {type}",
    "propertyScope": "Property scope changed",
    "propertyAggregation": "Property aggregation changed to {aggregation}",
    "combined": "Weight config changed"
  }
},
"results": {
  "distributionTypeLabel": "Weight distribution: {type}",
  "propertiesLabel": "Properties: {names}",
  "aggregationLabel": "Aggregation: {aggregation}"
},
"errors": {
  "cannotChangeWeightConfig": "Cannot change weight configuration for this poll"
}
```

And under a top-level `domain.poll` / `domain.organization` section (mirror existing structure):

```
"domain.poll.distributionTypeInvalid": "Invalid distribution type",
"domain.poll.propertyAggregationInvalid": "Invalid property aggregation",
"domain.poll.ownershipDataMissing": "Organization has no ownership data",
"domain.poll.propertyNotInOrg": "Selected property does not belong to this organization",
"domain.poll.votesCastCannotChangeWeightConfig": "Weight config cannot be changed after votes are cast",
"domain.organization.propertyNameEmpty": "Property name cannot be empty",
"domain.organization.propertyAssetNameEmpty": "Asset name cannot be empty",
"domain.organization.propertyAssetSizeNonPositive": "Asset size must be greater than zero",
"domain.organization.propertyAssetOwnershipShareOutOfRange": "Ownership share must be between 0 and 1"
```

> Exact nesting should follow the existing structure in `messages/en.json` — open the file to confirm whether keys are dotted (`"domain.poll.invalidWeight": "..."`) or nested objects, and match.

- [ ] **Step 2: Mirror in `messages/ru.json`**

Translate each key to Russian. Example highlights:

- `"distribution.label"` → `"Распределение веса"`
- `"type.equal"` → `"Равное (1 на участника)"`
- `"type.ownershipUnitCount"` → `"По количеству единиц"`
- `"type.ownershipSizeWeighted"` → `"По размеру единицы"`
- `"aggregation.rawSum"` → `"Суммарное"`
- `"aggregation.normalizePerProperty"` → `"Нормализованное по объекту"`
- `"propertyScope.label"` → `"Объекты"`
- `"weightConfig.preview.save"` → `"Сохранить"`
- `"weightConfig.preview.cancel"` → `"Отмена"`
- `"domain.poll.ownershipDataMissing"` → `"У организации нет данных о собственности"`

- [ ] **Step 3: Sanity check — no JSON parse errors**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && \
node -e "JSON.parse(require('fs').readFileSync('messages/ru.json'))"
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ru.json
git commit -m "feat(i18n): en/ru messages for weight distribution types"
```

---

## Task 23: UI — `WeightConfigEditor` + sub-components

**Files:**

- Create: `src/web/components/polls/participants/WeightConfigEditor.tsx`
- Create: `src/web/components/polls/participants/DistributionTypeSelector.tsx`
- Create: `src/web/components/polls/participants/PropertyScopeSelector.tsx`
- Create: `src/web/components/polls/participants/PropertyAggregationSelector.tsx`
- Create: `src/web/components/polls/shared/weightDisplay.ts`

- [ ] **Step 0: Explore existing Catalyst components**

```bash
ls src/web/components/catalyst/ | head -20
```

Prefer Catalyst `Select`, `Checkbox`, `RadioGroup`, `Button` as used elsewhere.

- [ ] **Step 1: Create `weightDisplay.ts`** (pure helper)

`src/web/components/polls/shared/weightDisplay.ts`:

```typescript
export function formatWeightAndPercent(weight: number, total: number): string {
  const raw = weight.toFixed(2);
  if (total <= 0) return `${raw} (0.00%)`;
  const pct = ((weight / total) * 100).toFixed(2);
  return `${raw} (${pct}%)`;
}
```

Add a colocated test if the codebase keeps shared-helper tests: `src/web/components/polls/shared/__tests__/weightDisplay.test.ts`.

- [ ] **Step 2: Create `DistributionTypeSelector`**

A Catalyst `Select` wrapped in a labeled field. Props:

```typescript
{
  value: 'EQUAL' | 'OWNERSHIP_UNIT_COUNT' | 'OWNERSHIP_SIZE_WEIGHTED';
  onChange: (v: string) => void;
  disabled?: boolean;
  ownershipDisabledReason?: string | null; // if truthy, ownership options disabled + tooltip
}
```

Renders three options using localized labels via `useTranslations('poll.distribution.type')`.

- [ ] **Step 3: Create `PropertyScopeSelector`**

Props:

```typescript
{
  properties: Array<{ id: string; name: string }>; // non-archived, from server component
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}
```

Renders a list of Catalyst `Checkbox` items, one per property. Controlled component. Keeps behavior: empty array internally means "no filter" (the parent decides how to represent that). No special "all" checkbox in v1 — a user just checks all boxes.

- [ ] **Step 4: Create `PropertyAggregationSelector`**

Props:

```typescript
{
  value: 'RAW_SUM' | 'NORMALIZE_PER_PROPERTY';
  onChange: (v: 'RAW_SUM' | 'NORMALIZE_PER_PROPERTY') => void;
  disabled?: boolean;
  visible: boolean;      // parent computes visibility from (isOwnershipMode && effectiveScopeCount >= 2)
}
```

Renders a Catalyst `RadioGroup` with two options + a tooltip (see localization key `poll.aggregation.tooltip`).

- [ ] **Step 5: Create `WeightConfigEditor` (the orchestrator)**

`src/web/components/polls/participants/WeightConfigEditor.tsx`:

```typescript
'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { previewPollWeightConfig, updatePollWeightConfig } from '@/web/actions/poll/poll';
import { DistributionTypeSelector } from './DistributionTypeSelector';
import { PropertyScopeSelector } from './PropertyScopeSelector';
import { PropertyAggregationSelector } from './PropertyAggregationSelector';
import { Button } from '@/web/components/catalyst/button';

interface Props {
  pollId: string;
  initialConfig: {
    distributionType: string;
    propertyAggregation: string;
    propertyIds: string[];
  };
  properties: Array<{ id: string; name: string }>;
  orgHasOwnershipData: boolean;
  votesCast: boolean;
  onSaved: () => void; // parent triggers a refresh (e.g., router.refresh())
}

export function WeightConfigEditor({
  pollId,
  initialConfig,
  properties,
  orgHasOwnershipData,
  votesCast,
  onSaved,
}: Props) {
  const t = useTranslations('poll');
  const [draft, setDraft] = useState(initialConfig);
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDraftDifferent =
    draft.distributionType !== initialConfig.distributionType ||
    draft.propertyAggregation !== initialConfig.propertyAggregation ||
    JSON.stringify([...draft.propertyIds].sort()) !==
      JSON.stringify([...initialConfig.propertyIds].sort());

  const isOwnership =
    draft.distributionType === 'OWNERSHIP_UNIT_COUNT' ||
    draft.distributionType === 'OWNERSHIP_SIZE_WEIGHTED';

  const effectiveScopeCount =
    draft.propertyIds.length === 0 ? properties.length : draft.propertyIds.length;
  const aggregationVisible = isOwnership && effectiveScopeCount >= 2;

  async function loadPreview(next: typeof draft) {
    setError(null);
    const r = await previewPollWeightConfig({
      pollId,
      distributionType: next.distributionType,
      propertyAggregation: next.propertyAggregation,
      propertyIds: next.propertyIds,
    });
    if (r.success) setPreview(r.data);
    else setError(r.error);
  }

  function handleChange(next: Partial<typeof draft>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    startTransition(() => {
      void loadPreview(merged);
    });
  }

  function handleCancel() {
    setDraft(initialConfig);
    setPreview(null);
    setError(null);
  }

  async function handleSave() {
    setError(null);
    const r = await updatePollWeightConfig({
      pollId,
      distributionType: draft.distributionType,
      propertyAggregation: draft.propertyAggregation,
      propertyIds: draft.propertyIds,
    });
    if (r.success) {
      setPreview(null);
      onSaved();
    } else {
      setError(r.error);
    }
  }

  const disabled = votesCast || isPending;

  return (
    <div className="space-y-4 rounded-md border p-4">
      <DistributionTypeSelector
        value={draft.distributionType as any}
        onChange={(v) => handleChange({ distributionType: v })}
        disabled={disabled}
        ownershipDisabledReason={
          !orgHasOwnershipData ? t('distribution.ownershipOptionDisabledTooltip') : null
        }
      />
      {properties.length >= 2 && (
        <PropertyScopeSelector
          properties={properties}
          selectedIds={draft.propertyIds}
          onChange={(ids) => handleChange({ propertyIds: ids })}
          disabled={disabled}
        />
      )}
      <PropertyAggregationSelector
        value={draft.propertyAggregation as any}
        onChange={(v) => handleChange({ propertyAggregation: v })}
        disabled={disabled}
        visible={aggregationVisible}
      />
      {isDraftDifferent && preview && (
        <div className="rounded-md bg-zinc-50 p-3 text-sm">
          <p>{t('weightConfig.preview.added', { count: preview.addedParticipants.length })}</p>
          <p>{t('weightConfig.preview.removed', { count: preview.removedParticipants.length })}</p>
          <p>{t('weightConfig.preview.reweighted', { count: preview.reweightedParticipants.length })}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleSave} disabled={disabled}>
              {t('weightConfig.preview.save')}
            </Button>
            <Button outline onClick={handleCancel} disabled={disabled}>
              {t('weightConfig.preview.cancel')}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

```bash
yarn tsc --noEmit 2>&1 | grep -E "WeightConfig|PropertyScope|DistributionType|PropertyAggregation" | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/web/components/polls/participants/WeightConfigEditor.tsx src/web/components/polls/participants/DistributionTypeSelector.tsx src/web/components/polls/participants/PropertyScopeSelector.tsx src/web/components/polls/participants/PropertyAggregationSelector.tsx src/web/components/polls/shared/weightDisplay.ts
git commit -m "feat(ui): WeightConfigEditor with type/scope/aggregation selectors and preview"
```

---

## Task 24: UI — wire editor into `ParticipantManagement`

**Files:**

- Modify: `src/web/components/polls/participants/ParticipantManagement.tsx`
- Modify: `src/app/[locale]/polls/[pollId]/participants/page.tsx`

- [ ] **Step 1: Read the current `ParticipantManagement.tsx`**

```bash
wc -l src/web/components/polls/participants/ParticipantManagement.tsx
head -60 src/web/components/polls/participants/ParticipantManagement.tsx
```

Understand its props and top-of-render layout.

- [ ] **Step 2: Extend its props**

Add:

```typescript
  weightConfig: {
    distributionType: string;
    propertyAggregation: string;
    propertyIds: string[];
  };
  properties: Array<{ id: string; name: string }>;
  orgHasOwnershipData: boolean;
  votesCast: boolean;
```

- [ ] **Step 3: Render `WeightConfigEditor` above the participants table**

Import and insert the component at the top of the body, above the existing toolbar/table:

```tsx
<WeightConfigEditor
  pollId={poll.id}
  initialConfig={weightConfig}
  properties={properties}
  orgHasOwnershipData={orgHasOwnershipData}
  votesCast={votesCast}
  onSaved={() => router.refresh()}
/>
```

- [ ] **Step 4: Update weight display to `raw (percentage)` format**

Find where `userWeight` is rendered in the table. Import `formatWeightAndPercent` from `../shared/weightDisplay` and replace the plain number with:

```tsx
{
  formatWeightAndPercent(p.userWeight, totalWeight);
}
```

Compute `totalWeight` once as `participants.reduce((s, p) => s + p.userWeight, 0)`. Also update the total-weight banner to display `${totalWeight.toFixed(2)} (100.00%)`.

- [ ] **Step 5: Update the parent page to pass the new props**

Open `src/app/[locale]/polls/[pollId]/participants/page.tsx`. In the server component, fetch:

- The poll (including `distributionType`, `propertyAggregation`, `propertyIds`)
- `OrganizationPropertyRepository.findByOrganization(poll.organizationId)` → `properties`
- `PropertyAssetRepository.orgHasOwnershipData(poll.organizationId)` → `orgHasOwnershipData`
- Compute `votesCast` via the same predicate as the existing edit-weight guard (`pollHasVotes`).

Serialize to plain objects before passing to the Client Component (per project security rules).

- [ ] **Step 6: Type-check + lint**

```bash
yarn tsc --noEmit 2>&1 | head -20
yarn lint 2>&1 | head -20
```

- [ ] **Step 7: Manual smoke test**

Start the dev server:

```bash
yarn dev
```

Then navigate to a poll's Participants page (with the admin user). Verify:

- The editor renders above the table
- Weight column shows `X.XX (Y.YY%)`
- Changing the type triggers a preview banner with counts
- Save commits; Cancel reverts
- If votes exist on another poll, editor is disabled with tooltip

- [ ] **Step 8: Commit**

```bash
git add src/web/components/polls/participants/ParticipantManagement.tsx src/app/[locale]/polls/[pollId]/participants/page.tsx
git commit -m "feat(ui): Participants page hosts WeightConfigEditor + percent display"
```

---

## Task 25: UI — poll creation form integration

**Files:**

- Modify: the poll-creation form file (discover in Step 0)

- [ ] **Step 0: Find the poll creation form**

```bash
grep -rln "createPoll\|CreatePoll" src/app src/web/components | head -10
```

Pick the form component (most likely under `src/web/components/polls/create/` or `src/app/[locale]/polls/new/`). Inspect it.

- [ ] **Step 1: Add weight-config section to the form**

Add a collapsed "Weight distribution" section to the form. Inputs:

- `DistributionTypeSelector` (reuse the same component)
- `PropertyScopeSelector` (shown if `properties.length >= 2`)
- `PropertyAggregationSelector` (visibility rule matches Task 23)

Visibility gate for the whole section: shown iff `creatorHasOwnership || creatorIsAdmin`. Otherwise hidden; creation defaults are `{EQUAL, RAW_SUM, []}`.

- [ ] **Step 2: Pass values to `createPoll` action**

The form's submit handler already calls `createPoll(...)`. Add the three fields to the call. Task 21 already extended the Zod schema.

- [ ] **Step 3: Pass required data from the server component rendering the form**

The server component should fetch and pass:

- `creatorHasOwnership: boolean` — via `PropertyAssetRepository.findCurrentOwnershipByOrg(orgId, [])` filtered by user's ownership; or a dedicated method `hasUserOwnership(orgId, userId)`.
- `creatorIsAdmin: boolean` — existing helpers.
- `properties: Array<{id,name}>` — via `OrganizationPropertyRepository.findByOrganization`.

If `hasUserOwnership` doesn't exist on `PropertyAssetRepository`, add it:

```typescript
  hasUserOwnership(organizationId: string, userId: string): Promise<Result<boolean, string>>;
```

And implement in the Prisma repo: query `propertyAssetOwnership.findFirst` with the same org join + `userId = userId` + `effectiveUntil IS NULL`.

- [ ] **Step 4: Manual smoke test**

Create a poll with (a) a normal member who has ownership → picker visible; (b) a member without ownership → picker hidden; (c) an admin without personal ownership → picker visible.

- [ ] **Step 5: Commit**

```bash
git add <paths touched>
git commit -m "feat(ui): poll creation form accepts weight distribution config"
```

---

## Task 26: UI — results-page label

**Files:**

- Create: `src/web/components/polls/results/WeightConfigLabel.tsx`
- Modify: results page (discover in Step 0)

- [ ] **Step 0: Find the results page**

```bash
grep -rln "GetPollResults\|poll-results\|results/page" src/app src/web/components | head -10
```

- [ ] **Step 1: Create the label**

`src/web/components/polls/results/WeightConfigLabel.tsx`:

```typescript
'use client';
import { useTranslations } from 'next-intl';

interface Props {
  distributionType: string;
  propertyAggregation: string;
  scopedPropertyNames: string[]; // [] if no scope
  showAggregation: boolean;      // parent passes (isOwnership && effectiveScopeCount >= 2)
}

export function WeightConfigLabel({
  distributionType,
  propertyAggregation,
  scopedPropertyNames,
  showAggregation,
}: Props) {
  const tType = useTranslations('poll.distribution.type');
  const tResults = useTranslations('poll.results');
  const tAgg = useTranslations('poll.aggregation');

  const typeLabel =
    distributionType === 'EQUAL'
      ? tType('equal')
      : distributionType === 'OWNERSHIP_UNIT_COUNT'
        ? tType('ownershipUnitCount')
        : tType('ownershipSizeWeighted');

  return (
    <div className="space-y-1 text-sm text-zinc-600">
      <p>{tResults('distributionTypeLabel', { type: typeLabel })}</p>
      {scopedPropertyNames.length > 0 && (
        <p>{tResults('propertiesLabel', { names: scopedPropertyNames.join(', ') })}</p>
      )}
      {showAggregation && (
        <p>
          {tResults('aggregationLabel', {
            aggregation:
              propertyAggregation === 'RAW_SUM'
                ? tAgg('rawSum')
                : tAgg('normalizePerProperty'),
          })}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into results page**

In the server component rendering results, fetch `poll.propertyIds`, map to property names via `OrganizationPropertyRepository.findByOrganization`, compute `showAggregation` (same rule as editor), and pass to `<WeightConfigLabel>` near the top of the results UI.

Also update the participant-weight display on the results table to use `formatWeightAndPercent`.

- [ ] **Step 3: Manual smoke test + commit**

```bash
yarn dev
# Verify: open a poll's results; label shows type + (when applicable) properties + aggregation.
git add src/web/components/polls/results/WeightConfigLabel.tsx <results-page-file>
git commit -m "feat(ui): Results page shows weight config label"
```

---

## Task 27: Seed data for QA

**Files:**

- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add a helper to create a condo-style org with 2 properties**

Open `prisma/seed.ts`. Add (after existing seed functions):

```typescript
async function seedCondoOwnership(
  prisma: PrismaClient,
  orgId: string,
  userIds: string[]
) {
  // 2 properties: Apt house + Parking lot
  const aptHouse = await prisma.organizationProperty.create({
    data: { organizationId: orgId, name: 'Apt house #13', address: '5th St.' },
  });
  const parkingLot = await prisma.organizationProperty.create({
    data: { organizationId: orgId, name: 'Parking lot', address: '5th St.' },
  });

  // 10 apartments summing to ~850 m²
  const aptSizes = [75, 100, 80, 80, 80, 85, 85, 85, 90, 90];
  const apts = [];
  for (let i = 0; i < aptSizes.length; i++) {
    apts.push(
      await prisma.propertyAsset.create({
        data: {
          propertyId: aptHouse.id,
          name: `Apt #${101 + i}`,
          size: aptSizes[i],
        },
      })
    );
  }

  // 20 parking spots of 12 m² each
  const spots = [];
  for (let i = 0; i < 20; i++) {
    spots.push(
      await prisma.propertyAsset.create({
        data: {
          propertyId: parkingLot.id,
          name: `Parking #${i + 1}`,
          size: 12,
        },
      })
    );
  }

  // Simple ownership: first user owns Apt #101 fully + Parking #1 fully,
  // second user owns Apt #102 (50%) + Parking #2 fully + Parking #3 (50%),
  // remaining users each own one apt.
  if (userIds.length >= 2) {
    await prisma.propertyAssetOwnership.create({
      data: { assetId: apts[0].id, userId: userIds[0], share: 1 },
    });
    await prisma.propertyAssetOwnership.create({
      data: { assetId: spots[0].id, userId: userIds[0], share: 1 },
    });

    await prisma.propertyAssetOwnership.create({
      data: { assetId: apts[1].id, userId: userIds[1], share: 0.5 },
    });
    await prisma.propertyAssetOwnership.create({
      data: { assetId: spots[1].id, userId: userIds[1], share: 1 },
    });
    await prisma.propertyAssetOwnership.create({
      data: { assetId: spots[2].id, userId: userIds[1], share: 0.5 },
    });
  }

  for (let i = 2; i < Math.min(userIds.length, 2 + (apts.length - 2)); i++) {
    await prisma.propertyAssetOwnership.create({
      data: { assetId: apts[i].id, userId: userIds[i], share: 1 },
    });
  }
}
```

- [ ] **Step 2: Call from the main seed function**

In the existing `main()` (or equivalent), after creating at least one org + users, invoke:

```typescript
await seedCondoOwnership(prisma, mainOrgId, [
  adminUser.id,
  memberOneUser.id,
  memberTwoUser.id,
]);
```

- [ ] **Step 3: Run seed**

```bash
yarn prisma db seed
```

Expected: no errors; `SELECT COUNT(*) FROM organization_properties WHERE organization_id='<orgId>';` returns 2.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): condo-style ownership data for QA"
```

---

## Final Verification

- [ ] **Run the full test suite**

```bash
yarn test
```

Expected: all tests pass.

- [ ] **Run type-check**

```bash
yarn tsc --noEmit
```

Expected: zero errors.

- [ ] **Run lint**

```bash
yarn lint
```

Expected: zero errors.

- [ ] **End-to-end manual QA (human pass)**

With a browser:

1. Login as a user with ownership in the seeded condo.
2. Create a new poll — confirm the Weight distribution picker is visible. Pick `By unit size` with both properties in scope, aggregation `Normalize per property`. Submit.
3. Open the poll → activate → take snapshot.
4. Open Participants page. Verify weights look sensible; non-owners are absent.
5. Switch type to `EQUAL`. Observe preview banner. Save. Verify all eligible members are present with weight 1.
6. Try to Save after a vote is cast (simulate by casting a vote): confirm the editor is disabled with a tooltip.
7. Open the Results page: verify the distribution-type label and property list render correctly in both `en` and `ru`.
