# Superadmin: Remove Member from Organization — Design

**Date:** 2026-07-12
**Status:** Approved

## Context

Superadmins need to remove a member from an organization — primarily for cleanup/mistakes (wrong joins, duplicates, test accounts). Org admins may get this ability later; the design keeps that a one-line change. Re-join must remain possible.

## Decisions

| Question       | Decision                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Who can remove | Superadmin only (org admins later via widened auth check)                                                                                  |
| Cascade        | Drop org-admin role, soft-remove from all org's boards                                                                                     |
| Storage        | Hard-delete `OrganizationUser` row + append-only audit row                                                                                 |
| Open polls     | Untouched — cast votes and eligibility snapshots stay (they're the legal record)                                                           |
| Notification   | In-app notification to the removed user                                                                                                    |
| Reason         | **Required** — stored in the audit row; NOT shown in the user's notification (matches board-removal precedent, where reason is audit-only) |
| Re-join        | Possible (row is gone, unique `[organizationId, userId]` freed)                                                                            |

Vote history is safe: `Vote`, `PollParticipant`, `PollEligibleMember`, `VoteDraft` reference `userId` directly, never the membership row.

## Data model

New append-only audit table (mirrors `UserBlockStatus` pattern):

```prisma
// Organization member removals (append-only audit log)
model OrganizationMemberRemoval {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  userId          String   @map("user_id")
  removedByUserId String   @map("removed_by_user_id")
  reason          String
  createdAt       DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation("RemovedOrgMember", fields: [userId], references: [id], onDelete: Cascade)
  removedBy    User         @relation("RemovedOrgMemberBy", fields: [removedByUserId], references: [id])

  @@index([organizationId])
  @@index([userId])
  @@map("organization_member_removals")
}
```

One migration. No changes to `OrganizationUser`.

## Domain layer

`OrganizationRepository` (interface, `src/domain/organization/OrganizationRepository.ts`) gets:

```ts
/** Hard-deletes the membership row and writes an audit row, in one transaction. */
removeMemberFromOrganization(
  organizationId: string,
  userId: string,
  removedByUserId: string,
  reason: string
): Promise<void>;
```

Implementation in `PrismaOrganizationRepository`: `$transaction([organizationUser.delete, organizationMemberRemoval.create])`.

## Application layer

### `RemoveOrgMemberUseCase` (`src/application/organization/`)

Input: `{ actorUserId, organizationId, targetUserId, reason }`. Flow:

1. `reason.trim()` non-empty → else `OrganizationErrors.REASON_REQUIRED` (new code)
2. Org exists → else `OrganizationErrors.NOT_FOUND`; not archived → else `ARCHIVED`
3. `userRepository.isSuperAdmin(actorUserId)` → else `NOT_ADMIN` (later: `|| isUserAdmin(...)`)
4. `actorUserId !== targetUserId` → else `CANNOT_REMOVE_SELF`
5. Target is an accepted member → else `NOT_MEMBER`
6. If target is org admin → `organizationRepository.removeAdmin(...)`; its `LAST_ADMIN` transaction guard applies — removal **blocked** if target is the last admin
7. Soft-remove from all of the org's boards: for each org board where target is a member, `boardRepository.removeUserFromBoard(targetUserId, boardId, actorUserId, 'removed_from_organization')` (board rows carry their own removedBy/At/Reason audit)
8. `organizationRepository.removeMemberFromOrganization(organizationId, targetUserId, actorUserId, reason.trim())` — membership delete + audit row, one transaction
9. Fire-and-forget `NotifyMemberRemovedFromOrganizationUseCase` (`.catch(console.error)`, failure never fails the removal)

One new error code: `REASON_REQUIRED` (added to `OrganizationErrors` + en/ru messages); the rest exist.

### `NotifyMemberRemovedFromOrganizationUseCase` (`src/application/notification/`)

Copies `NotifyAdminRemovedUseCase`: notification to the removed user, type `member_removed_from_organization`, title/body keys `notification.types.memberRemovedFromOrganization.title|body`, data `{ organizationId, organizationName }`. No actor name — superadmin acts as the platform.

## Web layer

### Server action

`removeOrgMemberAction(organizationId, targetUserId, reason)` in `src/web/actions/organization/organization.ts`, standard boilerplate:
`checkRateLimit()` → `getCurrentUser()` → Zod validation (reason: trimmed, 1–500 chars) → `removeOrgMemberUseCase.execute(...)` → on failure `translateErrorCode(result.error)`.

### UI

- `organizations/[id]/page.tsx`: pass `canRemoveMembers={isSuperAdmin}` to `MembersListContent` (server-computed; nothing sensitive crosses the boundary).
- `MembersListContent.tsx`: new optional prop `canRemoveMembers` (default `false` — other call sites unchanged). When `true`, each member row except the viewer's own gets a Remove button (`cursor-pointer`) → Catalyst confirm dialog ("Remove {name} from this organization?") with a **required reason** textarea; the confirm button stays disabled (`disabled:cursor-not-allowed`) until the trimmed reason is non-empty → `removeOrgMemberAction` → on success re-fetch current page; on error show translated message.

## i18n (messages/en.json + ru.json)

UI keys live in `organization.detail.*` (the namespace `MembersListContent` already uses):

- `organization.detail.removeMember` — button label
- `organization.detail.removeMemberDialogTitle`, `.removeMemberDialogDescription` (param `{name}`)
- `organization.detail.removeMemberReasonLabel`, `.removeMemberReasonPlaceholder`
- `organization.detail.removeMemberConfirm`, `.removingMember`
- `organization.errors.reasonRequired` (for `REASON_REQUIRED`)
- `notification.types.memberRemovedFromOrganization.title`, `.body` (param `{organizationName}`; reason intentionally omitted)

No success toast — closing the dialog + refreshing the list is the feedback (matches board-removal pattern).

Russian uses «орган управления» terminology where boards are referenced (none expected in these strings).

## Testing (TDD, unit)

`RemoveOrgMemberUseCase.test.ts`, mocked repositories:

- rejects empty/whitespace-only reason (`REASON_REQUIRED`)
- rejects when actor is not superadmin (`NOT_ADMIN`)
- rejects self-removal (`CANNOT_REMOVE_SELF`)
- rejects non-member target (`NOT_MEMBER`)
- rejects archived org (`ARCHIVED`), missing org (`NOT_FOUND`)
- blocks when target is the last org admin (`LAST_ADMIN` surfaced)
- happy path: admin link removed, board memberships soft-removed with reason code, `removeMemberFromOrganization` called with trimmed reason, notification fired
- notification failure does not fail the removal

`NotifyMemberRemovedFromOrganizationUseCase.test.ts`: saves notification with correct type/keys/data.

## Edge cases

- Target voted in open/closed polls → untouched; history intact by schema design.
- Target is last org admin → blocked; superadmin must appoint another admin first.
- Archived org → blocked (parity with leave-organization).
- Mid-flight failure (boards removed, membership not yet) → re-running the action converges; final delete+audit step is atomic.

## Out of scope

- Org-admin permission to remove members (future: widen step 3)
- Removing users from open polls' eligibility/participants
- Superadmin UI for browsing the audit log
- Showing the removal reason to the removed user (audit-only, mirrors board-removal precedent)

## Open questions

None.
