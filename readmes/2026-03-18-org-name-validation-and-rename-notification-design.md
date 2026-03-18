# Org Name Validation + Rename Notification

## 1. Org Name Validation

### Rules

- Min 1 character (after trim)
- Max 255 characters (existing)
- Allowed: unicode letters (`\p{L}`), unicode digits (`\p{N}`), whitespace, hyphens, double quotes
- Regex: `/^[\p{L}\p{N}\s\-"]+$/u`
- Validation order: empty → too short → too long → invalid chars

### Changes

**`Organization.ts` (domain model)**

- Add `NAME_MIN_LENGTH = 1` constant
- Add regex constant: `NAME_PATTERN = /^[\p{L}\p{N}\s\-"]+$/u`
- Update `updateName()`: add min length + invalid chars checks
- Extract private static `validateName(name: string): Result<void, string>` shared by both `create()` and `updateName()`
- Update `create()` and `updateName()` to call `validateName()`

**`OrganizationDomainCodes.ts`**

- Add `ORGANIZATION_NAME_TOO_SHORT: 'domain.organization.organizationNameTooShort'`
- Add `ORGANIZATION_NAME_INVALID_CHARS: 'domain.organization.organizationNameInvalidChars'`

**Localization (`messages/en.json`, `messages/ru.json`)**

- `domain.organization.organizationNameTooShort`: "Organization name must be at least 3 characters" / "Название организации должно содержать не менее 3 символов"
- `domain.organization.organizationNameInvalidChars`: "Organization name can only contain letters, numbers, spaces, hyphens, and double quotes" / "Название организации может содержать только буквы, цифры, пробелы, дефисы и кавычки"

## 2. Org Name Change Notification

### Behavior

- When an org name changes, notify all accepted members of that org + its descendants (NOT the whole tree up to root)
- Include old and new name in the notification body
- Everyone gets notified (including the admin who renamed)
- Notification links to the org page

### New Use Case: `NotifyOrgNameChangedUseCase`

**Input:** `{ organizationId: string, oldName: string, newName: string }`

**Flow:**

1. Fetch org by ID (bail if not found)
2. Get all accepted member user IDs via `findAcceptedMemberUserIdsIncludingDescendants(organizationId)` — this covers the renamed org + all its descendants
3. Create notifications batch:
   - `type`: `"org_name_changed"`
   - `title`: `"notification.types.orgNameChanged.title"`
   - `body`: `"notification.types.orgNameChanged.body"`
   - `data`: `{ organizationId, oldName, newName }`
4. Save via `notificationRepository.saveBatch()`

### Trigger in `UpdateOrganizationUseCase`

- Capture old name **before** calling `organization.updateName()` (the mutation changes the property in place)
- Compare trimmed old name vs new name
- If changed, fire-and-forget: `new NotifyOrgNameChangedUseCase(...).execute({...}).catch(console.error)`

### Action URL

- `notificationActionUrl.ts`: `org_name_changed` → `/organizations/{organizationId}`
- `actionKey`: `"viewOrganization"` (button text for the notification)

### Localization

- EN title: "Organization renamed"
- EN body: "Organization \"{oldName}\" has been renamed to \"{newName}\""
- RU title: "Организация переименована"
- RU body: "Организация \"{oldName}\" была переименована в \"{newName}\""

## Files to Create

- `src/application/notification/NotifyOrgNameChangedUseCase.ts`
- `src/application/notification/__tests__/NotifyOrgNameChangedUseCase.test.ts`

## Files to Modify

- `src/domain/organization/Organization.ts` — validation rules
- `src/domain/organization/OrganizationDomainCodes.ts` — new error codes
- `src/domain/organization/__tests__/Organization.test.ts` — new validation tests
- `src/application/organization/UpdateOrganizationUseCase.ts` — fire-and-forget notification
- `src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts` — test notification trigger
- `src/web/utils/notificationActionUrl.ts` — action URL mapping
- `src/web/utils/__tests__/notificationActionUrl.test.ts` — test new mapping
- `messages/en.json` — new messages
- `messages/ru.json` — new messages
