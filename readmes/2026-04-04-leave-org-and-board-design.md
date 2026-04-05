# Leave Organization & Board

## Summary

Allow users to voluntarily leave organizations and boards from the home page.

## Use Cases

### LeaveBoardUseCase

- **Input:** `{ userId, boardId }`
- **Validates:** board exists, not archived, user is active member
- **Action:** Soft-delete `BoardUser` — sets `removedAt`, `removedBy = userId`, `removedReason = "left_voluntarily"`
- **Notification:** Fire-and-forget to org admins (`member_left_board`)
- **Errors:** `BOARD_NOT_FOUND`, `BOARD_ARCHIVED`, `NOT_MEMBER`

### LeaveOrganizationUseCase

- **Input:** `{ userId, organizationId, boardIdsToLeave: string[] }`
- **Validates:** org exists, not archived, user is accepted member
- **Action:**
  - Hard-delete `OrganizationUser` record (matches existing pattern)
  - For each board in `boardIdsToLeave`: soft-delete `BoardUser` (same as LeaveBoardUseCase)
- **Notification:** Fire-and-forget to org admins (`member_left_organization`)
- **Errors:** `ORG_NOT_FOUND`, `ORG_ARCHIVED`, `NOT_MEMBER`
- **Note:** Leaving org does NOT affect admin role — `OrganizationAdminUser` stays

## Server Actions

### `leaveOrganizationAction(formData)`

Extracts `organizationId` and `boardIdsToLeave[]`, calls `LeaveOrganizationUseCase`.

### `leaveBoardAction(formData)`

Extracts `boardId`, calls `LeaveBoardUseCase`.

### `getUserBoardsForHomeAction()`

Returns `{ boardsByOrgId: Record<string, Board[]>, externalBoards: Board[] }` where each board has `{ id, name, organizationName }`.

## Repository Methods

### BoardRepository

- `getUserBoardsByOrganization(userId)` — boards grouped by org + external boards (member of board but not org)
- `leaveBoard(userId, boardId)` — soft-delete with `removedBy = self`

## UI Changes

### Home Page — Org Cards

- Each org card gets a collapsible section showing boards the user is a member of within that org
- Each board item: board name + "Leave" button
- Org card gets a "Leave" button

### "Leave Board" Flow

Click "Leave" → simple confirmation dialog ("Are you sure you want to leave {boardName}?") → calls `leaveBoardAction`.

### "Leave Organization" Flow

Click "Leave" on org card:

- **If user is on boards within that org:** Dialog with board list as checkboxes (all checked by default). User picks which boards to also leave → confirm → calls `leaveOrganizationAction`.
- **If user is on NO boards:** Simple confirmation dialog.

### New Section: "External Boards"

- Below org cards section on home page
- Shows boards where user is a member but NOT a member of that board's org
- Same card style, each with "Leave" button + confirmation dialog

## Data Fetching

New action `getUserBoardsForHomeAction()` returns boards grouped by org ID, plus separate list of external boards. Home page server component passes this alongside existing org data.

## Localization Keys

Under `home.`:

- `home.myBoards` — collapsible section title
- `home.externalBoards` — section title
- `home.leaveOrganization` — button label
- `home.leaveBoard` — button label
- `home.leaveOrgConfirmTitle` — dialog title
- `home.leaveOrgConfirmDescription` — "Are you sure you want to leave {orgName}?"
- `home.leaveOrgBoardsPrompt` — "You are a member of these boards. Select which to also leave:"
- `home.leaveBoardConfirmTitle` — dialog title
- `home.leaveBoardConfirmDescription` — "Are you sure you want to leave {boardName}?"

## Notification Types

- `member_left_organization` — sent to org admins
- `member_left_board` — sent to org admins
