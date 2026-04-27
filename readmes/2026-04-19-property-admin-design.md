# Property Admin — Design

## Overview

The Weight Distribution Types feature (see `2026-04-18-weight-distribution-types-design.md`) introduced three tables — `organization_properties`, `property_assets`, `property_asset_ownerships` — with no admin UI and no data-entry path. This feature provides:

1. **Admin CRUD** for properties, assets, and ownership (per-row editing — bulk CSV import is deferred).
2. **A user-facing "claim" flow** so members can claim ownership of assets recorded against placeholder `external_owner_label` rows, with admin approval.
3. **Schema refinements** to support the above: nullable `user_id` on ownership rows, a new `external_owner_label`, `size_unit` on properties, a new `property_claims` table.

## Goals

- Let org admins set up and maintain property/asset/ownership data manually, without needing to touch the DB directly.
- Keep the "current ownership" query semantics simple: every asset's shares always sum to exactly 1.0 when there is ownership data.
- Preserve real-world ownership history (SCD-2) while still allowing corrections during a pre-voting setup window (SCD-1 for typos).
- Let members claim their property themselves; admins only verify and approve.
- Never leak confidential information (`user_id`, `external_owner_label`, shares) to members through the claim UI.
- Reuse existing patterns: notifications, profanity checking, `@@map` naming, server-action structure, rate limiting, localization.

## Scope

### In scope (this PR)

- Schema changes:
  - `property_asset_ownerships.user_id` becomes nullable; add `external_owner_label`; domain + DB CHECK enforce exactly one is set.
  - `organization_properties.size_unit` new required column (enum, no default).
  - New table `property_claims`.
- Domain / application:
  - New entity `PropertyClaim` (approve / deny state transitions; profanity check on denial reason).
  - New value object `SizeUnit`.
  - Extend `OrganizationProperty`, `PropertyAsset`, `PropertyAssetOwnership` with write methods (create, update, archive, unarchive, link/correct).
  - New service `PropertyLockService`.
  - New use cases: property CRUD, asset CRUD, ownership batch edit + correct, claim submit / approve / deny + auto-deny on archive.
  - Projection-safe read use cases: `ListOrgPropertiesForMemberUseCase`, `ListClaimableAssetsUseCase`.
- Infrastructure: extend existing Prisma repos; new `PrismaPropertyClaimRepository`, `PrismaPropertyLockRepository`.
- Web:
  - Admin pages: `manage-properties`, `manage-ownership`, `property-claims`.
  - Member page: per-property claim page.
  - Modifications: org detail page gains a "Properties" section (server-side gated); home-page org cards gain a "Claim property" shortcut.
  - Server actions under `web/actions/organization/property.ts` and `web/actions/organization/propertyClaim.ts`.
- Localization: `propertyAdmin.*`, `propertyClaim.*` keys in `en.json` + `ru.json`.

### Out of scope (deferred to follow-up PR)

- Bulk CSV import (condo-scale onboarding).
- "% of building" / participation-banner UI on Results + Participants pages (see "Implementation deltas" in the weight-distribution spec — this PR ships the schema change that enables the distinction, but not the UI wiring).
- Property / asset metadata audit trail (rename history).

## Key concepts

- **Property**: physical real-estate entity belonging to an org (building, parking lot, etc.). Has a single `size_unit` that applies to all its assets.
- **Asset**: unit within a property (apartment, parking spot, storage cellar). Has a size expressed in the property's `size_unit`.
- **Ownership row**: one SCD-2-style record saying "user U (or unregistered owner labeled L) owns share S of asset A during window [from, until]".
- **Claim**: a user's self-declared request to be linked as the owner of an asset that currently has an `external_owner_label` placeholder. Goes through admin approval.
- **Property lock**: per-property state — locked once any poll's snapshot has used this property's ownership data. Unlocked properties allow SCD-1 "corrections" on ownership; locked ones force SCD-2 "end and replace".

## Schema changes

### Existing tables — changes

**`property_asset_ownerships`**:

```prisma
model PropertyAssetOwnership {
  id                  String    @id @default(cuid())
  assetId             String    @map("asset_id")
  userId              String?   @map("user_id")           // WAS required, NOW nullable
  externalOwnerLabel  String?   @map("external_owner_label")
  share               Decimal   @db.Decimal(9, 8)
  effectiveFrom       DateTime  @default(now()) @map("effective_from")
  effectiveUntil      DateTime? @map("effective_until")
  createdAt           DateTime  @default(now()) @map("created_at")

  asset PropertyAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  user  User?         @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([assetId, effectiveUntil])
  @@index([userId, effectiveUntil])
  @@map("property_asset_ownerships")
}
```

