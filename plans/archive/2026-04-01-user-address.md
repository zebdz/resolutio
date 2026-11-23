# User Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users fill in a structured address (with Nominatim autocomplete), store it in a separate Address table, and add an "allow find by address" privacy toggle.

**Architecture:** New `Address` value object in domain, one-to-one optional relation from User. Extends existing privacy toggle pattern (`allowFindByName`/`allowFindByPhone`) with `allowFindByAddress`. Nominatim autocomplete is client-side only (no backend proxy). Address form is a new section in AccountForm with its own submit/state.

**Tech Stack:** Prisma (migration), Zod (validation), Nominatim API (client-side geocoding), React (autocomplete component), next-intl (i18n).

---

## File Map

### Task 1 — Prisma Schema + Migration

- Modify: `prisma/schema.prisma`

### Task 2 — Address Value Object

- Create: `src/domain/user/Address.ts`
- Create: `src/domain/user/__tests__/Address.test.ts`

### Task 3 — User Domain Entity (address + allowFindByAddress)

- Modify: `src/domain/user/User.ts`
- Modify: `src/domain/user/__tests__/User.test.ts`

### Task 4 — Application Layer (use cases + schemas)

- Modify: `src/application/user/UpdateUserProfileUseCase.ts`
- Modify: `src/application/user/UpdateUserProfileSchema.ts`
- Modify: `src/application/user/CompletePrivacySetupUseCase.ts`
- Modify: `src/application/user/CompletePrivacySetupSchema.ts`
- Modify: `src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`

### Task 5 — Infrastructure (repository)

- Modify: `src/infrastructure/repositories/PrismaUserRepository.ts`

### Task 6 — Localization

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

### Task 7 — Server Action

- Modify: `src/web/actions/user/user.ts`

### Task 8 — Nominatim Autocomplete Component

- Create: `src/web/components/account/AddressSearch.tsx`

### Task 9 — AccountForm + Account Page

- Modify: `src/web/components/account/AccountForm.tsx`
- Modify: `src/app/[locale]/account/page.tsx`

### Task 10 — PrivacySetupForm

- Modify: `src/web/components/privacy/PrivacySetupForm.tsx`
- Modify: `src/app/[locale]/privacy-setup/page.tsx` (if it passes address data)

---

## Task 1: Prisma Schema + Migration

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Address model and update User + UserPrivacyAuditLog in schema.prisma**

Add these changes to `prisma/schema.prisma`:

1. Add `allowFindByAddress` and `address` relation to User model (after line 37):

```prisma
  allowFindByAddress    Boolean   @default(false) @map("allow_find_by_address")

  // Relations
  address            Address?
```

2. Add Address model (after the User model, before Session):

```prisma
model Address {
  id         String   @id @default(cuid())
  userId     String   @unique @map("user_id")
  country    String
  region     String?
  city       String
  street     String
  building   String
  apartment  String?
  postalCode String?  @map("postal_code")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("addresses")
}
```

3. Add `allowFindByAddress` to UserPrivacyAuditLog model (after `allowFindByPhone` on line 440):

```prisma
  allowFindByAddress Boolean @map("allow_find_by_address")
```

- [ ] **Step 2: Generate and run migration**

Run:

```bash
yarn prisma migrate dev --name add-user-address
```

Expected: Migration creates `addresses` table, adds `allow_find_by_address` column to `users` and `user_privacy_audit_log`.

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
yarn prisma generate
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Address model and allowFindByAddress to schema"
```

---

## Task 2: Address Value Object

**Files:**

- Create: `src/domain/user/__tests__/Address.test.ts`
- Create: `src/domain/user/Address.ts`

- [ ] **Step 1: Write failing tests for Address value object**

Create `src/domain/user/__tests__/Address.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Address, AddressDomainCodes } from '../Address';

