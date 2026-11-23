# Org Name Validation + Rename Notification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stricter org name validation (min 3 chars, allowed chars regex) and notify org members (including descendants) when an org is renamed.

**Architecture:** Domain validation in `Organization.ts` with shared static method. New `NotifyOrgNameChangedUseCase` following existing fire-and-forget pattern from `UpdateOrganizationUseCase`.

**Tech Stack:** TypeScript, Vitest, next-intl (ICU message format)

**Spec:** `readmes/2026-03-18-org-name-validation-and-rename-notification-design.md`

---

## Chunk 1: Org Name Validation

### Task 1: Add new domain error codes

**Files:**

- Modify: `src/domain/organization/OrganizationDomainCodes.ts`

- [ ] **Step 1: Add new codes**

```typescript
// Add before the closing `} as const`:
  ORGANIZATION_NAME_TOO_SHORT: 'domain.organization.organizationNameTooShort',
  ORGANIZATION_NAME_INVALID_CHARS: 'domain.organization.organizationNameInvalidChars',
```

- [ ] **Step 2: Add localization keys to en.json**

In `messages/en.json`, inside `"domain" > "organization"`, add:

```json
"organizationNameTooShort": "Organization name must be at least 3 characters",
"organizationNameInvalidChars": "Organization name can only contain letters, numbers, spaces, hyphens, and double quotes"
```

- [ ] **Step 3: Add localization keys to ru.json**

In `messages/ru.json`, inside `"domain" > "organization"`, add:

```json
"organizationNameTooShort": "Название организации должно содержать не менее 3 символов",
"organizationNameInvalidChars": "Название организации может содержать только буквы, цифры, пробелы, дефисы и кавычки"
```

### Task 2: Write failing tests for new name validation rules

**Files:**

- Modify: `src/domain/organization/__tests__/Organization.test.ts`

- [ ] **Step 1: Add test for min length (updateName)**

Inside `describe('Organization.updateName', ...)`, add:

```typescript
it('should fail when shorter than 3 chars after trim', () => {
  const org = makeOrg();
  const result = org.updateName('AB');

  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error).toBe(
      OrganizationDomainCodes.ORGANIZATION_NAME_TOO_SHORT
    );
  }

  expect(org.name).toBe('Test Org');
});

it('should fail when shorter than 3 chars after trim with spaces', () => {
  const org = makeOrg();
  const result = org.updateName('  A  ');

  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error).toBe(
      OrganizationDomainCodes.ORGANIZATION_NAME_TOO_SHORT
    );
  }
});

it('should succeed with exactly 3 chars', () => {
  const org = makeOrg();
  const result = org.updateName('ABC');

  expect(result.success).toBe(true);
  expect(org.name).toBe('ABC');
});
```

- [ ] **Step 2: Add test for invalid chars (updateName)**

```typescript
it('should fail when name contains special characters', () => {
  const org = makeOrg();
  const result = org.updateName('Org@Name!');

  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error).toBe(
      OrganizationDomainCodes.ORGANIZATION_NAME_INVALID_CHARS
    );
  }

  expect(org.name).toBe('Test Org');
});

it('should allow unicode letters', () => {
  const org = makeOrg();
  const result = org.updateName('Организация');

  expect(result.success).toBe(true);
  expect(org.name).toBe('Организация');
});

it('should allow hyphens and double quotes', () => {
  const org = makeOrg();
  const result = org.updateName('Org "Name" - Test');

  expect(result.success).toBe(true);
  expect(org.name).toBe('Org "Name" - Test');
});

it('should allow digits in name', () => {
  const org = makeOrg();
  const result = org.updateName('Org 123');

  expect(result.success).toBe(true);
  expect(org.name).toBe('Org 123');
});
```

- [ ] **Step 3: Add test for create() with same validation**

Inside a new `describe('Organization.create name validation', ...)`:

```typescript
describe('Organization.create name validation', () => {
  it('should fail when name is shorter than 3 chars', () => {
    const result = Organization.create('AB', 'Valid desc', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_TOO_SHORT
      );
    }
  });

  it('should fail when name contains special characters', () => {
    const result = Organization.create('Org@Name!', 'Valid desc', 'user-1');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_INVALID_CHARS
      );
    }
  });

  it('should succeed with valid unicode name', () => {
    const result = Organization.create('Организация', 'Valid desc', 'user-1');

    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn vitest run src/domain/organization/__tests__/Organization.test.ts`
Expected: new tests FAIL (min length, invalid chars not yet implemented)

### Task 3: Implement name validation in Organization domain model

**Files:**

- Modify: `src/domain/organization/Organization.ts`

- [ ] **Step 1: Add constants and private static validation method**

After the existing constants (line 5), add:

```typescript
export const ORGANIZATION_NAME_MIN_LENGTH = 3;
export const ORGANIZATION_NAME_PATTERN = /^[\p{L}\p{N}\s\-"]+$/u;
```