DB-level CHECK constraint: `(user_id IS NOT NULL)::int + (external_owner_label IS NOT NULL)::int = 1` — exactly one set.

Domain-layer invariant enforced in entity constructor identically.

**`organization_properties`**: add `size_unit`.

```prisma
model OrganizationProperty {
  // ...existing columns...
  sizeUnit String @map("size_unit")
}
```

Required column, no default. Migration backfills `SQUARE_METERS` for any pre-existing rows (the seeded condo demo is m²-based).

### New table

**`property_claims`**:

```prisma
model PropertyClaim {
  id             String    @id @default(cuid())
  organizationId String    @map("organization_id")
  userId         String    @map("user_id")
  assetId        String    @map("asset_id")
  status         String    // 'PENDING' | 'APPROVED' | 'DENIED'
  deniedReason   String?   @map("denied_reason")
  decidedBy      String?   @map("decided_by")
  decidedAt      DateTime? @map("decided_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User          @relation("PropertyClaimUser", fields: [userId], references: [id], onDelete: Cascade)
  asset        PropertyAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  decidedByUser User?        @relation("PropertyClaimDecidedBy", fields: [decidedBy], references: [id])

  @@index([organizationId, status])
  @@index([userId])
  @@index([assetId])
  @@map("property_claims")
}
```

## Architecture (DDD)

```
src/
  domain/
    organization/
      OrganizationProperty.ts         — entity; add sizeUnit field + update methods
      PropertyAsset.ts                — entity; add update / archive methods
      PropertyAssetOwnership.ts       — entity; nullable userId, externalOwnerLabel, link(), correct()
      PropertyClaim.ts                — new entity
      SizeUnit.ts                     — new value object + parse + localization key helper
      PropertyLockService.ts          — new service (pure, no DB): given a property's id and a queryable set of snapshots, returns locked-state
      OrganizationPropertyRepository.ts  — extended: create / update / archive / unarchive
      PropertyAssetRepository.ts         — extended: create / update / archive / unarchive; replaceOwners (atomic)
      PropertyClaimRepository.ts         — new
      PropertyLockRepository.ts          — new: returns "is property P locked?"

  application/
    organization/
      CreatePropertyUseCase.ts
      UpdatePropertyUseCase.ts
      ArchivePropertyUseCase.ts
      UnarchivePropertyUseCase.ts
      CreateAssetUseCase.ts
      UpdateAssetUseCase.ts
      ArchiveAssetUseCase.ts
      UnarchiveAssetUseCase.ts
      ReplaceAssetOwnersUseCase.ts   — batch SCD-2 replace (the modal's Save action)
      CorrectOwnershipUseCase.ts     — SCD-1 correction (unlocked only)
      SubmitPropertyClaimUseCase.ts
      ApprovePropertyClaimUseCase.ts — links user; auto-denies siblings on same asset
      DenyPropertyClaimUseCase.ts    — requires reason; profanity-checked
      AutoDenyPendingClaimsOnArchiveUseCase.ts  — called from archive cascades
      ListOrgPropertiesForMemberUseCase.ts      — rejects non-members; returns { id, name, address }[]
      ListClaimableAssetsUseCase.ts             — scope = propertyId; returns { id, name }[]

  infrastructure/
    repositories/
      PrismaOrganizationPropertyRepository.ts   — add write ops
      PrismaPropertyAssetRepository.ts          — add write ops; atomic replaceOwners
      PrismaPropertyClaimRepository.ts          — new
      PrismaPropertyLockRepository.ts           — new: queries poll_eligible_members + poll_properties + polls.distribution_type

  web/
    actions/
      organization/
        property.ts                  — CRUD + ownership server actions
        propertyClaim.ts             — submit / approve / deny server actions
    components/
      property/
        admin/
          ManagePropertiesPage.tsx   — adaptive layout (0 / 1 / 2+ properties)
          PropertyPicker.tsx         — tabs ≤5, Select 6+
          PropertyEditorInline.tsx   — inline name/address/unit edit
          AssetsTable.tsx            — rows + edit/archive/add
          EditOwnersModal.tsx        — batch ownership editor (Save disabled until sum=1)
          ManageOwnershipPage.tsx    — flat cross-property ownership table
          PendingClaimsQueue.tsx     — approve/deny UI
        member/
          PropertiesSection.tsx      — org-page's Properties section for members
          ClaimAssetsPage.tsx        — per-property claim UI
          MyClaimsSection.tsx        — user's own claims for the property
```

