# Virtualized Notifications List + Select & Delete

## Phase 1: Backend — Batch Delete (TDD) ✅

- 1a. Domain: added `findByIds`, `deleteByIds`, `getCountByUserId` to `NotificationRepository`
- 1b. Error codes: added `EMPTY_IDS`, `SOME_NOT_FOUND`
- 1c. Schema: created `DeleteNotificationsSchema.ts`
- 1d. Tests: created `DeleteNotificationsUseCase.test.ts` (4 tests)
- 1e. Use case: created `DeleteNotificationsUseCase.ts`
- 1f. Infrastructure: added methods to `PrismaNotificationRepository`
- 1g. Translations: added all new keys to en.json + ru.json

## Phase 2: Server Action + totalCount ✅

- 2a. Added `totalCount` to `GetNotificationsUseCase` result (test-first)
- 2b. Added `deleteNotificationsAction` to server actions
- 2c. Pass `initialTotalCount` to `NotificationsList`

## Phase 3: Frontend — Virtualization + Selection + Delete UI ✅

- 3a. Installed `@tanstack/react-virtual`
- 3b. Rewrote `NotificationsList.tsx` with virtualization, infinite scroll, selection, delete
