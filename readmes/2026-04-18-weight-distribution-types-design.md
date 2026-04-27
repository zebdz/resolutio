# Weight Distribution Types — Design

## Overview

Today, a poll snapshot assigns every participant a weight of `1.0` and an admin can edit weights one-by-one. This feature introduces **weight distribution types** and **property-based scope** so that organizations whose voting power is tied to asset ownership — e.g., a condominium where voting power follows unit count or unit area, and where a single org may contain several distinct buildings, parking lots, or other properties — can have initial weights and eligibility computed automatically. Admin manual override is preserved.

## Goals

- Let each poll declare how participant weights are computed
- Support three distribution types: equal (default), ownership by unit count, ownership by unit size
- Let each poll optionally scope to one or more of the organization's properties (e.g., "apartment house #13", "parking lot at 5th St."), filtering both eligibility and weight calculation
- Track ownership as bitemporal data (`effective_from` / `effective_until`) so ownership can evolve without losing history
- Let admins change type **or** property scope on the Participants page with a preview → Save / Cancel workflow
- Keep existing per-row manual weight overrides working
- Display type, selected properties, and weights consistently (raw value + percentage in brackets) on Participants and Poll Results pages

## Scope

### In scope (this PR)

- New tables:
  - `organization_properties`
  - `property_assets` (replaces the earlier `organization_assets` idea)
  - `property_asset_ownerships`
  - `poll_properties` (M:N junction between polls and properties)
  - `poll_eligible_members` (frozen ceiling captured at `snapshot_at`)
- Existing tables — changes:
  - `polls.distribution_type` new column (default `"EQUAL"`)
  - `polls.property_aggregation` new column (default `"RAW_SUM"`) — only relevant for multi-property ownership polls
  - `poll_participants.user_weight`, `participant_weight_history.old_weight` / `new_weight`, `votes.user_weight` — widen to `Decimal(15, 6)`
- Domain / application:
  - `TakeSnapshotUseCase` respects `distribution_type` and the poll's property scope
  - New `UpdatePollWeightConfigUseCase` (commits type and/or property changes)
  - New `PreviewPollWeightConfigUseCase` (read-only diff for the UI banner)
- Poll creation form:
  - Distribution-type picker (gated — see Visibility Rules)
  - Property multi-select (gated by the org having 2 or more properties)
- Participants Management page:
  - Distribution-type selector + property multi-select (both in the same preview/save flow)
- Poll Results page: read-only label for the distribution type and the selected properties
- Weight display: `raw (percentage)` format everywhere
- Seed data for QA via Prisma seed script

### Out of scope (follow-up PRs)

- Admin UI to create, edit, or archive `organization_properties`, `property_assets`, and `property_asset_ownerships`
- Ownership-change audit / history viewer UI
- `poll_eligible_members` is not manually editable; it is populated only by `TakeSnapshotUseCase`

### Hard requirements for the data-entry follow-up PR

- **Bulk CSV import** is required, not optional. A single property (condo, co-op, etc.) can easily have 500–1000+ units; manual one-by-one entry is not feasible. The import must support: property rows (name, address), asset rows (property, name, size), and ownership rows (asset → user → share). The UI must show a preview / diff before committing, and must validate: every asset has a strictly positive size; shares on a single asset sum ≤ 1; every asset belongs to a property that belongs to the importing org.
- Manual single-row editing UI is still required on top of bulk import, for ongoing changes (a sale, an inheritance split).

## Distribution Types

```
DistributionType =
  | "EQUAL"                      // default: weight = 1 for each eligible participant
  | "OWNERSHIP_UNIT_COUNT"       // size of each asset treated as 1
  | "OWNERSHIP_SIZE_WEIGHTED"    // uses asset.size
```

Default: `EQUAL`. All existing polls (before this PR ships) default to `EQUAL` with no property scope and continue to behave identically to today.

## Property Aggregation

An **orthogonal** setting that only matters for ownership polls whose scope contains two or more properties. It decides how per-asset contributions combine across properties.

```
PropertyAggregation =
  | "RAW_SUM"                    // default: add raw contributions; absolute size dominates
  | "NORMALIZE_PER_PROPERTY"     // normalize to [0, 1] within each property, then sum
```

Default: `"RAW_SUM"` — preserves straightforward additive behavior and matches orgs whose properties all share one unit system.

`"NORMALIZE_PER_PROPERTY"` is the right choice when properties use different unit systems (e.g., apartments in m², parking spots as counts) or when each property should carry equal governance weight regardless of absolute size.

Ignored under `EQUAL` (weight is always `1.0`). Ignored when the effective scope has 0 or 1 properties (the two strategies produce identical rankings; only absolute values differ).

## Key concepts