## Domain rules

### Ownership row invariants

- Exactly one of `userId` or `externalOwnerLabel` is set.
- `share ∈ [0, 1]` (existing).
- Per asset: `Σ share for rows where effectiveUntil IS NULL` = 1.0 (domain-enforced through `ReplaceAssetOwnersUseCase`, which refuses to commit a non-unit sum; checked against Decimal arithmetic with rounding tolerance of 1e-6 for DB-float idiosyncrasies).

### Ownership edit modes

| Mode                          | When available                                                                      | Schema effect                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| "End and replace" (SCD-2)     | Always                                                                              | Old row: `effective_until = NOW()`. New row(s) inserted with fresh `effective_from`.                                                        |
| "Correct" (SCD-1)             | Only while property is unlocked AND the row has never been referenced by a snapshot | In-place update of share on an active row. Profanity-checked reason required.                                                               |
| Link-claim (SCD-1 restricted) | Always (even on locked properties)                                                  | In-place: `user_id` filled, `external_owner_label` cleared. Share and effective window unchanged — only the owner's representation changes. |

### Property lock

`PropertyLockService.isLocked(propertyId)` returns `true` iff:

- `EXISTS a poll whose explicit scope includes propertyId AND the poll has a row in poll_eligible_members`, OR
- `EXISTS a poll with empty scope AND the poll is ownership-based AND the poll has a row in poll_eligible_members`, OR
- `EXISTS a poll whose explicit scope includes propertyId AND the poll is EQUAL-mode`.

The logic boils down to: any past snapshot whose weight or eligibility calc depended on this property's ownership data. Implemented by joining `polls ⨝ poll_properties ⨝ poll_eligible_members` in `PrismaPropertyLockRepository`.

### Property / asset archive

- Archive property → cascade archive its non-archived assets. `archived_at` only; ownership rows untouched.
- Archive asset → `archived_at` only; ownership rows untouched.
- Unarchive → clear `archived_at`. Ownership is immediately effective again (existing "current ownership" query filters on both `archived_at` and `effective_until`).
- On any archive: call `AutoDenyPendingClaimsOnArchiveUseCase` to deny pending claims with a system-generated reason.
- Warn (do not block) if the archive target is in scope of a non-finished poll.

### Claim flow state machine

```
PENDING ──(admin approves)──▶ APPROVED
   │                             │
   │                             └─▶ side-effect: fill user_id on the ownership row,
   │                                 clear external_owner_label; auto-deny sibling
   │                                 pending claims on the same asset.
   │
   ├─(admin denies w/ reason)──▶ DENIED
   │                             └─▶ side-effect: notification to claimant.
   │
   └─(system auto-denies)──────▶ DENIED
                                 - asset/property archived
                                 - sibling claim approved
                                 - claimant left org
```

Re-claims by the same user on the same asset are blocked within 24h of the last decision; allowed after.

Duplicate pending claims on the same asset by different users are not allowed — the second attempt is rejected up front.

### Size units

Enum `SizeUnit`:

- `SQUARE_METERS`
- `SQUARE_FEET`
- `HECTARES`
- `ACRES`
- `CUBIC_METERS`
- `LINEAR_METERS`
- `UNIT_COUNT`
- `SHARES`

Stored as a string column (`size_unit`). Parsing is done via `SizeUnit.parse(value): Result<SizeUnit, string>`. Display via `useTranslations('propertyAdmin.sizeUnit')[enum]`.

`OWNERSHIP_SIZE_WEIGHTED` math is unit-agnostic — the unit only affects display — but the invariant "all assets in a property share one unit" prevents accidentally mixing area with count within a property.

## Security rules

Per the project's Security checklist:

1. **Org-page "Properties" section**: the server component checks membership / admin status BEFORE fetching property data. Non-members cause the data query to be skipped entirely. The section is absent from the rendered HTML for them.
2. **`ListOrgPropertiesForMemberUseCase`**: server-only use case. Rejects non-member callers with `PollErrors.NOT_AUTHORIZED` (or the organization equivalent). Returns `{ id, name, address }[]` — no asset / ownership / member data.
3. **`ListClaimableAssetsUseCase`**: returns `{ id, name }[]` only for non-archived assets within the given property whose currently-effective ownership row has `user_id IS NULL`. **Never** includes `user_id` (null here but protected anyway), `external_owner_label`, or `share`. Server action + use case enforce this projection; the Client Component receives only the safe shape.
4. **Pending-claims admin queue**: admin-only route. Response CAN include `external_owner_label` because the admin is authorized.
5. **Rate limiting**: every server action starts with `checkRateLimit()` (project convention). Submit-claim has additional per-user per-asset cooldown (24h after denial).
6. **Profanity checking**: claim denial reason and ownership correction reason both pass through the existing `ProfanityChecker`.

