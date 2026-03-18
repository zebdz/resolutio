# Multi-Tree Membership Setting

## Problem

When two org trees merge (org A becomes child of org B), users who are members of orgs in both trees end up with multiple memberships in the same hierarchy — violating the single-membership-per-tree rule. Currently `HandleJoinParentRequestUseCase` does not check for this.

## Solution

Per-root org setting `allowMultiTreeMembership` (default `false`) that controls whether users can hold memberships in multiple orgs within the same hierarchy tree.

## Data Model

### Prisma schema

Add to `Organization` model:

```prisma
allowMultiTreeMembership Boolean? @default(false) @map("allow_multi_tree_membership")
```

- Root orgs (`parentId = null`): `false` by default
- Child orgs: `NULL` (inherited from root)
- When org becomes a child (gets parentId): set to `NULL`
- When org becomes a root (parentId removed): set to `false`

### Domain model

Add `allowMultiTreeMembership: boolean | null` to `Organization` props, `create()`, `reconstitute()`, `toJSON()`.

### Repository

New method: `getRootAllowMultiTreeMembership(orgId: string): Promise<boolean>` — walks ancestors to root, returns the root's value. If root's value is `NULL` (data corruption), treat as `false`.

### Migration

Explicit migration required:

- Set `allow_multi_tree_membership = false` for all existing orgs where `parent_id IS NULL`
- Set `allow_multi_tree_membership = NULL` for all existing orgs where `parent_id IS NOT NULL`
- Do NOT rely on Prisma's `@default(false)` which would set all rows to `false`

## Business Logic

### 1. `HandleJoinParentRequestUseCase` — accept path

Before `setParentId`, within a **database transaction**:

1. Get accepted member userIds of child tree (child + descendants), **including archived orgs**
2. Get accepted member userIds of parent tree, **including archived orgs**
3. Compute intersection
4. If empty → proceed
5. If non-empty:
   - Get `getRootAllowMultiTreeMembership()` for both trees
   - Both `true` → proceed
   - Either `false` → `failure(MULTI_MEMBERSHIP_CONFLICT)`
6. Set child org's `allowMultiTreeMembership = NULL`
7. `setParentId` on child org

The overlap check + setParentId must be atomic (transaction with appropriate locking) to prevent race conditions where a user joins one of the trees between the check and the merge.

Check is performed at accept-time — pending join-parent requests are not re-evaluated when settings change.

### 2. `HandleJoinRequestUseCase` — accept path

Before calling `OrganizationMembershipService.removeUserFromHierarchyOrgs()`:

- `getRootAllowMultiTreeMembership(organizationId)`
- If `true` → skip removal
- If `false` → keep current behavior

### 3. `HandleInviteUseCase` — accept path (member_invite)

Same logic as `HandleJoinRequestUseCase`: check `getRootAllowMultiTreeMembership()` before calling `OrganizationMembershipService.removeUserFromHierarchyOrgs()`. If `true` → skip removal.

### 4. `JoinOrganizationUseCase` — hierarchy blocking

Currently blocks join requests if user has a pending request anywhere in the same hierarchy tree. When `getRootAllowMultiTreeMembership()` returns `true`, relax this check — allow pending requests in multiple orgs within the same tree.

### 5. `UpdateOrganizationUseCase` — toggle setting

- Only root orgs (`parentId === null`) can modify. Otherwise → `NOT_ROOT_ORG`
- `true → false`: check for users with multiple memberships in tree (**including archived orgs**). If any → `MULTI_MEMBERSHIP_CONFLICTS_EXIST`
- `false → true`: no check needed
- On successful change: fire `NotifyMultiMembershipSettingChangedUseCase`

### 6. `CreateOrganizationUseCase` — setting on creation

- If `parentId` is provided: set `allowMultiTreeMembership = NULL` (inherited)
- If `parentId` is null: set `allowMultiTreeMembership = false` (default), allow caller to pass a different value

### 7. New helper on `OrganizationMembershipService`

`findUsersWithMultipleTreeMemberships(rootOrgId): Promise<string[]>` — returns userIds holding accepted memberships in 2+ orgs within the tree (**including archived orgs**). Used by toggle-off validation.

### 8. Remove user from archived org

Org admins and superadmins can remove a user from an archived org's membership. This is needed to resolve multi-membership conflicts when toggling the setting off, since archived orgs may still hold member records that block the toggle.

## Notifications

### Setting changed notification

- New use case: `NotifyMultiMembershipSettingChangedUseCase`
- Fetches all accepted member userIds across entire tree via `findAcceptedMemberUserIdsIncludingDescendants(rootOrgId)`
- Creates notification per user: type `multi_membership_setting_changed`, data `{ organizationName, allowed: boolean }`
- Fire-and-forget from `UpdateOrganizationUseCase`

## Error Codes

| Code                               | When                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| `MULTI_MEMBERSHIP_CONFLICT`        | Org union blocked: overlapping members + at least one tree disallows |
| `MULTI_MEMBERSHIP_CONFLICTS_EXIST` | Can't disable: users hold multiple memberships in tree               |
| `NOT_ROOT_ORG`                     | Attempted to modify setting on child org                             |

All codes added to `en.json` and `ru.json`.

## UI Changes

### Create Organization Dialog

- No parent selected: show `SwitchField` for `allowMultiTreeMembership` (default `false`), below autoJoin toggle
- Parent selected: hide switch, show read-only text: "Multi-membership: allowed/disallowed (inherited from root org `<name>`)"

### Modify Org Page (`OrgEditForm`)

- Root org: editable `SwitchField` under description field
- Child org: read-only text: "Multi-membership: allowed/disallowed (setting from root org `<name>`)"

### Localization

New keys for:

- Toggle label + description
- Read-only inherited text (with root org name interpolation)
- Error messages for all 3 new error codes
- Notification text for setting change