- **Property** — a physical real-estate entity belonging to an organization, e.g., "Apartment house #13", "Parking lot at 5th St.". One org can have many. Every asset belongs to exactly one property.
- **Asset** — a unit within a property, e.g., "Apt #42" (size = m²) or "Parking space #7" (size = 1 or m²). Ownership is recorded per asset.
- **Property scope of a poll** — a set of selected properties for the poll. Stored as rows in `poll_properties`. Empty set = no filter (all properties in the org apply). A non-empty set filters both eligibility and weight calculation to assets within those properties.
- **Eligible members (frozen at `snapshot_at`)** — every org / board member who was a member at the moment the snapshot was taken. Stored once per poll in `poll_eligible_members`. **Does not** include the property or ownership filter — it is just "who was a member of this org / board at this instant". Never changes after `snapshot_at`. This is the ceiling: no user outside this set can ever become a participant.
- **Participants (derived from the current weight config)** — the subset of eligible members currently in `poll_participants`, i.e., the users who can vote and whose weights count. This subset is recomputed when the admin changes the distribution type and/or the property scope.

Current-participant rule:

- Under `EQUAL` with no property scope: participants = all eligible members (weight `1.0`).
- Under `EQUAL` with a property scope: participants = eligible members who own at least one asset in the selected properties (weight `1.0`).
- Under an ownership mode with no property scope: participants = eligible members with positive weight computed across all assets in the org.
- Under an ownership mode with a property scope: participants = eligible members with positive weight computed across assets in the selected properties only.

## Weight Calculation

The formula depends on the combination of distribution type and property aggregation.

`share_{i,j}` ∈ `[0, 1]` — participant `i`'s fractional ownership of asset `j`.

`effective_size_j` depends on the distribution type:

- `EQUAL` → formula not used; every eligible participant is assigned weight `1.0` if they own at least one asset in scope (or, if no scope, simply by being an eligible member)
- `OWNERSHIP_UNIT_COUNT` → `1` for every asset
- `OWNERSHIP_SIZE_WEIGHTED` → `asset.size`

`j` ranges over:

- all non-archived assets of the org if the poll has no property scope, OR
- all non-archived assets belonging to the selected properties if a scope is set.

### Under `RAW_SUM` (default)

```
weight_i = Σ_j  share_{i,j} × effective_size_j
```

### Under `NORMALIZE_PER_PROPERTY`

For each in-scope property `p`, compute the per-property contribution:

```
contribution_i,p = (Σ_{j ∈ p}  share_{i,j} × effective_size_j) / (Σ_{j ∈ p}  effective_size_j)
```

Each property contributes at most `1.0` (when fully owned). Then:

```
weight_i = Σ_p  contribution_i,p
```

### Storage and display

Weights are stored raw (the output of whichever formula applies). Percentage is computed for display as `weight / Σ weights × 100`.

### Co-ownership rule (no double-counting)

A single asset's total contribution to the weight pool never exceeds its `effective_size`. If two participants each own 50 % of one apartment under `OWNERSHIP_UNIT_COUNT`, each receives weight `0.5` from that apartment — the apartment contributes `1.0` in total, not `2.0`.

### Mode comparison — worked example (single property)

Two apartments in one property: A (100 m²), B (50 m²). User X owns A fully; user Y owns B fully. Aggregation is irrelevant here — scope has one property.

| Mode                      | X weight | Y weight | X %     | Y %     |
| ------------------------- | -------- | -------- | ------- | ------- |
| `EQUAL`                   | 1.00     | 1.00     | 50.00 % | 50.00 % |
| `OWNERSHIP_UNIT_COUNT`    | 1.00     | 1.00     | 50.00 % | 50.00 % |
| `OWNERSHIP_SIZE_WEIGHTED` | 100.00   | 50.00    | 66.67 % | 33.33 % |

### Aggregation comparison — worked example (two properties)

Org has two properties:

- "Apt house #13" — total apt area `850 m²`; 10 apartments
- "Parking lot" — total area `240 m²`; 20 spots of `12 m²` each

Alice owns: Apt #101 (100% × 75), Apt #102 (50% × 100), Parking #5 (100% × 12), Parking #6 (100% × 12), Parking #7 (50% × 12).

Under `OWNERSHIP_SIZE_WEIGHTED` with both properties in scope:

| Aggregation              | Apt contribution    | Parking contribution | Alice's weight |
| ------------------------ | ------------------- | -------------------- | -------------- |
| `RAW_SUM`                | `75 + 50 = 125`     | `12 + 12 + 6 = 30`   | `155`          |
| `NORMALIZE_PER_PROPERTY` | `125 / 850 ≈ 0.147` | `30 / 240 = 0.125`   | `0.272`        |

`RAW_SUM` says the apartment portion contributes `≈ 4×` the parking portion (tracks the unit scale). `NORMALIZE_PER_PROPERTY` says both properties contribute roughly equally (`0.147` vs `0.125`), because each is normalized to its own property total before summing.

### Worked example — `OWNERSHIP_UNIT_COUNT` across two properties

Same org (apt house has 10 apts, parking lot has 20 spots). Alice owns **1 apartment (100%)** and **2 parking spots (100% each)**.

Under `OWNERSHIP_UNIT_COUNT` every asset counts as `1`:

| Aggregation              | Apt contribution | Parking contribution | Alice's weight |
| ------------------------ | ---------------- | -------------------- | -------------- |
| `RAW_SUM`                | `1 × 1 = 1`      | `1 + 1 = 2`          | **3**          |
| `NORMALIZE_PER_PROPERTY` | `1 / 10 = 0.10`  | `2 / 20 = 0.10`      | **0.20**       |