## Localization

Add keys under `propertyAdmin.*` and `propertyClaim.*` in `messages/en.json` and `messages/ru.json`.

Selected highlights:

- `propertyAdmin.sizeUnit.squareMeters` — "m²" / "м²"
- `propertyAdmin.sizeUnit.unitCount` — "units" / "шт."
- `propertyAdmin.editOwners.totalInvalid` — "Total 105% — adjust to 100%"
- `propertyClaim.submit.success` — "Claim submitted. An admin will review."
- `propertyClaim.deny.reasonRequired` — "Denial reason is required."
- `propertyClaim.banner.alreadyClaimed` — "This asset is already under review for another claim."
- `propertyClaim.status.pending` / `.approved` / `.denied`

Error codes added to `OrganizationDomainCodes`:

- `domain.organization.sharesDoNotSumToOne`
- `domain.organization.ownerRepresentationInvalid` (both or neither user_id / label)
- `domain.organization.cannotCorrectLockedProperty`
- `domain.organization.sizeUnitInvalid`
- `domain.organization.propertyClaimDenialReasonEmpty`
- `domain.organization.propertyClaimAlreadyPendingForAsset`
- `domain.organization.propertyClaimRepeatBlockedWithin24h`

## Notifications

Three new notification types (reusing the existing `Notification` infrastructure):

- `PROPERTY_CLAIM_SUBMITTED` → sent to every org admin when a claim is submitted. Body interpolates claimant, asset, property.
- `PROPERTY_CLAIM_APPROVED` → sent to the claimant on approval.
- `PROPERTY_CLAIM_DENIED` → sent to the claimant on denial; includes reason.

## Testing

Domain unit tests (pure, exhaustive):

- `PropertyAssetOwnership` — nullable userId invariant, share range, `link()`, `correct()`.
- `PropertyClaim` state machine, denial-reason profanity check.
- `SizeUnit` parse + all enum values.
- `OrganizationProperty` with `sizeUnit`.
- `PropertyLockService` — all lock-triggering scenarios.

Use-case tests:

- Each CRUD use case — success + authorization failure + invariant violation.
- `ReplaceAssetOwnersUseCase` — rejects sum ≠ 1; commits atomically; writes history rows; refuses "correct" semantics, always SCD-2.
- `CorrectOwnershipUseCase` — rejected on locked property; only for active rows.
- `ApprovePropertyClaimUseCase` — fills `user_id`, clears label, auto-denies siblings, sends notification.
- `DenyPropertyClaimUseCase` — profanity-checked, sends notification.
- `ListClaimableAssetsUseCase` — **explicitly asserts the response shape is `{ id, name }[]`**; other fields are rejected at compile time and runtime.
- `ListOrgPropertiesForMemberUseCase` — same projection check; rejects non-member callers.
- Archive cascades — ownership untouched; pending claims auto-denied.

Server-action tests:

- Rate-limit wiring.
- Authorization guards.
- Error codes translated via `translateErrorCode`.

Per project convention: no integration tests.

## Migration ordering

1. Alter `property_asset_ownerships`: `user_id` → nullable; add `external_owner_label`; add CHECK `(user_id IS NOT NULL)::int + (external_owner_label IS NOT NULL)::int = 1` (only applies when one of them is set — i.e., for any row).
2. Add `size_unit` to `organization_properties`. Backfill `SQUARE_METERS` for existing rows. After backfill, set NOT NULL.
3. Create `property_claims` table with indexes.

All steps are backwards-compatible with the live data (condo demo seed is m²-based; no existing rows need a different unit).

## Rollout

No feature flag. New tables / columns default to empty state. Existing ownership rows have `user_id` set (the feature only newly-allows null), `external_owner_label` null — CHECK is satisfied.

The claim flow is invisible to users until an admin creates ownership rows with `external_owner_label`. The admin UI is the gating factor — until it ships, the claim flow has no data to show.

## Open questions

None at the time of writing — decisions captured in `/home/sergei/.claude/plans/calm-juggling-matsumoto.md` during brainstorming.