Add private static method to the class (after `reconstitute`):

```typescript
  private static validateName(name: string): Result<void, string> {
    if (!name || name.trim().length === 0) {
      return failure(OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY);
    }

    if (name.trim().length < ORGANIZATION_NAME_MIN_LENGTH) {
      return failure(OrganizationDomainCodes.ORGANIZATION_NAME_TOO_SHORT);
    }

    if (name.trim().length > ORGANIZATION_NAME_MAX_LENGTH) {
      return failure(OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG);
    }

    if (!ORGANIZATION_NAME_PATTERN.test(name.trim())) {
      return failure(OrganizationDomainCodes.ORGANIZATION_NAME_INVALID_CHARS);
    }

    return success(undefined);
  }
```

- [ ] **Step 2: Update `updateName()` to use shared method**

Replace the `updateName` method body:

```typescript
  public updateName(name: string): Result<void, string> {
    const validation = Organization.validateName(name);

    if (!validation.success) {
      return validation;
    }

    this.props.name = name.trim();

    return success(undefined);
  }
```

- [ ] **Step 3: Update `create()` to use shared method**

Replace name validation in `create()` (lines 29-35):

```typescript
// Validate name
const nameValidation = Organization.validateName(name);

if (!nameValidation.success) {
  return failure(nameValidation.error);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/organization/__tests__/Organization.test.ts`
Expected: ALL tests PASS

---

## Chunk 2: Org Name Change Notification

### Task 4: Write failing tests for NotifyOrgNameChangedUseCase

**Files:**

- Create: `src/application/notification/__tests__/NotifyOrgNameChangedUseCase.test.ts`

- [ ] **Step 1: Create the test file**

Model after `NotifyMultiMembershipSettingChangedUseCase.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyOrgNameChangedUseCase } from '../NotifyOrgNameChangedUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockOrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private membersByOrgId: Map<string, string[]> = new Map();

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    orgId: string
  ): Promise<string[]> {
    return this.membersByOrgId.get(orgId) || [];
  }

  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  setAcceptedMembers(orgId: string, userIds: string[]) {
    this.membersByOrgId.set(orgId, userIds);
  }
}

class MockNotificationRepository {
  private saved: Notification[] = [];

  async save(notification: Notification): Promise<Notification> {
    this.saved.push(notification);

    return notification;
  }
  async saveBatch(notifications: Notification[]): Promise<void> {
    this.saved.push(...notifications);
  }
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }

  getSaved() {
    return this.saved;
  }
}

describe('NotifyOrgNameChangedUseCase', () => {
  let useCase: NotifyOrgNameChangedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notificationRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notificationRepo = new MockNotificationRepository();
    useCase = new NotifyOrgNameChangedUseCase({
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      notificationRepository:
        notificationRepo as unknown as NotificationRepository,
    });
  });

  it('should send notification to all members including descendants', async () => {
    const org = Organization.reconstitute({
      id: 'org-1',
      name: 'New Name',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(org);
    orgRepo.setAcceptedMembers('org-1', ['user-1', 'user-2', 'user-3']);

    await useCase.execute({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    const saved = notificationRepo.getSaved();
    expect(saved).toHaveLength(3);
    expect(saved[0].type).toBe('org_name_changed');
    expect(saved[0].data).toEqual({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });
    expect(saved.map((n) => n.userId).sort()).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ]);
  });

  it('should not send notifications when org has no members', async () => {
    const org = Organization.reconstitute({
      id: 'org-1',
      name: 'New Name',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(org);
    orgRepo.setAcceptedMembers('org-1', []);

    await useCase.execute({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });

  it('should not send notifications when org not found', async () => {
    await useCase.execute({
      organizationId: 'nonexistent',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });

  it('should use correct notification title and body keys', async () => {
    const org = Organization.reconstitute({
      id: 'org-1',
      name: 'New Name',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(org);
    orgRepo.setAcceptedMembers('org-1', ['user-1']);

    await useCase.execute({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    const saved = notificationRepo.getSaved();
    expect(saved[0].title).toBe('notification.types.orgNameChanged.title');
    expect(saved[0].body).toBe('notification.types.orgNameChanged.body');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/notification/__tests__/NotifyOrgNameChangedUseCase.test.ts`
Expected: FAIL — `NotifyOrgNameChangedUseCase` does not exist yet

### Task 5: Implement NotifyOrgNameChangedUseCase

**Files:**

- Create: `src/application/notification/NotifyOrgNameChangedUseCase.ts`

- [ ] **Step 1: Create the use case**