Under `RAW_SUM`, the parking lot's 2 spots outweigh the single apartment — an admin might not have intended that. Under `NORMALIZE_PER_PROPERTY`, each property contributes the same `0.10` share regardless of how many total assets it holds.

### Worked example — under-ownership (shares don't sum to 1)

Apt #42 (100 m²) under `OWNERSHIP_SIZE_WEIGHTED`, `RAW_SUM`.

- Alice 50%, Bob 25%, rest unowned.
- Alice weight = `0.5 × 100 = 50`
- Bob weight = `0.25 × 100 = 25`
- Apartment contributes `75` in total to the pool, not `100`. The unowned `25` is simply absent from voting power — no one votes for it.

Under `NORMALIZE_PER_PROPERTY` the denominator still uses the asset's full size, so Alice's share of the property is `50 / 100 = 0.5` (not `50 / 75`) — unowned shares dilute rather than disappear.

### Worked example — mixed co-ownership + sole ownership

Apt house with 2 apartments (Apt A: 100 m², Apt B: 60 m²). Three participants:

- Alice: 50% of Apt A, 100% of Apt B
- Bob: 50% of Apt A
- Carol: no ownership

Under `OWNERSHIP_SIZE_WEIGHTED`, `RAW_SUM` (scope = this one property):

| User  | Per-asset contributions          | Weight                            | % of poll |
| ----- | -------------------------------- | --------------------------------- | --------- |
| Alice | `0.5 × 100 + 1.0 × 60 = 50 + 60` | `110`                             | `68.75 %` |
| Bob   | `0.5 × 100 = 50`                 | `50`                              | `31.25 %` |
| Carol | —                                | excluded from `poll_participants` | —         |

