╭───────────────────────────────────────────────────────────────────────────────────────────╮
│ Plan to implement │
│ │
│ Join Parent Organization Request + Notifications System │
│ │
│ Context │
│ │
│ Organizations can form hierarchies via parentId. Currently, child orgs are created │
│ directly by parent org admins. We need a request-based flow: a child org admin requests │
│ to join a parent org, and a parent org admin accepts or rejects. On acceptance, all │
│ affected members get notified via a new notifications system. │
│ │
│ --- │
│ Phase 1: Schema & Domain for Join Parent Request │
│ │
│ - 1A. Prisma schema -- add OrganizationJoinParentRequest model to prisma/schema.prisma │
│ OrganizationJoinParentRequest: │
│ id, childOrgId, parentOrgId, requestingAdminId, handlingAdminId?, │
│ message (required - admin's reason for the request), │
│ status (pending|accepted|rejected), rejectionReason?, createdAt, handledAt? │
│ - Add relations on Organization (childJoinRequests, parentJoinRequests) and User │
│ (requestingAdminRequests, handlingAdminRequests). Run migration. │
│ - 1B. Domain entity -- src/domain/organization/JoinParentRequest.ts │
│ - create(), reconstitute(), accept(adminId), reject(adminId, reason) methods │
│ - Validation: reason required on reject │
│ - 1C. Repository interface -- src/domain/organization/JoinParentRequestRepository.ts │
│ - save, findById, findPendingByChildOrgId, findPendingByParentOrgId, update, delete │
│ - 1D. Error codes -- add to src/application/organization/OrganizationErrors.ts: │
│ - CANNOT_JOIN_OWN_DESCENDANT, PENDING_PARENT_REQUEST, PARENT_REQUEST_NOT_FOUND, │
│ PARENT_REQUEST_NOT_PENDING, SAME_ORGANIZATION, CHILD_ORG_NOT_FOUND, CHILD_ORG_ARCHIVED, │
│ REJECTION_REASON_REQUIRED │
│ - Add translations to messages/en.json and messages/ru.json │
│ - 1E. Infrastructure -- │
│ src/infrastructure/repositories/PrismaJoinParentRequestRepository.ts │
│ - Implement repository interface. Export from src/infrastructure/index.ts. │
│ │
│ Key files: │
│ - prisma/schema.prisma │
│ - src/domain/organization/JoinParentRequest.ts (new) │
│ - src/domain/organization/JoinParentRequestRepository.ts (new) │
│ - src/application/organization/OrganizationErrors.ts │
│ - src/infrastructure/repositories/PrismaJoinParentRequestRepository.ts (new) │
│ - src/infrastructure/index.ts │
│ │
│ --- │
│ Phase 2: Use Cases for Join Parent Request │
│ │
│ - 2A. RequestJoinParentUseCase + schema + tests │
│ - Input: { childOrgId, parentOrgId, adminUserId, message } │
│ - message is required -- admin explains why the org wants to join │
│ - Checks: admin of child org (or superadmin), both orgs exist & not archived, not same │
│ org, no pending request for child org, parent is not descendant of child (cycle │
│ prevention) │
│ - Re-parenting allowed: org with existing parent can request to move │
│ - Tests: success, not admin, org not found/archived, same org, pending exists, cycle │
│ detected, superadmin bypass │
│ - 2B. CancelJoinParentRequestUseCase + schema + tests │
│ - Input: { requestId, adminUserId } │
│ - Any admin of child org can cancel (or superadmin) │
│ - Deletes the request row (link row, OK to delete per project rules) │
│ - Tests: success, not found, not pending, not admin │
│ - 2C. HandleJoinParentRequestUseCase + schema + tests │
│ - Input: { requestId, adminUserId, action: accept|reject, rejectionReason? } │
│ - Admin of parent org (or superadmin) │
│ - Accept: re-verify no cycle, set childOrg.parentId = parentOrg.id, update request │
│ status. Notification wiring added in Phase 5. │
│ - Reject: rejectionReason required. Update request status. │
│ - Tests: accept success (parentId set), reject success, reject without reason fails, │
│ not admin, not found, not pending │
│ - 2D. GetChildOrgJoinParentRequestUseCase + tests │
│ - Returns pending request (if any) for child org admin view │
│ - Admin of child org (or superadmin) │
│ - 2E. GetIncomingJoinParentRequestsUseCase + tests │
│ - Returns pending requests targeting this org as parent │
│ - Admin of parent org (or superadmin) │
│ │
│ Key files: │
│ - src/application/organization/RequestJoinParentUseCase.ts (new) │
│ - src/application/organization/CancelJoinParentRequestUseCase.ts (new) -- NOTE: different │
│ from existing CancelJoinRequestUseCase which is user→org │
│ - src/application/organization/HandleJoinParentRequestUseCase.ts (new) -- different from │
│ existing HandleJoinRequestUseCase │
│ - src/application/organization/GetChildOrgJoinParentRequestUseCase.ts (new) │
│ - src/application/organization/GetIncomingJoinParentRequestsUseCase.ts (new) │
│ - Corresponding schema files and **tests**/ files │
│ │
│ Reuse: │
│ - OrganizationRepository.getDescendantIds() for cycle check │
│ - OrganizationRepository.isUserAdmin() and UserRepository.isSuperAdmin() for auth │
│ - Existing HandleJoinRequestUseCase as pattern reference │
│ │
│ --- │
│ Phase 3: Web Layer for Join Parent Request │
│ │
│ - 3A. Server actions -- src/web/actions/joinParentRequest.ts │
│ - requestJoinParentAction, cancelJoinParentRequestAction, │
│ handleJoinParentRequestAction, getChildOrgJoinParentRequestAction, │
│ getIncomingJoinParentRequestsAction │
│ - 3B. Organization detail page updates -- src/app/[locale]/organizations/[id]/page.tsx │
│ - If admin & no pending request: "Request to Join Parent" button/link │
│ - If admin & pending request exists: show status + "Cancel" button │
│ - If admin: "Incoming Parent Requests" link with count badge │
│ - 3C. Request join parent page -- │
│ src/app/[locale]/organizations/[id]/join-parent/page.tsx │
│ - Select target parent org (exclude self + descendants) │
│ - Required message textarea -- admin explains reason for joining │
│ - Submit button │
│ - 3D. Incoming parent requests page -- │
│ src/app/[locale]/organizations/[id]/parent-requests/page.tsx │
│ - Table: child org name, requesting admin, message, date │
│ - Accept / Reject buttons. Reject opens dialog requiring reason. │
│ - 3E. Localization -- add organization.joinParent._ keys to both messages/en.json and │
│ messages/ru.json │
│ │
│ Key files: │
│ - src/web/actions/joinParentRequest.ts (new) │
│ - src/app/[locale]/organizations/[id]/page.tsx (modify) │
│ - src/app/[locale]/organizations/[id]/join-parent/page.tsx (new) │
│ - src/app/[locale]/organizations/[id]/parent-requests/page.tsx (new) │
│ - messages/en.json, messages/ru.json │
│ │
│ --- │
│ Phase 4: Schema & Domain for Notifications │
│ │
│ - 4A. Prisma schema -- add Notification model │
│ Notification: │
│ id, userId, type (string), title (localization key), body (localization key), │
│ data (Json? - payload for interpolation), readAt?, createdAt │
│ - Add relation on User. Run migration. │
│ - 4B. Domain entity -- src/domain/notification/Notification.ts │
│ - create(), reconstitute(), markAsRead() │
│ - 4C. Repository interface -- src/domain/notification/NotificationRepository.ts │
│ - save, saveBatch, findById, findByUserId(userId, options?), getUnreadCount, │
│ markAsRead, markAllAsRead │
│ - 4D. Error codes -- src/application/notification/NotificationErrors.ts │
│ - NOT_FOUND, NOT_OWNER │
│ - 4E. Infrastructure -- src/infrastructure/repositories/PrismaNotificationRepository.ts │
│ - saveBatch uses prisma.notification.createMany() │
│ - Export from src/infrastructure/index.ts │
│ │
│ Key files: │
│ - prisma/schema.prisma │
│ - src/domain/notification/Notification.ts (new) │
│ - src/domain/notification/NotificationRepository.ts (new) │
│ - src/application/notification/NotificationErrors.ts (new) │
│ - src/infrastructure/repositories/PrismaNotificationRepository.ts (new) │
│ │
│ --- │
│ Phase 5: Notification Use Cases + Wiring │
│ │
│ - 5A. NotifyOrgJoinedParentUseCase + tests │
│ - Input: { childOrgId, parentOrgId } │
│ - Gets all members of child org including descendants via │
│ organizationRepository.findAcceptedMemberUserIdsIncludingDescendants() │
│ - Creates notification per user with type org_joined_parent, data: { childOrgId, │
│ parentOrgId, childOrgName, parentOrgName } │
│ - Batch saves │
│ - 5B. NotifyJoinParentRequestReceivedUseCase + tests │
│ - Input: { childOrgId, parentOrgId } │
│ - Notifies all admins of parent org that a join request was received │
│ - Type: join_parent_request_received │
│ - 5C. Wire notifications into HandleJoinParentRequestUseCase │
│ - On accept: call NotifyOrgJoinedParentUseCase │
│ - Wire NotifyJoinParentRequestReceivedUseCase into RequestJoinParentUseCase │
│ - 5D. GetNotificationsUseCase + tests │
│ - Input: { userId, limit?, offset? } │
│ - Returns: { notifications[], unreadCount } │
│ - 5E. MarkNotificationReadUseCase + tests │
│ - Input: { notificationId, userId } │
│ - Verifies notification belongs to user │
│ - 5F. MarkAllNotificationsReadUseCase + tests │
│ - Input: { userId } │
│ - 5G. GetUnreadNotificationCountUseCase + tests │
│ - Input: { userId } -- Returns: { count } │
│ │
│ Key files: │
│ - src/application/notification/ (all new) │
│ - src/application/organization/HandleJoinParentRequestUseCase.ts (modify for wiring) │
│ - src/application/organization/RequestJoinParentUseCase.ts (modify for wiring) │
│ │
│ Reuse: organizationRepository.findAcceptedMemberUserIdsIncludingDescendants() for member │
│ fan-out │
│ │
│ --- │
│ Phase 6: Notifications UI │
│ │
│ - 6A. Server actions -- src/web/actions/notification.ts │
│ - getNotificationsAction, markNotificationReadAction, markAllNotificationsReadAction, │
│ getUnreadNotificationCountAction │
│ - 6B. Navbar integration │
│ - AuthenticatedLayout: fetch unread count, pass to AppNavbar + MobileSidebar │
│ - AppNavbar/MobileSidebar: add BellIcon + unread count badge + link to /notifications │
│ - Count refreshes on page navigation (server component re-renders) │
│ - 6C. Notifications page -- src/app/[locale]/notifications/page.tsx │
│ - Table layout (Catalyst Table component) │
│ - Columns: icon/type, title/body (localized with interpolation from data), date, read │
│ status │
│ - Unread rows visually distinct (bold/dot) │
│ - Click row → marks as read + opens detail/expands │
│ - "Mark All Read" button │
│ - Responsive: cards on mobile │
│ - 6D. Localization -- add notification._ and navbar.notifications keys │
│ │
│ Key files: │
│ - src/web/actions/notification.ts (new) │
│ - src/web/components/AuthenticatedLayout.tsx (modify) │
│ - src/web/components/AppNavbar.tsx (modify) │
│ - src/web/components/MobileSidebar.tsx (modify) │
│ - src/app/[locale]/notifications/page.tsx (new) │
│ - messages/en.json, messages/ru.json │
│ │
│ --- │
│ Verification │
│ │
│ Each phase: │
│ 1. Run yarn test -- all tests pass │
│ 2. Run yarn typecheck -- no type errors │
│ 3. Run npx prisma migrate dev -- migrations apply cleanly (phases 1, 4) │
│ │
│ End-to-end manual test flow: │
│ 1. Create org A and org B (with different admins) │
│ 2. As admin of A, request to join B → verify request appears for B's admin │
│ 3. B's admin gets notification about incoming request │
│ 4. B's admin rejects with reason → verify reason visible to A's admin │
│ 5. A's admin re-requests → B's admin accepts │
│ 6. Verify A.parentId = B.id │
│ 7. Verify all members of A (+ descendants) got "org joined parent" notification │
│ 8. Open notifications page → verify table, unread badge, mark read, mark all read │
│ 9. Test on mobile viewport │
│ │
│ --- │
│ Unresolved Questions │
│ │
│ None remaining. │
╰───────────────────────────────────────────────────────────────────────────────────────────╯