describe('Address', () => {
  const validProps = {
    country: 'Russia',
    city: 'Moscow',
    street: 'Tverskaya',
    building: '12',
  };

  describe('create', () => {
    it('should create address with all required fields', () => {
      const address = Address.create(validProps);

      expect(address.country).toBe('Russia');
      expect(address.city).toBe('Moscow');
      expect(address.street).toBe('Tverskaya');
      expect(address.building).toBe('12');
      expect(address.region).toBeUndefined();
      expect(address.apartment).toBeUndefined();
      expect(address.postalCode).toBeUndefined();
    });

    it('should create address with all optional fields', () => {
      const address = Address.create({
        ...validProps,
        region: 'Moscow Oblast',
        apartment: '45',
        postalCode: '125009',
      });

      expect(address.region).toBe('Moscow Oblast');
      expect(address.apartment).toBe('45');
      expect(address.postalCode).toBe('125009');
    });

    it('should handle Russian building formats', () => {
      const addr1 = Address.create({ ...validProps, building: '3/1' });
      expect(addr1.building).toBe('3/1');

      const addr2 = Address.create({ ...validProps, building: '5 к.1' });
      expect(addr2.building).toBe('5 к.1');

      const addr3 = Address.create({ ...validProps, building: '10 стр.2' });
      expect(addr3.building).toBe('10 стр.2');
    });

    it('should throw when country is empty', () => {
      expect(() => Address.create({ ...validProps, country: '' })).toThrow(
        AddressDomainCodes.COUNTRY_REQUIRED
      );
    });

    it('should throw when country is whitespace', () => {
      expect(() => Address.create({ ...validProps, country: '   ' })).toThrow(
        AddressDomainCodes.COUNTRY_REQUIRED
      );
    });

    it('should throw when city is empty', () => {
      expect(() => Address.create({ ...validProps, city: '' })).toThrow(
        AddressDomainCodes.CITY_REQUIRED
      );
    });

    it('should throw when street is empty', () => {
      expect(() => Address.create({ ...validProps, street: '' })).toThrow(
        AddressDomainCodes.STREET_REQUIRED
      );
    });

    it('should throw when building is empty', () => {
      expect(() => Address.create({ ...validProps, building: '' })).toThrow(
        AddressDomainCodes.BUILDING_REQUIRED
      );
    });
  });

  describe('equals', () => {
    it('should return true for same address', () => {
      const a = Address.create(validProps);
      const b = Address.create(validProps);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false when any field differs', () => {
      const a = Address.create(validProps);
      const b = Address.create({ ...validProps, building: '13' });
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toPlain', () => {
    it('should serialize to plain object', () => {
      const address = Address.create({
        ...validProps,
        region: 'Oblast',
        apartment: '5',
        postalCode: '123456',
      });

      const plain = address.toPlain();

      expect(plain).toEqual({
        country: 'Russia',
        region: 'Oblast',
        city: 'Moscow',
        street: 'Tverskaya',
        building: '12',
        apartment: '5',
        postalCode: '123456',
      });
    });

    it('should omit undefined optional fields', () => {
      const address = Address.create(validProps);
      const plain = address.toPlain();

      expect(plain.region).toBeUndefined();
      expect(plain.apartment).toBeUndefined();
      expect(plain.postalCode).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/domain/user/__tests__/Address.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Address value object**

Create `src/domain/user/Address.ts`:

```typescript
export const AddressDomainCodes = {
  COUNTRY_REQUIRED: 'domain.user.address.countryRequired',
  CITY_REQUIRED: 'domain.user.address.cityRequired',
  STREET_REQUIRED: 'domain.user.address.streetRequired',
  BUILDING_REQUIRED: 'domain.user.address.buildingRequired',
} as const;

export type AddressDomainCode =
  (typeof AddressDomainCodes)[keyof typeof AddressDomainCodes];

export interface AddressProps {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
}

export class Address {
  private constructor(private readonly props: AddressProps) {}

  static create(props: AddressProps): Address {
    if (!props.country?.trim()) {
      throw new Error(AddressDomainCodes.COUNTRY_REQUIRED);
    }

    if (!props.city?.trim()) {
      throw new Error(AddressDomainCodes.CITY_REQUIRED);
    }

    if (!props.street?.trim()) {
      throw new Error(AddressDomainCodes.STREET_REQUIRED);
    }

    if (!props.building?.trim()) {
      throw new Error(AddressDomainCodes.BUILDING_REQUIRED);
    }

    return new Address({
      country: props.country.trim(),
      region: props.region?.trim() || undefined,
      city: props.city.trim(),
      street: props.street.trim(),
      building: props.building.trim(),
      apartment: props.apartment?.trim() || undefined,
      postalCode: props.postalCode?.trim() || undefined,
    });
  }

  get country(): string {
    return this.props.country;
  }

  get region(): string | undefined {
    return this.props.region;
  }

  get city(): string {
    return this.props.city;
  }

  get street(): string {
    return this.props.street;
  }

  get building(): string {
    return this.props.building;
  }

  get apartment(): string | undefined {
    return this.props.apartment;
  }

  get postalCode(): string | undefined {
    return this.props.postalCode;
  }

  equals(other: Address): boolean {
    return (
      this.props.country === other.props.country &&
      this.props.region === other.props.region &&
      this.props.city === other.props.city &&
      this.props.street === other.props.street &&
      this.props.building === other.props.building &&
      this.props.apartment === other.props.apartment &&
      this.props.postalCode === other.props.postalCode
    );
  }

  toPlain(): AddressProps {
    return { ...this.props };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/user/__tests__/Address.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/user/Address.ts src/domain/user/__tests__/Address.test.ts
git commit -m "feat: add Address value object"
```

---

## Task 3: User Domain Entity — address + allowFindByAddress

**Files:**

- Modify: `src/domain/user/User.ts`
- Modify: `src/domain/user/__tests__/User.test.ts`

- [ ] **Step 1: Write failing tests for User address and allowFindByAddress**

Add to `src/domain/user/__tests__/User.test.ts` inside the `describe('privacy settings', ...)` block, after the existing `completePrivacySetup` test (after line 414):

```typescript
it('should create user with default allowFindByAddress (false)', () => {
  const user = User.create(validProps);
  expect(user.allowFindByAddress).toBe(false);
});

it('should reconstitute user with allowFindByAddress', () => {
  const user = User.reconstitute({
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword123',
    language: 'en' as const,
    createdAt: new Date('2024-01-01'),
    allowFindByAddress: true,
  });
  expect(user.allowFindByAddress).toBe(true);
});

it('should update allowFindByAddress via updatePrivacySettings', () => {
  const user = User.create(validProps);
  const updated = user.updatePrivacySettings({
    allowFindByAddress: true,
  });
  expect(updated.allowFindByAddress).toBe(true);
  expect(updated.allowFindByName).toBe(false); // unchanged
});

it('should preserve allowFindByAddress when not provided', () => {
  const user = User.reconstitute({
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword123',
    language: 'en' as const,
    createdAt: new Date('2024-01-01'),
    allowFindByAddress: true,
  });
  const updated = user.updatePrivacySettings({ allowFindByName: true });
  expect(updated.allowFindByAddress).toBe(true);
});
```

Add a new `describe('address', ...)` block after the `privacy settings` describe (after line 415):

```typescript
describe('address', () => {
  it('should create user with no address', () => {
    const user = User.create(validProps);
    expect(user.address).toBeUndefined();
  });

  it('should reconstitute user with address', () => {
    const address = Address.create({
      country: 'Russia',
      city: 'Moscow',
      street: 'Tverskaya',
      building: '12',
    });
    const user = User.reconstitute({
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hashedpassword123',
      language: 'en' as const,
      createdAt: new Date('2024-01-01'),
      address,
    });
    expect(user.address).toBeDefined();
    expect(user.address!.city).toBe('Moscow');
  });

  it('should update address', () => {
    const user = User.create(validProps);
    const address = Address.create({
      country: 'Russia',
      city: 'Moscow',
      street: 'Tverskaya',
      building: '12',
    });
    const updated = user.updateAddress(address);
    expect(updated.address).toBeDefined();
    expect(updated.address!.street).toBe('Tverskaya');
    // original unchanged
    expect(user.address).toBeUndefined();
  });

  it('should clear address with undefined', () => {
    const address = Address.create({
      country: 'Russia',
      city: 'Moscow',
      street: 'Tverskaya',
      building: '12',
    });
    const user = User.reconstitute({
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hashedpassword123',
      language: 'en' as const,
      createdAt: new Date('2024-01-01'),
      address,
    });
    const updated = user.updateAddress(undefined);
    expect(updated.address).toBeUndefined();
  });
});
```

Add `Address` import at the top of the test file (after line 9):

```typescript
import { Address } from '../Address';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/domain/user/__tests__/User.test.ts`
Expected: FAIL — `allowFindByAddress` and `address` not found on User

- [ ] **Step 3: Update User entity**

In `src/domain/user/User.ts`:

1. Add import (after line 2):

```typescript
import { Address } from './Address';
```

2. Add `address` and `allowFindByAddress` to `UserProps` interface (after line 33, before `confirmedAt`):

```typescript
  allowFindByAddress: boolean;
  address?: Address;
```

3. In `User.create()`, add to the returned object (after line 174, `allowFindByPhone: false,`):

```typescript
      allowFindByAddress: false,
```

4. In `User.reconstitute()`, add to the Omit+Partial type (after `'privacySetupCompleted'` on line 193):

```typescript
          | 'allowFindByAddress'
          | 'address'
```

5. In `User.reconstitute()` body (after line 201, `allowFindByPhone`):

```typescript
      allowFindByAddress: props.allowFindByAddress ?? false,
      address: props.address,
```

6. Add getter (after `allowFindByPhone` getter, after line 252):

```typescript
  get allowFindByAddress(): boolean {
    return this.props.allowFindByAddress;
  }

  get address(): Address | undefined {
    return this.props.address;
  }
```

7. Update `updatePrivacySettings` method (replace lines 320-330):

```typescript
  updatePrivacySettings(settings: {
    allowFindByName?: boolean;
    allowFindByPhone?: boolean;
    allowFindByAddress?: boolean;
  }): User {
    return new User({
      ...this.props,
      allowFindByName: settings.allowFindByName ?? this.props.allowFindByName,
      allowFindByPhone:
        settings.allowFindByPhone ?? this.props.allowFindByPhone,
      allowFindByAddress:
        settings.allowFindByAddress ?? this.props.allowFindByAddress,
    });
  }
```

8. Add `updateAddress` method (after `updateNickname`, after line 337):

```typescript
  updateAddress(address: Address | undefined): User {
    return new User({
      ...this.props,
      address,
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/user/__tests__/User.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/user/User.ts src/domain/user/__tests__/User.test.ts
git commit -m "feat: add address and allowFindByAddress to User entity"
```

---

## Task 4: Application Layer — Use Cases + Schemas

**Files:**

- Modify: `src/application/user/UpdateUserProfileSchema.ts`
- Modify: `src/application/user/UpdateUserProfileUseCase.ts`
- Modify: `src/application/user/CompletePrivacySetupSchema.ts`
- Modify: `src/application/user/CompletePrivacySetupUseCase.ts`
- Modify: `src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`

- [ ] **Step 1: Write failing tests for address in UpdateUserProfileUseCase**

Add to `src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`, inside `describe('execute', ...)`, after the last test (after line 233):

```typescript
it('should update address when provided', async () => {
  vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
  vi.mocked(userRepository.save).mockImplementation((user) =>
    Promise.resolve(user)
  );

  const result = await useCase.execute({
    userId: 'user-123',
    address: {
      country: 'Russia',
      city: 'Moscow',
      street: 'Tverskaya',
      building: '12',
    },
  });

  expect(result.success).toBe(true);

  if (result.success) {
    expect(result.value.address).toBeDefined();
    expect(result.value.address!.city).toBe('Moscow');
  }
});

it('should clear address when address is null', async () => {
  const userWithAddress = User.reconstitute({
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword',
    language: 'en',
    createdAt: new Date('2024-01-01'),
    nickname: Nickname.create('john_doe_123'),
    allowFindByName: false,
    allowFindByPhone: false,
    privacySetupCompleted: true,
    address: Address.create({
      country: 'Russia',
      city: 'Moscow',
      street: 'Tverskaya',
      building: '12',
    }),
  });

  vi.mocked(userRepository.findById).mockResolvedValue(userWithAddress);
  vi.mocked(userRepository.deleteAddress).mockResolvedValue();
  vi.mocked(userRepository.save).mockImplementation((user) =>
    Promise.resolve(user)
  );

  const result = await useCase.execute({
    userId: 'user-123',
    address: null,
  });

  expect(result.success).toBe(true);

  if (result.success) {
    expect(result.value.address).toBeUndefined();
  }

  expect(userRepository.deleteAddress).toHaveBeenCalledWith('user-123');
});

it('should update allowFindByAddress via privacy settings', async () => {
  vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
  vi.mocked(userRepository.updatePrivacySettings).mockResolvedValue();
  vi.mocked(userRepository.save).mockImplementation((user) =>
    Promise.resolve(user)
  );

  const result = await useCase.execute({
    userId: 'user-123',
    allowFindByAddress: true,
  });

  expect(result.success).toBe(true);

  if (result.success) {
    expect(result.value.allowFindByAddress).toBe(true);
  }

  expect(userRepository.updatePrivacySettings).toHaveBeenCalled();
});

it('should return failure for invalid address (missing city)', async () => {
  vi.mocked(userRepository.findById).mockResolvedValue(existingUser);

  const result = await useCase.execute({
    userId: 'user-123',
    address: {
      country: 'Russia',
      city: '',
      street: 'Tverskaya',
      building: '12',
    },
  });

  expect(result.success).toBe(false);
});
```

Add `Address` import at top of test file (after line 5):

```typescript
import { Address } from '@/src/domain/user/Address';
```

Add `deleteAddress` to the mock `beforeEach` (after the existing `updatePrivacySettings: vi.fn(),` line):

```typescript
      deleteAddress: vi.fn(),
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`
Expected: FAIL — `address` not in input type

- [ ] **Step 3: Update UpdateUserProfileSchema**

In `src/application/user/UpdateUserProfileSchema.ts`, add after line 23 (`allowFindByPhone: z.boolean().optional(),`):

```typescript
    allowFindByAddress: z.boolean().optional(),
    address: z
      .object({
        country: z.string().min(1),
        region: z.string().optional(),
        city: z.string().min(1),
        street: z.string().min(1),
        building: z.string().min(1),
        apartment: z.string().optional(),
        postalCode: z.string().optional(),
      })
      .nullable()
      .optional(),
```

- [ ] **Step 4: Update UpdateUserProfileUseCase**

In `src/application/user/UpdateUserProfileUseCase.ts`:

1. Add import (after line 7):

```typescript
import { Address, type AddressProps } from '@/src/domain/user/Address';
```

2. Add to `UpdateUserProfileInput` interface (after line 14, `allowFindByPhone`):

```typescript
  allowFindByAddress?: boolean;
  address?: AddressProps | null;
```

3. Add address handling after nickname block (after line 62, before privacy settings):

```typescript
// Update address if provided
if (input.address !== undefined) {
  if (input.address === null) {
    updatedUser = updatedUser.updateAddress(undefined);
    await this.userRepository.deleteAddress(user.id);
  } else {
    try {
      const address = Address.create(input.address);
      updatedUser = updatedUser.updateAddress(address);
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : 'domain.user.address.invalid'
      );
    }
  }
}
```

4. Update privacy change detection (add after `phoneChanged` on line 70):

```typescript
const addressPrivacyChanged =
  input.allowFindByAddress !== undefined &&
  input.allowFindByAddress !== user.allowFindByAddress;
```

5. Update the privacy conditional (replace line 72):

```typescript
    if (nameChanged || phoneChanged || addressPrivacyChanged) {
      updatedUser = updatedUser.updatePrivacySettings({
        allowFindByName: input.allowFindByName,
        allowFindByPhone: input.allowFindByPhone,
        allowFindByAddress: input.allowFindByAddress,
      });
```

- [ ] **Step 5: Update CompletePrivacySetupSchema**

In `src/application/user/CompletePrivacySetupSchema.ts`, add after line 24 (`allowFindByPhone: z.boolean(),`):

```typescript
    allowFindByAddress: z.boolean(),
```

- [ ] **Step 6: Update CompletePrivacySetupUseCase**

In `src/application/user/CompletePrivacySetupUseCase.ts`:

1. Add to `CompletePrivacySetupInput` (after line 12, `allowFindByPhone`):

```typescript
allowFindByAddress: boolean;
```

2. Update privacy settings call (replace line 60-63):

```typescript
updatedUser = updatedUser.updatePrivacySettings({
  allowFindByName: input.allowFindByName,
  allowFindByPhone: input.allowFindByPhone,
  allowFindByAddress: input.allowFindByAddress,
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `yarn vitest run src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`
Expected: All tests PASS

Run: `yarn vitest run src/application/user/`
Expected: All tests PASS (including CompletePrivacySetupUseCase tests)

- [ ] **Step 8: Commit**

```bash
git add src/application/user/
git commit -m "feat: add address and allowFindByAddress to use cases"
```

---

## Task 5: Infrastructure — Repository

**Files:**

- Modify: `src/infrastructure/repositories/PrismaUserRepository.ts`

- [ ] **Step 1: Update USER_SELECT to include address relation**

In `PrismaUserRepository.ts`, replace the `USER_SELECT` constant (lines 7-22):

```typescript
const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  phoneNumber: true,
  password: true,
  language: true,
  consentGivenAt: true,
  createdAt: true,
  nickname: true,
  allowFindByName: true,
  allowFindByPhone: true,
  allowFindByAddress: true,
  privacySetupCompleted: true,
  confirmedAt: true,
  address: {
    select: {
      id: true,
      country: true,
      region: true,
      city: true,
      street: true,
      building: true,
      apartment: true,
      postalCode: true,
    },
  },
} as const;
```

- [ ] **Step 2: Add Address import**

Add import at top (after line 4):

```typescript
import { Address } from '@/domain/user/Address';
```

- [ ] **Step 3: Update save() method to handle address upsert**

In the `save()` method, add address handling. In the `create` block (after line 100, `confirmedAt`):

```typescript
        ...(user.address
          ? {
              address: {
                create: {
                  country: user.address.country,
                  region: user.address.region,
                  city: user.address.city,
                  street: user.address.street,
                  building: user.address.building,
                  apartment: user.address.apartment,
                  postalCode: user.address.postalCode,
                },
              },
            }
          : {}),
```

In the `update` block (after line 110, `nickname`):

```typescript
        ...(user.address
          ? {
              address: {
                upsert: {
                  create: {
                    country: user.address.country,
                    region: user.address.region,
                    city: user.address.city,
                    street: user.address.street,
                    building: user.address.building,
                    apartment: user.address.apartment,
                    postalCode: user.address.postalCode,
                  },
                  update: {
                    country: user.address.country,
                    region: user.address.region,
                    city: user.address.city,
                    street: user.address.street,
                    building: user.address.building,
                    apartment: user.address.apartment,
                    postalCode: user.address.postalCode,
                  },
                },
              },
            }
          : {}),
```

Note: When address is undefined, we don't touch it in `save()`. Address deletion is handled via `deleteAddress()` — see step 5.

- [ ] **Step 4: Update updatePrivacySettings() to include allowFindByAddress**

Replace the transaction (lines 119-137):

```typescript
  async updatePrivacySettings(user: User): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          allowFindByName: user.allowFindByName,
          allowFindByPhone: user.allowFindByPhone,
          allowFindByAddress: user.allowFindByAddress,
          privacySetupCompleted: user.privacySetupCompleted,
          nickname: user.nickname.getValue(),
        },
      }),
      this.prisma.userPrivacyAuditLog.create({
        data: {
          userId: user.id,
          allowFindByName: user.allowFindByName,
          allowFindByPhone: user.allowFindByPhone,
          allowFindByAddress: user.allowFindByAddress,
        },
      }),
    ]);
  }
```

- [ ] **Step 5: Add deleteAddress() method**

Add to `PrismaUserRepository`:

```typescript
  async deleteAddress(userId: string): Promise<void> {
    await this.prisma.address.deleteMany({ where: { userId } });
  }
```

Add to `src/domain/user/UserRepository.ts` interface (after `updatePrivacySettings`):

```typescript
  deleteAddress(userId: string): Promise<void>;
```

- [ ] **Step 6: Update searchUsers() to support address filtering**

Update the method signature (replace lines 147-149):

```typescript
  async searchUsers(
    query: string,
    options?: { respectPrivacy?: boolean; city?: string; street?: string }
  ): Promise<User[]> {
```

Add address filtering inside the `if (respectPrivacy)` block (after the `nicknameCondition` entry in the `OR` array, after line 175):

```typescript
          // Users findable by address (opted in, matching city/street)
          ...(options?.city
            ? [
                {
                  AND: [
                    { allowFindByAddress: true },
                    {
                      address: {
                        city: { contains: options.city, mode: 'insensitive' as const },
                        ...(options?.street
                          ? {
                              street: {
                                contains: options.street,
                                mode: 'insensitive' as const,
                              },
                            }
                          : {}),
                      },
                    },
                  ],
                },
              ]
            : []),
```

- [ ] **Step 7: Update toDomain() to reconstitute address**

Update the `toDomain` method parameter type (add after `confirmedAt` field, line 302):

```typescript
    address: {
      id: string;
      country: string;
      region: string | null;
      city: string;
      street: string;
      building: string;
      apartment: string | null;
      postalCode: string | null;
    } | null;
```

Add `allowFindByAddress` to the parameter type (after `allowFindByPhone`, line 300):

```typescript
allowFindByAddress: boolean;
```

In the `User.reconstitute()` call inside toDomain, add (after `allowFindByPhone`, line 320):

```typescript
      allowFindByAddress: user.allowFindByAddress,
      address: user.address
        ? Address.create({
            country: user.address.country,
            region: user.address.region ?? undefined,
            city: user.address.city,
            street: user.address.street,
            building: user.address.building,
            apartment: user.address.apartment ?? undefined,
            postalCode: user.address.postalCode ?? undefined,
          })
        : undefined,
```

- [ ] **Step 8: Update UserRepository interface (searchUsers)**

In `src/domain/user/UserRepository.ts`, update `searchUsers` signature (replace lines 14-17):

```typescript
  searchUsers(
    query: string,
    options?: { respectPrivacy?: boolean; city?: string; street?: string }
  ): Promise<User[]>;
```

- [ ] **Step 9: Commit**

```bash
git add src/infrastructure/repositories/PrismaUserRepository.ts src/domain/user/UserRepository.ts
git commit -m "feat: add address support to PrismaUserRepository"
```

---

## Task 6: Localization

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Add address and privacy keys to en.json**

In the `"account"` section of `messages/en.json`, add after `"allowFindByPhoneDescription"` (line 168):

```json
    "allowFindByAddressLabel": "Allow others to find me by address",
    "allowFindByAddressDescription": "Others will be able to find you by your city and street to invite you to organizations.",
    "addressSection": "Address",
    "addressSearchPlaceholder": "Start typing your address...",
    "addressSearching": "Searching...",
    "addressNoResults": "No results found",
    "addressFillManually": "Fill in manually",
    "addressCountry": "Country",
    "addressRegion": "Region / State",
    "addressCity": "City",
    "addressStreet": "Street",
    "addressBuilding": "Building / House",
    "addressApartment": "Apartment / Unit",
    "addressPostalCode": "Postal Code",
    "addressSave": "Save Address",
    "addressSaving": "Saving...",
    "addressSuccess": "Address updated successfully",
    "addressClear": "Clear address",
```

In the `"privacySetup"` section, add after `"allowFindByPhoneDescription"` (line 1399):

```json
    "allowFindByAddressLabel": "Allow others to find me by address",
    "allowFindByAddressDescription": "Others will be able to find you by your city and street to invite you to organizations.",
```

Add domain error codes to the `"domain"` → `"user"` section (find the section with `userNotFound`, `nicknameTaken`, etc.):

```json
      "address": {
        "countryRequired": "Country is required",
        "cityRequired": "City is required",
        "streetRequired": "Street is required",
        "buildingRequired": "Building is required"
      }
```

- [ ] **Step 2: Add address and privacy keys to ru.json**

In the `"account"` section of `messages/ru.json`, add after `"allowFindByPhoneDescription"` (line 168):

```json
    "allowFindByAddressLabel": "Разрешить находить меня по адресу",
    "allowFindByAddressDescription": "Другие смогут найти вас по городу и улице для приглашения в организации.",
    "addressSection": "Адрес",
    "addressSearchPlaceholder": "Начните вводить адрес...",
    "addressSearching": "Поиск...",
    "addressNoResults": "Ничего не найдено",
    "addressFillManually": "Заполнить вручную",
    "addressCountry": "Страна",
    "addressRegion": "Область / Регион",
    "addressCity": "Город",
    "addressStreet": "Улица",
    "addressBuilding": "Дом / Строение",
    "addressApartment": "Квартира",
    "addressPostalCode": "Почтовый индекс",
    "addressSave": "Сохранить адрес",
    "addressSaving": "Сохранение...",
    "addressSuccess": "Адрес успешно обновлён",
    "addressClear": "Очистить адрес",
```

In the `"privacySetup"` section, add after `"allowFindByPhoneDescription"`:

```json
    "allowFindByAddressLabel": "Разрешить находить меня по адресу",
    "allowFindByAddressDescription": "Другие смогут найти вас по городу и улице для приглашения в организации.",
```

Add domain error codes to the `"domain"` → `"user"` section:

```json
      "address": {
        "countryRequired": "Укажите страну",
        "cityRequired": "Укажите город",
        "streetRequired": "Укажите улицу",
        "buildingRequired": "Укажите дом"
      }
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/ru.json
git commit -m "feat: add address localization keys"
```

---

## Task 7: Server Action

**Files:**

- Modify: `src/web/actions/user/user.ts`

- [ ] **Step 1: Update updateProfileAction to handle address fields**

In `src/web/actions/user/user.ts`:

1. Add address extraction after `allowFindByPhoneValue` (after line 67):

```typescript
const allowFindByAddressValue = formData.get('allowFindByAddress');

// Address fields — present when user submits the address form
const addressCountry = formData.get('addressCountry');
const addressAction = formData.get('addressAction'); // 'save' | 'clear' | absent
```

2. Add to the `input` object (after `allowFindByPhone`, after line 80):

```typescript
      allowFindByAddress:
        allowFindByAddressValue !== null
          ? allowFindByAddressValue === 'true'
          : undefined,
      address:
        addressAction === 'clear'
          ? null
          : addressCountry
            ? {
                country: String(formData.get('addressCountry')),
                region: formData.get('addressRegion')
                  ? String(formData.get('addressRegion'))
                  : undefined,
                city: String(formData.get('addressCity')),
                street: String(formData.get('addressStreet')),
                building: String(formData.get('addressBuilding')),
                apartment: formData.get('addressApartment')
                  ? String(formData.get('addressApartment'))
                  : undefined,
                postalCode: formData.get('addressPostalCode')
                  ? String(formData.get('addressPostalCode'))
                  : undefined,
              }
            : undefined,
```

- [ ] **Step 2: Update completePrivacySetupAction to handle allowFindByAddress**

In `completePrivacySetupAction`, add extraction (after line 147, `allowFindByPhoneValue`):

```typescript
const allowFindByAddressValue = formData.get('allowFindByAddress');
```

Add to input object (after `allowFindByPhone`, line 153):

```typescript
      allowFindByAddress: allowFindByAddressValue === 'true',
```

- [ ] **Step 3: Commit**

```bash
git add src/web/actions/user/user.ts
git commit -m "feat: handle address fields in server actions"
```

---

## Task 8: Nominatim Autocomplete Component

**Files:**

- Create: `src/web/components/account/AddressSearch.tsx`

- [ ] **Step 1: Create AddressSearch component**

Create `src/web/components/account/AddressSearch.tsx`:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/src/web/components/catalyst/input';

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    country?: string;
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
    suburb?: string;
    county?: string;
  };
}

export interface AddressFields {
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  postalCode: string;
}

type Props = {
  locale: string;
  onSelect: (fields: Partial<AddressFields>) => void;
  disabled?: boolean;
};

export function AddressSearch({ locale, onSelect, disabled }: Props) {
  const t = useTranslations('account');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 3) {
        setResults([]);
        setShowDropdown(false);

        return;
      }

      setIsSearching(true);

      try {
        const params = new URLSearchParams({
          q,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '5',
        });

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            headers: {
              'Accept-Language': locale,
            },
          }
        );

        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // Silently fail — user can fill manually
      } finally {
        setIsSearching(false);
      }
    },
    [locale]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      search(value);
    }, 300);
  }

  function handleSelect(result: NominatimResult) {
    const addr = result.address;
    onSelect({
      country: addr.country || '',
      region: addr.state || '',
      city: addr.city || addr.town || addr.village || '',
      street: addr.road || '',
      building: addr.house_number || '',
      postalCode: addr.postcode || '',
    });
    setQuery(result.display_name);
    setShowDropdown(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        onChange={handleInputChange}
        placeholder={t('addressSearchPlaceholder')}
        disabled={disabled}
      />
      {isSearching && (
        <p className="mt-1 text-sm text-zinc-500">{t('addressSearching')}</p>
      )}
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.map((result) => (
            <li key={result.place_id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => handleSelect(result)}
              >
                {result.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showDropdown &&
        results.length === 0 &&
        !isSearching &&
        query.length >= 3 && (
          <p className="mt-1 text-sm text-zinc-500">{t('addressNoResults')}</p>
        )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/web/components/account/AddressSearch.tsx
git commit -m "feat: add AddressSearch Nominatim autocomplete component"
```

---

## Task 9: AccountForm + Account Page

**Files:**

- Modify: `src/web/components/account/AccountForm.tsx`
- Modify: `src/app/[locale]/account/page.tsx`

- [ ] **Step 1: Update AccountForm Props type**

In `AccountForm.tsx`, update the `Props` type (lines 20-33) to include address and new toggle:

```typescript
type AddressData = {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
};

type Props = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    phoneNumber: string;
    language: string;
    createdAt: Date;
    nickname: string;
    allowFindByName: boolean;
    allowFindByPhone: boolean;
    allowFindByAddress: boolean;
    address?: AddressData | null;
  };
  locale: string;
};
```

- [ ] **Step 2: Add address form state and imports**

Add import for AddressSearch (after line 16):

```typescript
import { AddressSearch, type AddressFields } from './AddressSearch';
```

Update the component signature (line 35):

```typescript
export function AccountForm({ user, locale }: Props) {
```

Add address form state inside the component (after `privValues` state, after line 56):

```typescript
// --- Address form state ---
const [isAddrPending, startAddrTransition] = useTransition();
const [addrError, setAddrError] = useState<string | null>(null);
const [addrSuccess, setAddrSuccess] = useState<string | null>(null);
const [showManualAddress, setShowManualAddress] = useState(!!user.address);
const [addrValues, setAddrValues] = useState<AddressFields>({
  country: user.address?.country || '',
  region: user.address?.region || '',
  city: user.address?.city || '',
  street: user.address?.street || '',
  building: user.address?.building || '',
  apartment: user.address?.apartment || '',
  postalCode: user.address?.postalCode || '',
});
```

Add address change detection (after `privacyChanged`, after line 64):

```typescript
const hasAddress =
  addrValues.country.trim() !== '' ||
  addrValues.city.trim() !== '' ||
  addrValues.street.trim() !== '';

const addressChanged =
  addrValues.country !== (user.address?.country || '') ||
  addrValues.region !== (user.address?.region || '') ||
  addrValues.city !== (user.address?.city || '') ||
  addrValues.street !== (user.address?.street || '') ||
  addrValues.building !== (user.address?.building || '') ||
  addrValues.apartment !== (user.address?.apartment || '') ||
  addrValues.postalCode !== (user.address?.postalCode || '');
```

Add privacy values for `allowFindByAddress` — update `privValues` initial state (line 53-56):

```typescript
const [privValues, setPrivValues] = useState({
  allowFindByName: user.allowFindByName,
  allowFindByPhone: user.allowFindByPhone,
  allowFindByAddress: user.allowFindByAddress,
});
```

Update `privacyChanged` (lines 62-64):

```typescript
const privacyChanged =
  privValues.allowFindByName !== user.allowFindByName ||
  privValues.allowFindByPhone !== user.allowFindByPhone ||
  privValues.allowFindByAddress !== user.allowFindByAddress;
```

- [ ] **Step 3: Add address form handlers**

Add after `handlePrivSubmit` (after line 136):

```typescript
function handleAddrFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
  const { name, value } = e.target;
  setAddrValues((prev) => ({ ...prev, [name]: value }));

  if (addrError) {
    setAddrError(null);
  }

  if (addrSuccess) {
    setAddrSuccess(null);
  }
}

function handleNominatimSelect(fields: Partial<AddressFields>) {
  setAddrValues((prev) => ({ ...prev, ...fields }));
  setShowManualAddress(true);

  if (addrError) {
    setAddrError(null);
  }

  if (addrSuccess) {
    setAddrSuccess(null);
  }
}

async function handleAddrSubmit(e: React.FormEvent) {
  e.preventDefault();
  setAddrError(null);
  setAddrSuccess(null);

  const formData = new FormData();
  formData.set('addressAction', 'save');
  formData.set('addressCountry', addrValues.country);
  formData.set('addressRegion', addrValues.region);
  formData.set('addressCity', addrValues.city);
  formData.set('addressStreet', addrValues.street);
  formData.set('addressBuilding', addrValues.building);
  formData.set('addressApartment', addrValues.apartment);
  formData.set('addressPostalCode', addrValues.postalCode);

  startAddrTransition(async () => {
    const result = await updateProfileAction(formData);

    if (!result.success) {
      setAddrError(result.error);
    } else {
      setAddrSuccess(t('addressSuccess'));
    }
  });
}

async function handleAddrClear() {
  setAddrError(null);
  setAddrSuccess(null);

  const formData = new FormData();
  formData.set('addressAction', 'clear');

  startAddrTransition(async () => {
    const result = await updateProfileAction(formData);

    if (!result.success) {
      setAddrError(result.error);
    } else {
      setAddrValues({
        country: '',
        region: '',
        city: '',
        street: '',
        building: '',
        apartment: '',
        postalCode: '',
      });
      setShowManualAddress(false);
      setAddrSuccess(t('addressSuccess'));
    }
  });
}
```

- [ ] **Step 4: Add address section JSX**

In the `return` JSX, add the address section between the preferences form and the privacy section (after `</form>` on line 184, before the privacy `<div>` on line 187):

```tsx
{
  /* Address section */
}
<div className="border-t border-zinc-200 pt-8 dark:border-zinc-700">
  <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
    {t('addressSection')}
  </h3>

  <form onSubmit={handleAddrSubmit} className="space-y-8">
    {addrError && <AlertBanner color="red">{addrError}</AlertBanner>}
    {addrSuccess && <AlertBanner color="green">{addrSuccess}</AlertBanner>}

    <FieldGroup>
      <Field>
        <Label>{t('addressSearchPlaceholder')}</Label>
        <AddressSearch
          locale={locale}
          onSelect={handleNominatimSelect}
          disabled={isAddrPending}
        />
        {!showManualAddress && (
          <button
            type="button"
            className="mt-2 text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
            onClick={() => setShowManualAddress(true)}
          >
            {t('addressFillManually')}
          </button>
        )}
      </Field>

      {showManualAddress && (
        <>
          <Field>
            <Label>{t('addressCountry')}</Label>
            <Input
              name="country"
              value={addrValues.country}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>

          <Field>
            <Label>{t('addressRegion')}</Label>
            <Input
              name="region"
              value={addrValues.region}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>

          <Field>
            <Label>{t('addressCity')}</Label>
            <Input
              name="city"
              value={addrValues.city}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>

          <Field>
            <Label>{t('addressStreet')}</Label>
            <Input
              name="street"
              value={addrValues.street}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>

          <Field>
            <Label>{t('addressBuilding')}</Label>
            <Input
              name="building"
              value={addrValues.building}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>

          <Field>
            <Label>{t('addressApartment')}</Label>
            <Input
              name="apartment"
              value={addrValues.apartment}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>

          <Field>
            <Label>{t('addressPostalCode')}</Label>
            <Input
              name="postalCode"
              value={addrValues.postalCode}
              onChange={handleAddrFieldChange}
              disabled={isAddrPending}
            />
          </Field>
        </>
      )}
    </FieldGroup>

    <div className="flex justify-end gap-3">
      {user.address && (
        <Button
          type="button"
          color="red"
          onClick={handleAddrClear}
          disabled={isAddrPending}
        >
          {t('addressClear')}
        </Button>
      )}
      <Button
        type="submit"
        disabled={isAddrPending || !addressChanged || !hasAddress}
      >
        {isAddrPending ? t('addressSaving') : t('addressSave')}
      </Button>
    </div>
  </form>
</div>;
```

- [ ] **Step 5: Add allowFindByAddress toggle to privacy section**

In the privacy section JSX, add a new `SwitchField` after the `allowFindByPhone` switch (after line 245, before `</FieldGroup>`):

```tsx
<SwitchField>
  <Label>{t('allowFindByAddressLabel')}</Label>
  <Description>{t('allowFindByAddressDescription')}</Description>
  <Switch
    color="brand-green"
    checked={privValues.allowFindByAddress}
    onChange={(checked) => {
      setPrivValues((prev) => ({
        ...prev,
        allowFindByAddress: checked,
      }));

      if (privError) {
        setPrivError(null);
      }

      if (privSuccess) {
        setPrivSuccess(null);
      }
    }}
    disabled={isPrivPending}
  />
</SwitchField>
```

Update `handlePrivSubmit` to include `allowFindByAddress` (after line 125):

```typescript
formData.set('allowFindByAddress', String(privValues.allowFindByAddress));
```

- [ ] **Step 6: Update account page to pass address and locale**

In `src/app/[locale]/account/page.tsx`, update the `AccountForm` props (lines 83-96):

```tsx
<AccountForm
  user={{
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    phoneNumber: user.phoneNumber.toString(),
    language: user.language,
    createdAt: user.createdAt,
    nickname: user.nickname.getValue(),
    allowFindByName: user.allowFindByName,
    allowFindByPhone: user.allowFindByPhone,
    allowFindByAddress: user.allowFindByAddress,
    address: user.address
      ? {
          country: user.address.country,
          region: user.address.region,
          city: user.address.city,
          street: user.address.street,
          building: user.address.building,
          apartment: user.address.apartment,
          postalCode: user.address.postalCode,
        }
      : null,
  }}
  locale={user.language}
/>
```

- [ ] **Step 7: Commit**

```bash
git add src/web/components/account/AccountForm.tsx src/app/[locale]/account/page.tsx
git commit -m "feat: add address section and privacy toggle to AccountForm"
```

---

## Task 10: PrivacySetupForm

**Files:**

- Modify: `src/web/components/privacy/PrivacySetupForm.tsx`

- [ ] **Step 1: Add allowFindByAddress toggle to PrivacySetupForm**

In `src/web/components/privacy/PrivacySetupForm.tsx`:

1. Update `formValues` initial state (lines 30-34):

```typescript
const [formValues, setFormValues] = useState({
  nickname,
  allowFindByName: false,
  allowFindByPhone: false,
  allowFindByAddress: false,
});
```

2. Add to `handleSubmit` FormData (after line 43, `allowFindByPhone`):

```typescript
formData.set('allowFindByAddress', String(formValues.allowFindByAddress));
```

3. Add new SwitchField JSX after the `allowFindByPhone` switch (after line 108, before `</FieldGroup>`):

```tsx
<SwitchField>
  <Label>{t('allowFindByAddressLabel')}</Label>
  <Description>{t('allowFindByAddressDescription')}</Description>
  <Switch
    color="brand-green"
    checked={formValues.allowFindByAddress}
    onChange={(checked) =>
      setFormValues((prev) => ({ ...prev, allowFindByAddress: checked }))
    }
    disabled={isPending}
  />
</SwitchField>
```

- [ ] **Step 2: Commit**

```bash
git add src/web/components/privacy/PrivacySetupForm.tsx
git commit -m "feat: add allowFindByAddress to PrivacySetupForm"
```

---

## Unresolved Questions

None — all decisions made during brainstorming.