```typescript
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgNameChangedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyOrgNameChangedUseCase {
  constructor(private deps: NotifyOrgNameChangedDependencies) {}

  async execute(input: {
    organizationId: string;
    oldName: string;
    newName: string;
  }): Promise<void> {
    const { organizationId, oldName, newName } = input;

    const org = await this.deps.organizationRepository.findById(organizationId);

    if (!org) {
      return;
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        organizationId
      );

    if (memberUserIds.length === 0) {
      return;
    }

    const notifications = memberUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'org_name_changed',
          title: 'notification.types.orgNameChanged.title',
          body: 'notification.types.orgNameChanged.body',
          data: {
            organizationId,
            oldName,
            newName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn vitest run src/application/notification/__tests__/NotifyOrgNameChangedUseCase.test.ts`
Expected: ALL tests PASS

### Task 6: Wire notification into UpdateOrganizationUseCase

**Files:**

- Modify: `src/application/organization/UpdateOrganizationUseCase.ts`
- Modify: `src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts`

- [ ] **Step 1: Write failing test for name change notification trigger**

Add import at top of `UpdateOrganizationUseCase.test.ts`:

```typescript
import { vi } from 'vitest';
import { NotifyOrgNameChangedUseCase } from '../../notification/NotifyOrgNameChangedUseCase';
```

Add to `UpdateOrganizationUseCase.test.ts`, inside the main `describe`:

```typescript
describe('org name change notification', () => {
  it('should fire notification when name changes', async () => {
    const executeSpy = vi
      .spyOn(NotifyOrgNameChangedUseCase.prototype, 'execute')
      .mockResolvedValue(undefined);

    organizationRepository.addOrganization(makeOrg('org-1', 'Old Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'New Name',
      description: 'Test description',
    });

    expect(result.success).toBe(true);
    expect(executeSpy).toHaveBeenCalledWith({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    executeSpy.mockRestore();
  });

  it('should not fire notification when name stays the same', async () => {
    const executeSpy = vi
      .spyOn(NotifyOrgNameChangedUseCase.prototype, 'execute')
      .mockResolvedValue(undefined);

    organizationRepository.addOrganization(makeOrg('org-1', 'Same Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Same Name',
      description: 'New description',
    });

    expect(result.success).toBe(true);
    expect(executeSpy).not.toHaveBeenCalled();

    executeSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Add the notification trigger to UpdateOrganizationUseCase**

At the top of the file, add the import:

```typescript
import { NotifyOrgNameChangedUseCase } from '../notification/NotifyOrgNameChangedUseCase';
```

In `execute()`, **before** line `const nameResult = organization.updateName(input.name);`, capture the old name:

```typescript
const oldName = organization.name;
```

After `await this.organizationRepository.update(organization);` (line 81), add:

```typescript
// Notify members if name changed (fire-and-forget)
if (oldName !== organization.name) {
  new NotifyOrgNameChangedUseCase({
    organizationRepository: this.organizationRepository,
    notificationRepository: this.notificationRepository,
  })
    .execute({
      organizationId: input.organizationId,
      oldName,
      newName: organization.name,
    })
    .catch((err) => console.error('Failed to notify org name change:', err));
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `yarn vitest run src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts`
Expected: ALL tests PASS

### Task 7: Add notification action URL mapping and localization

**Files:**

- Modify: `src/web/utils/notificationActionUrl.ts`
- Modify: `src/web/utils/__tests__/notificationActionUrl.test.ts`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Write failing test for action URL**

Add to `notificationActionUrl.test.ts`, inside `describe('returns correct href and actionKey for each type', ...)`:

```typescript
it('org_name_changed → /organizations/{id}', () => {
  const result = getNotificationActionUrl('org_name_changed', {
    organizationId: 'org-10',
  });
  expect(result).toEqual({
    href: '/organizations/org-10',
    actionKey: 'viewOrganization',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/web/utils/__tests__/notificationActionUrl.test.ts`
Expected: FAIL — `org_name_changed` not in config

- [ ] **Step 3: Add config entry to notificationActionUrl.ts**

Add to `TYPE_CONFIG` object (after `org_unarchived`):

```typescript
  org_name_changed: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/web/utils/__tests__/notificationActionUrl.test.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Add notification type localization to en.json**

In `messages/en.json`, inside `"notification" > "types"`, add after `multiMembershipSettingChanged`:

```json
      "orgNameChanged": {
        "title": "Organization renamed",
        "body": "Organization \"{oldName}\" has been renamed to \"{newName}\""
      }
```

- [ ] **Step 6: Add notification type localization to ru.json**

In `messages/ru.json`, inside `"notification" > "types"`, add after `multiMembershipSettingChanged`:

```json
      "orgNameChanged": {
        "title": "Организация переименована",
        "body": "Организация \"{oldName}\" была переименована в \"{newName}\""
      }
```

### Task 8: Run all tests

- [ ] **Step 1: Run all related tests**

Run: `yarn vitest run src/domain/organization/__tests__/Organization.test.ts src/application/notification/__tests__/NotifyOrgNameChangedUseCase.test.ts src/application/organization/__tests__/UpdateOrganizationUseCase.test.ts src/web/utils/__tests__/notificationActionUrl.test.ts`
Expected: ALL tests PASS