Percentages are `weight / Σ weights × 100`, so `Σ weights = 110 + 50 = 160` (Apt A's 50 m² unowned half is absent from the pool). The property contributes `160 m²` out of its `160 m²` total, split between the two owners.

### Eligibility under ownership modes and / or property scope

A candidate becomes a participant only if:

- Under `EQUAL` + no scope: always (they are a member).
- Under `EQUAL` + scope: they own at least one asset in the selected properties.
- Under ownership mode + no scope: their computed weight (across all org assets) is `> 0`.
- Under ownership mode + scope: their computed weight (across selected-property assets) is `> 0`.

### Precision

- Widen `poll_participants.user_weight` from `Decimal(10, 2)` to `Decimal(15, 6)`
- Widen `participant_weight_history.old_weight` and `new_weight` to match
- Widen `votes.user_weight` to `Decimal(15, 6)` to stay consistent (votes copy the participant's weight at vote time)

### Display format

Weights are stored raw. A user-facing percentage is computed for display. The percentage can have one of three different denominators — each tells a different story — and the UI must pick the right one per context.

#### Three denominators

Given an in-scope asset pool, three useful totals:

- **Building total voting power (theoretical max)** — what Σ weights would be if every owner of every in-scope asset were a registered, voting org member. Depends on distribution type and aggregation (see next subsection).
- **Registered voting power** — Σ of `poll_participants.user_weight` at snapshot time. Excludes unregistered owners (their ownership is recorded but their `user_id` is null, so they never enter `poll_participants`).
- **Cast voting power** (per question) — Σ of `poll_participants.user_weight` for participants who actually submitted a vote on that question. Excludes abstentions (registered voters who skipped the question).

Three groups of users produce the three numbers:

1. **Unregistered owners** — own real assets, no user account. Excluded from registered voting power and from cast.
2. **Registered abstainers** — have accounts and are in `poll_participants`, but did not vote on the question. Included in registered voting power; excluded from cast.
3. **Registered voters** — cast a vote on the question. Included in all three.

#### Theoretical max per mode

The "theoretical max" is what a user's weight would be if they owned 100% of every in-scope asset, summed across all participants.

| Distribution mode         | Aggregation              | Theoretical max per voter (full ownership)                                      |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `EQUAL`                   | any                      | `1.0`                                                                           |
| `OWNERSHIP_UNIT_COUNT`    | `RAW_SUM`                | count of in-scope non-archived assets                                           |
| `OWNERSHIP_SIZE_WEIGHTED` | `RAW_SUM`                | Σ of in-scope non-archived asset sizes                                          |
| either ownership mode     | `NORMALIZE_PER_PROPERTY` | count of in-scope non-archived properties (each property contributes max `1.0`) |

Under `EQUAL`, every participant has weight `1.0`, so "building" and "registered" denominators are identical by construction (no non-voting ownership exists in the model) — the three-denominator framework collapses to two (registered and cast).

#### Raw format

- **Raw**: rounded to 2 decimal places (`toFixed(2)` at render time)
- **Percentage**: rounded to 2 decimal places
- Shown as `0.50 (12.50%)` — both parts always together
- Total-weight row shows the raw sum and `(100.00%)` _of whichever denominator the table uses_

#### Which denominator goes where

| Context                                                         | Denominator                    | Reason                                                                      |
| --------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Participants Management page — per-row weight                   | **Building**                   | Admin view; shows who owns what share of the total voting power             |
| Participants Management page — total-weight banner              | **Building**                   | Reveals registration gap — "Registered voting power: 595 of 850 m² (70%)"   |
| Poll Results page — per-voter weight (optional column)          | **Building**                   | Consistent with Participants page: each row is about a person's ownership   |
| Poll Results page — per-answer breakdown (main outcome display) | **Cast** on this question      | Standard poll-results semantics; the "Yes vs No" split is out of votes cast |
| Poll Results page — top banner                                  | All three, layered (see below) | Gives governance readers the full picture                                   |
| Anywhere else                                                   | **Cast**                       | Safe default for poll-results summaries                                     |

## Snapshot Semantics

### On TakeSnapshot (DRAFT → READY)

1. Load the poll with its `distribution_type` and current `poll_properties` scope.
2. Compute the candidate member set using existing scope logic (org-wide poll → all accepted org members; board poll → board members). **This set is independent of `distribution_type`, property scope, and ownership — it is purely "who is a member of this org / board right now".**
3. Insert one `PollEligibleMember` row per candidate — the frozen ceiling. This always includes every candidate, independent of any filter, so that later scope or type changes can grow or shrink the participant list freely within this ceiling.
4. Compute weights for the candidate set under the current config:
   - If `EQUAL` + no scope: weight `1.0` for every candidate.
   - If `EQUAL` + scope: weight `1.0` for each candidate who owns at least one in-scope asset.
   - If ownership mode: load current ownership (`effective_until IS NULL`) for non-archived assets within the current scope; run the unified formula; keep only candidates with positive weight.
5. Write `PollParticipant` rows for the weighted set from step 4.
6. Stamp `snapshot_at = NOW()` on all created rows.

All steps run in a single transaction.

### After TakeSnapshot — weight-config changes on the Participants page

Admin can change the distribution type, the property scope, or both, using the same preview/save flow.

- Uses **current** ownership data (`effective_until IS NULL`) — not ownership as-of-`snapshot_at`. The existing "no weight edit once votes are cast" rule prevents retroactive damage.
- `poll_eligible_members` is **immutable** after snapshot. The participant list can fluctuate within it but never exceed it.
- On change, the effective participant list is recomputed from `poll_eligible_members` under the new config:
  - Users eligible but not currently participants → inserted.
  - Users currently participants but not eligible under new config → deleted.
  - Users present before and after → weight updated.
- All manual per-participant overrides are **wiped** by the change; an admin who wants custom weights must first set the config and then adjust individuals.
- One `ParticipantWeightHistory` row is written per affected participant (added, removed, or reweighted), with `changed_by = admin` and a `reason` describing what changed (e.g., `"Distribution type changed to {type}"`, `"Property scope changed"`, or `"Weight config changed"` when both moved).

### Preview / Save workflow (Participants page)

The preview / save flow applies to any weight-config change (type, scope, or both).

- Changing the distribution-type dropdown **or** the property multi-select puts the UI into preview mode.
- Additional edits to the pending config (admin flips another property checkbox, or changes the type while still in preview) are folded into the same preview — only one preview session at a time.
- The UI shows: projected participant list with new weights, counts of added / removed / reweighted users, and **Save** / **Cancel** buttons.
- **Save** commits atomically (see `UpdatePollWeightConfigUseCase`).
- **Cancel** discards the preview and restores the persisted state.
- Individual per-row weight edits, remove, add (existing features) continue to commit immediately — unchanged.

## Database Schema

### Existing tables — changes

**`polls`** — add columns:

```prisma
distributionType     String  @default("EQUAL")    @map("distribution_type")
// "EQUAL" | "OWNERSHIP_UNIT_COUNT" | "OWNERSHIP_SIZE_WEIGHTED"

propertyAggregation  String  @default("RAW_SUM")  @map("property_aggregation")
// "RAW_SUM" | "NORMALIZE_PER_PROPERTY"
```

**`poll_participants.user_weight`** — widen:

```prisma
userWeight  Decimal  @default(1.0)  @map("user_weight")  @db.Decimal(15, 6)
```

**`participant_weight_history.old_weight` / `new_weight`** — widen to `Decimal(15, 6)`.

**`votes.user_weight`** — widen to `Decimal(15, 6)` (consistency; votes copy weight at vote time).

### New tables

**`organization_properties`**

| Column            | Type                 | Notes                                |
| ----------------- | -------------------- | ------------------------------------ |
| `id`              | UUID PK              |                                      |
| `organization_id` | FK → `organizations` |                                      |
| `name`            | string               | e.g., `"Apartment house #13"`        |
| `address`         | string?              | optional, free text                  |
| `created_at`      | timestamp            |                                      |
| `archived_at`     | timestamp?           | archive, never delete (project rule) |

Index on `organization_id`.

**`property_assets`**

| Column        | Type                           | Notes                                                                                                                                                                                                                               |
| ------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID PK                        |                                                                                                                                                                                                                                     |
| `property_id` | FK → `organization_properties` | organization derived via this FK                                                                                                                                                                                                    |
| `name`        | string                         | e.g., `"Apt #42"`                                                                                                                                                                                                                   |
| `size`        | `Decimal(15, 6)`               | `NOT NULL`, no default; domain invariant `size > 0`. Enforced both in the `PropertyAsset` entity constructor and by a `CHECK (size > 0)` database constraint. Used by `OWNERSHIP_SIZE_WEIGHTED`; ignored by `OWNERSHIP_UNIT_COUNT`. |
| `created_at`  | timestamp                      |                                                                                                                                                                                                                                     |
| `archived_at` | timestamp?                     | archive, never delete                                                                                                                                                                                                               |

Index on `property_id`.

**`property_asset_ownerships`**

| Column            | Type                   | Notes                        |
| ----------------- | ---------------------- | ---------------------------- |
| `id`              | UUID PK                |                              |
| `asset_id`        | FK → `property_assets` |                              |
| `user_id`         | FK → `users`           |                              |
| `share`           | `Decimal(9, 8)`        | `[0, 1]`                     |
| `effective_from`  | timestamp              |                              |
| `effective_until` | timestamp?             | `NULL` = currently effective |
| `created_at`      | timestamp              |                              |

Indexes:

- `(asset_id, effective_until)` — "current owners of this asset"
- `(user_id, effective_until)` — "assets currently owned by this user"

SCD-2 pattern: changing an ownership share creates a new row and sets the previous row's `effective_until = NOW()`.

**`poll_properties`**

M:N junction between polls and properties defining a poll's property scope.

| Column        | Type                           | Notes |
| ------------- | ------------------------------ | ----- |
| `poll_id`     | FK → `polls` (cascade)         |       |
| `property_id` | FK → `organization_properties` |       |

Composite PK `(poll_id, property_id)`. Index on `poll_id`. Empty rows for a given poll = "no property scope / all properties apply".

**`poll_eligible_members`**

Frozen ceiling of candidate members for the poll, captured at `snapshot_at`.

| Column        | Type                   | Notes                            |
| ------------- | ---------------------- | -------------------------------- |
| `id`          | UUID PK                |                                  |
| `poll_id`     | FK → `polls` (cascade) |                                  |
| `user_id`     | FK → `users`           |                                  |
| `snapshot_at` | timestamp              | matches the poll's snapshot time |
| `created_at`  | timestamp              |                                  |

Unique constraint `(poll_id, user_id)`. Index on `poll_id`.

### Current-ownership query (scoped to a poll's property set)

```sql
SELECT a.id AS asset_id, a.size, o.share
FROM   property_asset_ownerships o
JOIN   property_assets a ON a.id = o.asset_id
JOIN   organization_properties p ON p.id = a.property_id
WHERE  p.organization_id  = $1
  AND  o.user_id          = $2
  AND  a.archived_at      IS NULL
  AND  p.archived_at      IS NULL
  AND  o.effective_until  IS NULL
  AND  (
         -- no scope set (legacy or intentionally wide)
         NOT EXISTS (SELECT 1 FROM poll_properties pp WHERE pp.poll_id = $3)
         OR
         -- scope set: keep only assets in selected properties
         p.id IN (SELECT pp.property_id FROM poll_properties pp WHERE pp.poll_id = $3)
       );
```

(The actual use-case code will split this into two simpler queries — one branch per "scope set / not set" — to avoid Prisma raw-SQL fragility. This single form is here only to describe the semantics.)

## Architecture (DDD)

```
src/
  domain/
    organization/
      OrganizationProperty.ts                 — entity (id, orgId, name, address, archivedAt)
      OrganizationPropertyRepository.ts       — port
      PropertyAsset.ts                        — entity (id, propertyId, name, size, archivedAt)
      PropertyAssetOwnership.ts               — entity (id, assetId, userId, share, effectiveFrom, effectiveUntil)
      PropertyAssetRepository.ts              — port (reads assets + ownership)
    poll/
      DistributionType.ts                     — value object / enum
      PropertyAggregation.ts                  — value object / enum
      PollWeightConfig.ts                     — value object: { distributionType, propertyAggregation, propertyIds }
      PollEligibleMember.ts                   — entity
      PollEligibleMemberRepository.ts         — port
      WeightDistribution.ts                   — pure function: (candidates, assets-in-scope grouped by property, ownership, type, aggregation) → Map<userId, weight>
      WeightDistributionCodes.ts              — domain codes

  application/
    poll/
      TakeSnapshotUseCase.ts                  — existing, updated to write poll_eligible_members and respect weight config
      PreviewPollWeightConfigUseCase.ts       — new, read-only
      UpdatePollWeightConfigUseCase.ts        — new, preview + commit on Save (handles type, scope, or both)

  infrastructure/
    organization/
      PrismaOrganizationPropertyRepository.ts — implements the port
      PrismaPropertyAssetRepository.ts        — implements the port

  web/
    actions/poll/
      previewPollWeightConfig.ts              — server action; rate-limit + auth
      updatePollWeightConfig.ts               — server action; rate-limit + auth + translateErrorCode
    components/polls/
      participants/
        WeightConfigEditor.tsx                — dropdown + property multi-select + preview banner + Save / Cancel
        ParticipantManagement.tsx             — updated to host the editor
      results/
        WeightConfigLabel.tsx                 — read-only label on Results page (type + selected properties)
      create/
        (poll-creation form)                  — updated to add type picker and property multi-select (gated)
```

**Domain purity**: `WeightDistribution.ts` is pure — no DB, no I/O. It accepts in-memory arrays of candidates, in-scope assets, and ownership rows plus a distribution type, and returns a map. This lets us unit-test every mode, every scope combination, and every edge case exhaustively with no infrastructure.

## Use Cases

### `TakeSnapshotUseCase` (updated)

Input: `{ pollId, actingUserId }`

1. Load the poll with its `distribution_type` and `poll_properties`.
2. Compute the candidate member set (existing scope logic).
3. Insert one `PollEligibleMember` row per candidate — the frozen ceiling; always contains every candidate, independent of any filter.
4. Compute weights under the current config (see Weight Calculation).
5. Insert `PollParticipant` rows for candidates with positive weight (under `EQUAL`, that is every eligible candidate who meets the eligibility rule above).
6. Stamp `snapshot_at = NOW()` on all created rows.

All steps in a single transaction.

### `PreviewPollWeightConfigUseCase` (new, read-only)

Input: `{ pollId, newConfig: { distributionType?, propertyAggregation?, propertyIds? }, actingUserId }`

Any subset of `distributionType`, `propertyAggregation`, and `propertyIds` may be present. Missing fields fall back to the poll's current values.

Output:

```
{
  effectiveConfig: { distributionType, propertyAggregation, propertyIds },
  addedParticipants: Array<{ userId, userName, newWeight }>,
  removedParticipants: Array<{ userId, userName }>,
  reweightedParticipants: Array<{ userId, userName, oldWeight, newWeight }>,
  totalWeight: number
}
```

Guards:

- Admin / superadmin authorization
- No votes may have been cast on this poll (identical rule to `UpdatePollWeightConfigUseCase`, so preview and save reject identically and the UI cannot open a preview that would fail on save)

No writes. Reads `poll_eligible_members` as the ceiling, computes weights under the proposed config, diffs against the current `poll_participants`. Used by the UI preview banner.

### `UpdatePollWeightConfigUseCase` (new)

Input: `{ pollId, newConfig: { distributionType?, propertyAggregation?, propertyIds? }, adminUserId }`

Guards:

- Admin or superadmin for the poll's org
- No votes may have been cast on this poll (same rule as the existing manual-weight-edit guard in `UpdateParticipantWeightUseCase`). The check reuses the same repository predicate so both use cases stay in sync.
- If new mode is an ownership mode: the effective asset set (determined by the new property scope) must contain at least one non-archived asset with at least one currently-effective ownership row.

Steps (single transaction):

1. Load `poll_eligible_members` for the poll — the frozen ceiling.
2. Compute the new effective participant list via `WeightDistribution` within that ceiling, using the new config.
3. For users eligible but not currently participants: insert `PollParticipant` rows (history row per insert, `oldWeight = 0`, `newWeight = computed`).
4. For users currently participants but not eligible under the new config: delete their `PollParticipant` rows (history row per deletion, `oldWeight = current`, `newWeight = 0`).
5. For users present before and after: update `user_weight` (history row per change).
6. History rows use `changed_by = adminUserId` and a `reason` string reflecting which axis moved: `"Distribution type changed to {type}"`, `"Property scope changed"`, `"Property aggregation changed to {aggregation}"`, or `"Weight config changed"` when more than one axis changed.
7. Update `polls.distribution_type` if it changed.
8. Update `polls.property_aggregation` if it changed.
9. Replace `poll_properties` rows if the scope changed (delete + insert).

## UI

### Poll creation form

- New field group: **Weight configuration**
  - **Distribution type** (dropdown)
    - **Visibility**: shown if the creator currently has ownership in the org, OR if the creator is an org admin or superadmin (even without personal ownership). Hidden otherwise; the poll silently defaults to `EQUAL`.
    - Options: "Equal (1 per participant)", "By unit count", "By unit size".
    - Ownership-based options are disabled with a tooltip if the org has no ownership data yet.
  - **Property scope** (multi-select checkboxes)
    - **Visibility**: shown if the org has 2 or more non-archived properties. Hidden otherwise (no meaningful choice); the poll silently defaults to empty scope (= all).
    - Default state: all properties checked (stored as empty `poll_properties`, meaning "no filter"). When all are checked, future new properties will also apply.
    - If the admin unchecks some, the explicit list is stored.
  - **Property aggregation** (radio group: `Raw sum` / `Normalize per property`)
    - **Visibility**: shown only when the distribution type is an ownership mode AND the effective scope contains 2 or more properties (i.e., the choice has a visible effect). Hidden otherwise; default `RAW_SUM`.
    - Tooltip next to the field explains the trade-off with the 2-property example from this spec.

### Participants Management page

- New toolbar above the participants table hosting the `WeightConfigEditor`:
  - Distribution-type selector
  - Property multi-select (shown if org has 2+ properties)
  - Property-aggregation radio group (shown only when the current type is an ownership mode AND the effective scope contains 2+ properties)
  - When any control changes, enters preview mode — renders a banner above the table:
    - Counts of `N added`, `N removed`, `N reweighted`
    - **Save** (primary) and **Cancel** buttons
  - **Disabled state**: if any vote has been cast on the poll, the entire editor is disabled with a tooltip (same rule and signal as the existing "Edit Weight" per-row button — re-use the same server-supplied flag so they stay in sync).
- Existing per-row edit / remove / history features remain in place
- Weight column renders as `raw (percentage)` using the **building** denominator. Under `EQUAL` this is equivalent to "% of eligible voters" (ownership plays no role).
- Total row renders as `Σ (X.XX%)` where `X.XX%` is the registered voting power as a fraction of the building total. When all eligible members are registered, it's `100.00%`. When some owners are unregistered, it's less — revealing the registration gap to the admin at a glance.

### Poll Results page

Three display zones, each using a specific denominator (see "Display format — Which denominator goes where").

**Top: read-only weight-config label.** Visible to all participants.

- `Weight distribution: Equal` / `By unit count` / `By unit size`
- `Properties: <comma-separated names>` (or omitted if no scope is set)
- `Aggregation: Raw sum` / `Normalize per property` — shown only when the type is an ownership mode AND the effective scope contains 2+ properties

**Participation banner.** Immediately under the weight-config label. Shows the three denominators layered so governance readers can assess quorum and engagement in one glance.

| Row                         | Value              | % of building |
| --------------------------- | ------------------ | ------------- |
| Building total voting power | `850 m²` (example) | `100%`        |
| Registered voting power     | `595`              | `70%`         |
| Voted on this question      | `340`              | `40%`         |

(For multi-question polls, the "Voted on this question" row appears inside each question's block — participation may vary per question.)

Under `EQUAL`, the "Building" and "Registered" rows collapse into a single "Eligible voters" row (no ownership-based max exists).

**Per-answer breakdown.** Standard poll-results display.

- For each answer: total weight cast for it, plus `%` of cast votes.
- Optional secondary line beneath each answer: `% of building` (same numerator, different denominator) for readers who want the governance view. Toggleable with a control above the table.

**Per-voter weight column (if shown).**

- Uses the `raw (percentage)` format where the percentage denominator is **building** (consistent with the Participants page).
- Adds a "Vote" column showing the participant's choice on this question, or `—` for abstainers.

### Visibility rules — recap

| Context                                                     | Type selector   | Property multi-select          | Aggregation radio                     | Notes                                        |
| ----------------------------------------------------------- | --------------- | ------------------------------ | ------------------------------------- | -------------------------------------------- |
| Poll creation, creator has ownership                        | Shown           | Shown if org has 2+ properties | Shown if ownership mode + 2+ in scope |                                              |
| Poll creation, creator is org admin or superadmin           | Shown           | Shown if org has 2+ properties | Shown if ownership mode + 2+ in scope | Even without personal ownership              |
| Poll creation, creator has no ownership and is not an admin | Hidden          | Hidden                         | Hidden                                | Defaults: `EQUAL`, no scope, `RAW_SUM`       |
| Participants page (admin-only route)                        | Shown           | Shown if org has 2+ properties | Shown if ownership mode + 2+ in scope | Regardless of the admin's personal ownership |
| Poll Results (all participants)                             | Read-only label | Read-only label                | Read-only label when relevant         | Never a selector                             |

## Localization

Add keys to `messages/en.json` and `messages/ru.json` under `poll`:

- `poll.distribution.label` — "Weight distribution"
- `poll.distribution.type.equal` — "Equal (1 per participant)"
- `poll.distribution.type.ownershipUnitCount` — "By unit count"
- `poll.distribution.type.ownershipSizeWeighted` — "By unit size"
- `poll.distribution.ownershipOptionDisabledTooltip` — "Organization has no ownership data configured"
- `poll.propertyScope.label` — "Properties"
- `poll.propertyScope.allByDefault` — "(all properties)"
- `poll.propertyScope.empty` — "No properties selected"
- `poll.aggregation.label` — "Property aggregation"
- `poll.aggregation.rawSum` — "Raw sum"
- `poll.aggregation.normalizePerProperty` — "Normalize per property"
- `poll.aggregation.tooltip` — short explanation of the trade-off
- `poll.weightConfig.preview.added` — `"{count, plural, one {# participant will be added} other {# participants will be added}}"`
- `poll.weightConfig.preview.removed` — `"{count, plural, one {# participant will be removed} other {# participants will be removed}}"`
- `poll.weightConfig.preview.reweighted` — `"{count, plural, one {# participant will be reweighted} other {# participants will be reweighted}}"`
- `poll.weightConfig.preview.save` — "Save"
- `poll.weightConfig.preview.cancel` — "Cancel"
- `poll.weightConfig.changeReason.distributionType` — "Distribution type changed to {type}"
- `poll.weightConfig.changeReason.propertyScope` — "Property scope changed"
- `poll.weightConfig.changeReason.propertyAggregation` — "Property aggregation changed to {aggregation}"
- `poll.weightConfig.changeReason.combined` — "Weight config changed"
- `poll.results.distributionTypeLabel` — "Weight distribution: {type}"
- `poll.results.propertiesLabel` — "Properties: {names}"
- `poll.results.aggregationLabel` — "Aggregation: {aggregation}"

Error codes:

- `domain.poll.distributionTypeInvalid`
- `domain.poll.ownershipDataMissing`
- `domain.poll.propertyNotInOrg`
- `domain.poll.votesCastCannotChangeWeightConfig`
- `domain.organization.propertyAssetSizeNonPositive` — raised by the `PropertyAsset` constructor if `size <= 0`
- `poll.errors.cannotChangeWeightConfig`

Translated through the shared `translateErrorCode` helper (per project conventions).

## Security & Permissions

- `UpdatePollWeightConfigUseCase` and `PreviewPollWeightConfigUseCase`: superadmin or the poll's org admin only.
- Raw ownership shares (`property_asset_ownerships.share`) never reach non-admin clients; the Results page shows computed weights only.
- Property names / addresses — admins can always see them (they manage polls). Non-admin participants see only the names of properties the poll is scoped to (on the Results page label).
- All server actions begin with `checkRateLimit()` (project convention).

## Testing (TDD)

Unit tests — domain (fast, exhaustive):

- `WeightDistribution` — all three distribution types × { no scope, scope present } × { `RAW_SUM`, `NORMALIZE_PER_PROPERTY` }
  - Full-ownership, partial-ownership, co-ownership (shares sum to 1), under-ownership (shares sum to < 1)
  - Zero-ownership candidates filtered out (ownership modes)
  - Varying asset sizes for `OWNERSHIP_SIZE_WEIGHTED`
  - Property scope correctly limits the asset pool
  - Multi-property scenarios: both aggregations yield the documented Alice example values to the expected precision
  - Single-property scope: both aggregations produce identical rankings (differ only by a scaling factor)
- `PropertyAsset` constructor — rejects `size <= 0` with `propertyAssetSizeNonPositive`
- `DistributionType` — parse valid values, reject invalid
- `PropertyAggregation` — parse valid values, reject invalid
- `PollWeightConfig` — equality, partial-update merging

Use-case tests:

- `TakeSnapshotUseCase` — all three modes × scope / no-scope produce correct lists and weights; writes `poll_eligible_members` with the full candidate set regardless of mode or scope
- `UpdatePollWeightConfigUseCase` — wipes overrides; writes history rows (added / removed / reweighted); correctly handles type-only, scope-only, and combined changes; resurrects zero-weight users when switching to a wider config (e.g., `EQUAL` with no scope); **rejects when even one vote has been cast** (dedicated test — a distinct use case from `UpdateParticipantWeightUseCase`, so its own coverage is required even though the predicate is shared)
- `PreviewPollWeightConfigUseCase` — diff is correct for each axis individually and in combination; verifies no writes; **also rejects when votes have been cast** so the UI cannot open a preview that would fail on save

Server-action tests:

- Rate-limit wiring
- Authorization guards
- Error codes translated via `translateErrorCode`

Per project convention: no integration tests.

## Migration Ordering

1. Create `organization_properties`
2. Create `property_assets`
3. Create `property_asset_ownerships`
4. Create `poll_properties`
5. Create `poll_eligible_members`
6. Backfill `poll_eligible_members` for existing polls by copying current `poll_participants` rows (legacy polls were all EQUAL, so the eligible set equals the current participant set)
7. Widen `poll_participants.user_weight` to `Decimal(15, 6)`
8. Widen `participant_weight_history.old_weight` / `new_weight` to `Decimal(15, 6)`
9. Widen `votes.user_weight` to `Decimal(15, 6)`
10. Add `polls.distribution_type` with default `"EQUAL"`
11. Add `polls.property_aggregation` with default `"RAW_SUM"`

All steps are backwards-compatible. Existing polls default to `EQUAL` with no property scope, `RAW_SUM` aggregation and — after the backfill — continue to behave as today.

## Rollout

No feature flag. New columns default to `EQUAL` and `RAW_SUM`, new ownership / property tables start empty, `poll_properties` starts empty for every poll — UI silently stays in its current behavior everywhere until an org is seeded with properties, assets, and ownership data.

## Open questions

None at the time of writing — all key decisions resolved during brainstorming.

## Implementation deltas from the initial build

The initial 27-task implementation landed before the "three denominators" framework was spec'd. Known gaps to address in a follow-up task (ideally alongside the property-admin PR, since that's when unregistered ownership first appears in the data):

- `formatWeightAndPercent` currently uses `Σ weights` (cast) as the denominator. Needs to be refactored to accept an explicit denominator (building / registered / cast) so call sites can pick the right one.
- Participants Management page currently shows `% of cast`. Needs to switch to `% of building` + add the "registered voting power" row to the total banner.
- Poll Results page currently has a single `WeightConfigLabel` at top. Needs the layered participation banner (building / registered / voted-on-this-question) and the optional `% of building` secondary line per answer.
- Unregistered owners (`user_id` nullable + `external_owner_label`) don't exist in the schema yet — that schema change ships with the property-admin PR, and makes the "registered ≠ building" distinction meaningful for the first time.
