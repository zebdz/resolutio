# Address: DaData provider + required apartment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `readmes/2026-08-06-address-dadata-design.md`

**Goal:** Replace Nominatim with DaData as the primary address provider so apartments can be suggested, and make the apartment field required unless the user declares «Частный дом».

**Architecture:** DaData becomes the primary suggestion provider behind a server-side route handler (the API token must never reach the browser); Nominatim stays as a fallback used only when DaData returns zero results. `Address` gains an `isPrivateHouse` flag plus ГАР provenance (`oneLine`, `houseFiasId`, `flatFiasId`), and enforces "apartment required unless private house" as a domain invariant.

**Tech Stack:** Prisma (migration), Zod (validation), DaData suggestions API, Nominatim (fallback), React, next-intl, Vitest.

## Global Constraints

- Package manager is **yarn**. Test runner is **Vitest** (`yarn test`).
- **Committing is authorized for this work only**, on branch `sesolaga/dadata`, one commit
  per task. This is a scoped exception to the project's standing "never commit" rule —
  it does not carry to any other branch or task. Never commit to `dev` or `master`.
- After `prisma migrate dev`, always run `yarn prisma:generate` — this repo does not regenerate the client automatically.
- All user-facing strings come from `messages/en.json` and `messages/ru.json`. No hardcoded UI text.
- Domain and use cases return **codes**, never messages. Server actions translate via `translateErrorCode` from `@/web/actions/utils/translateErrorCode`.
- Every server action starts with `checkRateLimit()`. Route handlers do the same.
- No raw SQL in `web/actions/` — Prisma query builder or repository methods only.
- All DaData requests send `language: "ru"` and `locations: [{ country: "*" }]`. Stored addresses are always Russian.
- Clickable native `<button>`/`<a>` need `cursor-pointer` (Tailwind v4 default is `default`).
- At the end of each phase: mark the phase complete in this file, then stop for review.

---

## File Map

### Phase 1 — Domain & persistence — ✅ COMPLETE (2026-08-07)

Commits: 17569bc (schema+migration+backfill), 6ef8e90 (domain invariant),
0da2943 (persistence round-trip), 670f8ad (Zod validation + action wiring).
All four tasks reviewed clean. 256 test files / 2727 tests passing.

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_address_private_house_and_fias/migration.sql`
- Modify: `src/domain/user/Address.ts`
- Modify: `src/domain/user/__tests__/Address.test.ts`
- Modify: `src/domain/user/__tests__/User.test.ts`
- Modify: `src/infrastructure/repositories/PrismaUserRepository.ts`
- Modify: `src/application/user/UpdateUserProfileSchema.ts`
- Modify: `src/application/user/UpdateUserProfileUseCase.ts`
- Modify: `src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`
- Modify: `src/web/actions/user/user.ts`
- Modify: `messages/en.json`, `messages/ru.json`

### Phase 2 — Address providers

- Create: `src/infrastructure/address/types.ts`
- Create: `src/infrastructure/address/DaDataAddressProvider.ts`
- Create: `src/infrastructure/address/__tests__/DaDataAddressProvider.test.ts`
- Create: `src/infrastructure/address/NominatimAddressProvider.ts`
- Create: `src/infrastructure/address/AddressProviderResolver.ts`
- Create: `src/infrastructure/address/__tests__/AddressProviderResolver.test.ts`
- Modify: `.env.example`

### Phase 3 — HTTP surface — ✅ COMPLETE (2026-08-07)

Commits: 936fa7c (route handlers + registry entry), 6531432 (real daily cap, 429
handling, superadmin-visible quota log). 260 test files / 2753 tests passing.

- Modify: `src/infrastructure/rateLimit/registry.ts`
- Modify: `src/infrastructure/rateLimit/__tests__/InMemoryRateLimiter.test.ts` (registry length assertion, if present)
- Create: `src/app/api/address/suggest/route.ts`
- Create: `src/app/api/address/flats/route.ts`

### Phase 4 — UI (single task, single commit)

- Modify: `src/web/components/account/AddressSearch.tsx`
- Create: `src/web/components/account/ApartmentSearch.tsx`
- Modify: `src/web/components/account/AddressForm.tsx`
- Modify: `src/app/[locale]/account/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`

---

# Phase 1 — Domain & persistence

## Task 1: Prisma schema, migration, backfill

**Files:**

- Modify: `prisma/schema.prisma` (model `Address`, around line 115)
- Create: migration via `yarn prisma migrate dev`

**Interfaces:**

- Produces: DB columns `is_private_house`, `one_line`, `house_fias_id`, `flat_fias_id` on `addresses`.

- [ ] **Step 1: Add the columns to the schema**

In `prisma/schema.prisma`, model `Address`, after the `postalCode` line:

```prisma
  postalCode     String?  @map("postal_code")
  isPrivateHouse Boolean  @default(false) @map("is_private_house")
  oneLine        String?  @map("one_line")
  houseFiasId    String?  @map("house_fias_id")
  flatFiasId     String?  @map("flat_fias_id")
```

- [ ] **Step 2: Generate the migration WITHOUT applying it**

Run: `yarn prisma migrate dev --name address_private_house_and_fias --create-only`

`--create-only` is required. It writes the migration but does not run it, so the backfill
in Step 3 can be added _before_ the migration is ever applied.

**Never run `prisma migrate reset`** — it drops and reseeds the development database.
There is no reason to reset here, and doing so destroys local data.

- [ ] **Step 3: Add the backfill to the generated migration**

Open the newly created `prisma/migrations/<timestamp>_address_private_house_and_fias/migration.sql`
and append:

```sql
-- Existing apartment-less addresses are treated as private houses.
-- Without this, they violate the new domain invariant and throw on load
-- (PrismaUserRepository calls Address.create() during reconstitution).
UPDATE "addresses" SET "is_private_house" = true WHERE "apartment" IS NULL;
```

- [ ] **Step 3b: Apply the migration, backfill included**

Run: `yarn prisma migrate dev`
Expected: the pending migration applies once, including the `UPDATE`.

Verify the backfill actually ran:

Use `psql` against `DATABASE_URL`, NOT `prisma db execute` — the latter silently discards
`SELECT` output and only reports "script executed", so it can never confirm the backfill:

```bash
psql "$DATABASE_URL" -c \
  "SELECT count(*) FILTER (WHERE is_private_house) AS private, count(*) AS total FROM addresses;"
```

Expected: `private` equals the number of rows that had a NULL apartment. If the
`addresses` table is empty, that is a valid result — say so in the report rather than
claiming the backfill was verified against data.

- [ ] **Step 4: Regenerate the client**

Run: `yarn prisma:generate`
Expected: completes without error; `PrismaClient` now exposes the four new fields.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add is_private_house and FIAS provenance to addresses"
```

---

## Task 2: Address value object — invariant and provenance

**Files:**

- Modify: `src/domain/user/Address.ts`
- Modify: `src/domain/user/__tests__/Address.test.ts`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `AddressDomainCodes.APARTMENT_REQUIRED = 'domain.user.address.apartmentRequired'`
  - `AddressProps` gains `isPrivateHouse?: boolean`, `oneLine?: string`, `houseFiasId?: string`, `flatFiasId?: string`
  - Getters `isPrivateHouse: boolean`, `oneLine / houseFiasId / flatFiasId: string | undefined`

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/user/__tests__/Address.test.ts` inside the top-level `describe('Address', ...)`:

```ts
describe('apartment requirement', () => {
  it('should throw when not a private house and apartment is missing', () => {
    expect(() =>
      Address.create({ ...validProps, isPrivateHouse: false })
    ).toThrow(AddressDomainCodes.APARTMENT_REQUIRED);
  });

  it('should throw when not a private house and apartment is blank', () => {
    expect(() =>
      Address.create({ ...validProps, isPrivateHouse: false, apartment: '   ' })
    ).toThrow(AddressDomainCodes.APARTMENT_REQUIRED);
  });

  it('should default isPrivateHouse to false when the flag is absent', () => {
    // Built inline, NOT from validProps — validProps carries
    // isPrivateHouse: true, which would defeat the point of this test
    expect(() =>
      Address.create({
        country: 'Russia',
        city: 'Moscow',
        street: 'Tverskaya',
        building: '12',
      })
    ).toThrow(AddressDomainCodes.APARTMENT_REQUIRED);
  });

  it('should allow a missing apartment for a private house', () => {
    const address = Address.create({ ...validProps, isPrivateHouse: true });

    expect(address.isPrivateHouse).toBe(true);
    expect(address.apartment).toBeUndefined();
  });

  it('should force apartment to undefined for a private house', () => {
    const address = Address.create({
      ...validProps,
      isPrivateHouse: true,
      apartment: '12',
    });

    expect(address.apartment).toBeUndefined();
  });

  it('should accept an apartment when not a private house', () => {
    const address = Address.create({
      ...validProps,
      isPrivateHouse: false,
      apartment: '12',
    });

    expect(address.apartment).toBe('12');
    expect(address.isPrivateHouse).toBe(false);
  });
});

describe('provenance', () => {
  // Every case here is a real flat, so isPrivateHouse is explicitly false —
  // inheriting validProps' true would null out the apartment under test
  const flatProps = { ...validProps, isPrivateHouse: false, apartment: '2' };

  it('should store DaData provenance fields', () => {
    const address = Address.create({
      ...flatProps,
      oneLine:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 2',
      houseFiasId: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
      flatFiasId: '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee',
    });

    expect(address.apartment).toBe('2');
    expect(address.oneLine).toContain('Гвардейский пер');
    expect(address.houseFiasId).toBe('c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5');
    expect(address.flatFiasId).toBe('9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee');
  });

  it('should treat two addresses differing only by flatFiasId as unequal', () => {
    const a = Address.create({ ...flatProps, flatFiasId: 'aaa' });
    const b = Address.create({ ...flatProps, flatFiasId: 'bbb' });

    expect(a.equals(b)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/domain/user/__tests__/Address.test.ts`
Expected: the new tests FAIL (`isPrivateHouse` is not a known property, `APARTMENT_REQUIRED` undefined). Several **pre-existing** tests will also fail once the invariant lands — that is handled in Step 4.

- [ ] **Step 3: Implement**

In `src/domain/user/Address.ts`:

```ts
export const AddressDomainCodes = {
  COUNTRY_REQUIRED: 'domain.user.address.countryRequired',
  CITY_REQUIRED: 'domain.user.address.cityRequired',
  STREET_REQUIRED: 'domain.user.address.streetRequired',
  BUILDING_REQUIRED: 'domain.user.address.buildingRequired',
  APARTMENT_REQUIRED: 'domain.user.address.apartmentRequired',
} as const;

export interface AddressProps {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
  isPrivateHouse?: boolean;
  oneLine?: string;
  houseFiasId?: string;
  flatFiasId?: string;
}
```

Inside `create()`, after the existing `BUILDING_REQUIRED` check:

```ts
const isPrivateHouse = props.isPrivateHouse ?? false;

if (!isPrivateHouse && !props.apartment?.trim()) {
  throw new Error(AddressDomainCodes.APARTMENT_REQUIRED);
}
```

Replace the returned object:

```ts
return new Address({
  country: props.country.trim(),
  region: props.region?.trim() || undefined,
  city: props.city.trim(),
  street: props.street.trim(),
  building: props.building.trim(),
  // A private house has no flat — never persist a contradictory pair
  apartment: isPrivateHouse ? undefined : props.apartment?.trim() || undefined,
  postalCode: props.postalCode?.trim() || undefined,
  isPrivateHouse,
  oneLine: props.oneLine?.trim() || undefined,
  houseFiasId: props.houseFiasId?.trim() || undefined,
  flatFiasId: props.flatFiasId?.trim() || undefined,
});
```

Add getters:

```ts
  get isPrivateHouse(): boolean {
    return this.props.isPrivateHouse ?? false;
  }

  get oneLine(): string | undefined {
    return this.props.oneLine;
  }

  get houseFiasId(): string | undefined {
    return this.props.houseFiasId;
  }

  get flatFiasId(): string | undefined {
    return this.props.flatFiasId;
  }
```

Extend `equals()` with the four new fields:

```ts
this.props.postalCode === other.props.postalCode &&
  this.props.isPrivateHouse === other.props.isPrivateHouse &&
  this.props.oneLine === other.props.oneLine &&
  this.props.houseFiasId === other.props.houseFiasId &&
  this.props.flatFiasId === other.props.flatFiasId;
```

- [ ] **Step 4: Fix pre-existing fixtures broken by the new invariant**

30 `Address.create` call sites exist across `Address.test.ts`, `User.test.ts`,
`UpdateUserProfileUseCase.test.ts`, `UpdateUserProfileUseCase.ts` and
`PrismaUserRepository.ts`. Every fixture that has no `apartment` now throws.

In `src/domain/user/__tests__/Address.test.ts`, change the shared fixture so existing
assertions keep their meaning:

```ts
const validProps = {
  country: 'Russia',
  city: 'Moscow',
  street: 'Tverskaya',
  building: '12',
  isPrivateHouse: true,
};
```

Then in the `apartment requirement` block above, the tests that need the opposite pass
`isPrivateHouse: false` explicitly — they already do.

In `src/domain/user/__tests__/User.test.ts`, add `isPrivateHouse: true` to any
`Address.create({...})` fixture that has no `apartment`.

- [ ] **Step 5: Add the domain message key**

`messages/ru.json` → `domain.user.address`:

```json
"apartmentRequired": "Укажите номер квартиры"
```

`messages/en.json` → `domain.user.address`:

```json
"apartmentRequired": "Apartment number is required"
```

- [ ] **Step 6: Run the tests**

Run: `yarn test src/domain/user`
Expected: PASS, all tests.

- [ ] **Step 7: Commit**

```bash
git add src/domain/user messages/en.json messages/ru.json
git commit -m "feat: require apartment unless private house"
```

---

## Task 3: Persistence mapping

**Files:**

- Modify: `src/infrastructure/repositories/PrismaUserRepository.ts` (select block ~line 25, create ~line 115, update ~line 138, reconstitute type ~line 380 and mapping ~line 414)

**Interfaces:**

- Consumes: `Address` getters from Task 2.
- Produces: round-trip persistence of the four new fields.

- [ ] **Step 1: Extend the select block**

`src/infrastructure/repositories/PrismaUserRepository.ts`, the `select` around line 25:

```ts
      apartment: true,
      postalCode: true,
      isPrivateHouse: true,
      oneLine: true,
      houseFiasId: true,
      flatFiasId: true,
```

- [ ] **Step 2: Extend all three write mappings**

There are **three** identical field lists — inside `create`, and inside `upsert.create`
and `upsert.update`. Add to each, after `postalCode`:

```ts
                  postalCode: user.address.postalCode,
                  isPrivateHouse: user.address.isPrivateHouse,
                  oneLine: user.address.oneLine,
                  houseFiasId: user.address.houseFiasId,
                  flatFiasId: user.address.flatFiasId,
```

- [ ] **Step 3: Extend the reconstitution type and mapping**

The row type around line 380:

```ts
apartment: string | null;
postalCode: string | null;
isPrivateHouse: boolean;
oneLine: string | null;
houseFiasId: string | null;
flatFiasId: string | null;
```

The `Address.create` call around line 414:

```ts
        ? Address.create({
            country: user.address.country,
            region: user.address.region ?? undefined,
            city: user.address.city,
            street: user.address.street,
            building: user.address.building,
            apartment: user.address.apartment ?? undefined,
            postalCode: user.address.postalCode ?? undefined,
            isPrivateHouse: user.address.isPrivateHouse,
            oneLine: user.address.oneLine ?? undefined,
            houseFiasId: user.address.houseFiasId ?? undefined,
            flatFiasId: user.address.flatFiasId ?? undefined,
          })
```

- [ ] **Step 4: Add a regression test for reconstitution**

This step is not optional. Task 2 introduced an invariant that throws when a
non-private-house address has no apartment, and `toDomain()` reconstitutes through
`Address.create()`. Until this task lands, loading any user whose address has
`apartment IS NULL` throws — and **no test covers that path**, which is why the suite
stayed green through Task 2. Add the coverage now so it cannot regress.

Create `src/infrastructure/repositories/__tests__/PrismaUserRepository.address.test.ts`,
following the mock-Prisma pattern already used in
`src/infrastructure/repositories/__tests__/PrismaOrganizationRepository.test.ts`
(`vi.fn()` stubs, no live database):

```ts
import { vi, describe, it, expect } from 'vitest';
import { PrismaUserRepository } from '../PrismaUserRepository';
import type { PrismaClient } from '@/generated/prisma';

// Minimal row shaped like USER_SELECT; only address matters here
function userRow(address: Record<string, unknown> | null) {
  return {
    id: 'user-1',
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: null,
    phoneNumber: '+79001234567',
    password: 'hash',
    language: 'ru',
    consentGivenAt: new Date(),
    createdAt: new Date(),
    nickname: 'ivan',
    allowFindByName: true,
    allowFindByPhone: true,
    allowFindByAddress: true,
    privacySetupCompleted: true,
    confirmedAt: new Date(),
    address,
  };
}

const baseAddress = {
  id: 'addr-1',
  country: 'Россия',
  region: 'Ростовская обл',
  city: 'Ростов-на-Дону',
  street: 'Гвардейский пер',
  building: '13',
  postalCode: '344011',
};

function repoReturning(row: unknown) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(row) },
  } as unknown as PrismaClient;

  return new PrismaUserRepository(prisma);
}

describe('PrismaUserRepository address reconstitution', () => {
  it('loads a private house with no apartment without throwing', async () => {
    // The exact shape the Task 1 backfill produces for legacy rows
    const repo = repoReturning(
      userRow({
        ...baseAddress,
        apartment: null,
        isPrivateHouse: true,
        oneLine: null,
        houseFiasId: null,
        flatFiasId: null,
      })
    );

    const user = await repo.findById('user-1');

    expect(user?.address?.isPrivateHouse).toBe(true);
    expect(user?.address?.apartment).toBeUndefined();
  });

  it('maps ГАР provenance through reconstitution', async () => {
    const repo = repoReturning(
      userRow({
        ...baseAddress,
        apartment: '2',
        isPrivateHouse: false,
        oneLine:
          '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 2',
        houseFiasId: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        flatFiasId: '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee',
      })
    );

    const user = await repo.findById('user-1');

    expect(user?.address?.apartment).toBe('2');
    expect(user?.address?.oneLine).toContain('кв 2');
    expect(user?.address?.houseFiasId).toBe(
      'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5'
    );
    expect(user?.address?.flatFiasId).toBe(
      '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee'
    );
  });
});
```

- [ ] **Step 5: Prove the test is load-bearing**

Temporarily revert just the `isPrivateHouse: user.address.isPrivateHouse,` line in
`toDomain()` and run the test.

Run: `yarn test src/infrastructure/repositories/__tests__/PrismaUserRepository.address.test.ts`
Expected: the first test FAILS with `domain.user.address.apartmentRequired`.

Restore the line and re-run.
Expected: both tests PASS.

Record both outputs in your report. A test that passes with the fix removed proves nothing.

- [ ] **Step 6: Typecheck and full suite**

Run: `yarn typecheck && yarn test`
Expected: no type errors; all test files pass.

- [ ] **Step 7: Stage (do NOT commit — the controller commits)**

```bash
git add src/infrastructure/repositories/PrismaUserRepository.ts \
        src/infrastructure/repositories/__tests__/PrismaUserRepository.address.test.ts
```

---

## Task 4: Validation and action wiring

**Files:**

- Modify: `src/application/user/UpdateUserProfileSchema.ts`
- Modify: `src/application/user/UpdateUserProfileUseCase.ts`
- Modify: `src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`
- Modify: `src/web/actions/user/user.ts:91-110`

**Interfaces:**

- Consumes: `AddressDomainCodes.APARTMENT_REQUIRED`.
- Produces: a field-level Zod error on `address.apartment` rather than a thrown domain error.

- [ ] **Step 1: Write the failing test**

Add to `src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`:

```ts
it('should reject an address with no apartment when not a private house', () => {
  const result = UpdateUserProfileSchema.safeParse({
    userId: 'user-1',
    address: {
      country: 'Россия',
      city: 'Ростов-на-Дону',
      street: 'Гвардейский пер',
      building: '13',
      isPrivateHouse: false,
    },
  });

  expect(result.success).toBe(false);

  const issue = result.error!.issues.find(
    (i) => i.path.join('.') === 'address.apartment'
  );

  expect(issue?.message).toBe(AddressDomainCodes.APARTMENT_REQUIRED);
});

it('should accept an address with no apartment for a private house', () => {
  const result = UpdateUserProfileSchema.safeParse({
    userId: 'user-1',
    address: {
      country: 'Россия',
      city: 'Ростов-на-Дону',
      street: 'Гвардейский пер',
      building: '13',
      isPrivateHouse: true,
    },
  });

  expect(result.success).toBe(true);
});
```

Import `AddressDomainCodes` and `UpdateUserProfileSchema` at the top of that test file if not already present.

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/application/user/__tests__/UpdateUserProfileUseCase.test.ts`
Expected: FAIL — currently parses successfully.

- [ ] **Step 3: Implement**

In `src/application/user/UpdateUserProfileSchema.ts`, extend the address object with the
new optional fields and attach a cross-field refinement. Replace the `.nullable().optional()`
tail of `address`:

```ts
        postalCode: z.string().optional(),
        isPrivateHouse: z.boolean().optional(),
        oneLine: z.string().optional(),
        houseFiasId: z.string().optional(),
        flatFiasId: z.string().optional(),
      })
      .refine(
        (addr) => (addr.isPrivateHouse ?? false) || !!addr.apartment?.trim(),
        {
          message: AddressDomainCodes.APARTMENT_REQUIRED,
          path: ['apartment'],
        }
      )
      .nullable()
      .optional(),
```

- [ ] **Step 4: Pass the new fields through the action**

In `src/web/actions/user/user.ts`, inside the address object (currently lines 96-108),
after `postalCode`:

```ts
                postalCode: formData.get('addressPostalCode')
                  ? String(formData.get('addressPostalCode'))
                  : undefined,
                isPrivateHouse:
                  formData.get('addressIsPrivateHouse') === 'true',
                oneLine: formData.get('addressOneLine')
                  ? String(formData.get('addressOneLine'))
                  : undefined,
                houseFiasId: formData.get('addressHouseFiasId')
                  ? String(formData.get('addressHouseFiasId'))
                  : undefined,
                flatFiasId: formData.get('addressFlatFiasId')
                  ? String(formData.get('addressFlatFiasId'))
                  : undefined,
```

- [ ] **Step 5: Pass them into the domain in the use case**

In `src/application/user/UpdateUserProfileUseCase.ts`, find the `Address.create({...})` call
and add the four fields so they reach the aggregate:

```ts
        isPrivateHouse: input.address.isPrivateHouse ?? false,
        oneLine: input.address.oneLine,
        houseFiasId: input.address.houseFiasId,
        flatFiasId: input.address.flatFiasId,
```

- [ ] **Step 6: Run tests and typecheck**

Run: `yarn test src/application/user && yarn typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/application/user src/web/actions/user/user.ts
git commit -m "feat: validate apartment requirement in profile schema"
```

- [ ] **Step 8: Mark Phase 1 complete in this file and stop for review**

---

# Phase 2 — Address providers

## Task 5: DaData provider

**Files:**

- Create: `src/infrastructure/address/types.ts`
- Create: `src/infrastructure/address/DaDataAddressProvider.ts`
- Create: `src/infrastructure/address/__tests__/DaDataAddressProvider.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces:

  ```ts
  export interface AddressSuggestion {
    label: string; // display string
    oneLine: string; // durable anchor (DaData unrestricted_value)
    country: string;
    region: string;
    city: string;
    street: string;
    building: string;
    postalCode: string;
    houseFiasId?: string; // present only for DaData house-level hits
  }

  export interface FlatSuggestion {
    label: string;
    flat: string;
    oneLine: string;
    flatFiasId?: string;
  }

  export interface AddressProvider {
    suggestAddress(query: string): Promise<AddressSuggestion[]>;
  }
  ```

  and class `DaDataAddressProvider` with `suggestAddress(query)` and
  `suggestFlats(houseLabel, fragment)`. There is deliberately no separate `hasFlats` —
  the "is this an apartment block" probe is just `suggestFlats(label, '').length > 0`,
  served by the same route the dropdown already uses.

- [ ] **Step 1: Write the types**

Create `src/infrastructure/address/types.ts` with exactly the interfaces in the
**Interfaces** block above.

- [ ] **Step 2: Write the failing tests**

Create `src/infrastructure/address/__tests__/DaDataAddressProvider.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DaDataAddressProvider } from '../DaDataAddressProvider';

// Real payload shape, trimmed to the fields we map
const HOUSE_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13',
      unrestricted_value:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13',
      data: {
        country: 'Россия',
        region_with_type: 'Ростовская обл',
        city: 'Ростов-на-Дону',
        street_with_type: 'Гвардейский пер',
        house: '13',
        postal_code: '344011',
        house_fias_id: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        flat: null,
      },
    },
  ],
};

// DaData returns the house row alongside flats — to_bound does NOT filter it out
const FLAT_PAYLOAD = {
  suggestions: [
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13',
      unrestricted_value: '344011, …, д 13',
      data: { flat: null, flat_fias_id: null },
    },
    {
      value: 'г Ростов-на-Дону, Гвардейский пер, д 13, кв 2',
      unrestricted_value: '344011, …, д 13, кв 2',
      data: { flat: '2', flat_type: 'кв', flat_fias_id: 'flat-uuid-2' },
    },
  ],
};

function mockFetchOnce(payload: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

describe('DaDataAddressProvider', () => {
  beforeEach(() => {
    process.env.DADATA_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a house suggestion onto AddressSuggestion', async () => {
    const fetchMock = mockFetchOnce(HOUSE_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const [suggestion] = await provider.suggestAddress('Гвардейский 13');

    expect(suggestion.region).toBe('Ростовская обл');
    expect(suggestion.city).toBe('Ростов-на-Дону');
    expect(suggestion.street).toBe('Гвардейский пер');
    expect(suggestion.building).toBe('13');
    expect(suggestion.postalCode).toBe('344011');
    expect(suggestion.houseFiasId).toBe('c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5');
    expect(suggestion.oneLine).toContain('344011');
  });

  it('always requests Russian and enables foreign countries', async () => {
    const fetchMock = mockFetchOnce(HOUSE_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    await provider.suggestAddress('Гвардейский 13');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.language).toBe('ru');
    expect(body.locations).toEqual([{ country: '*' }]);
  });

  it('never sends the token in a way the browser could see — token is a header', async () => {
    const fetchMock = mockFetchOnce(HOUSE_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    await provider.suggestAddress('Гвардейский 13');

    const headers = fetchMock.mock.calls[0][1].headers;

    expect(headers.Authorization).toBe('Token test-key');
  });

  it('filters out non-flat rows, because to_bound does not', async () => {
    const fetchMock = mockFetchOnce(FLAT_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    const flats = await provider.suggestFlats(
      'г Ростов-на-Дону, Гвардейский пер, д 13',
      '2'
    );

    expect(flats).toHaveLength(1);
    expect(flats[0].flat).toBe('2');
    expect(flats[0].flatFiasId).toBe('flat-uuid-2');
  });

  it('builds the flat query by appending the fragment to the house label', async () => {
    const fetchMock = mockFetchOnce(FLAT_PAYLOAD);
    const provider = new DaDataAddressProvider(fetchMock);

    await provider.suggestFlats('г Ростов-на-Дону, Гвардейский пер, д 13', '2');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(body.query).toBe('г Ростов-на-Дону, Гвардейский пер, д 13 кв 2');
  });

  it('returns no flats when only non-flat rows come back', async () => {
    const provider = new DaDataAddressProvider(mockFetchOnce(HOUSE_PAYLOAD));

    const flats = await provider.suggestFlats(
      'г Ростов-на-Дону, Гвардейский пер, д 13',
      ''
    );

    expect(flats).toEqual([]);
  });

  it('returns an empty list when DaData errors, so the caller can fall back', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({}) });
    const provider = new DaDataAddressProvider(fetchMock);

    expect(await provider.suggestAddress('anything')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `yarn test src/infrastructure/address`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/infrastructure/address/DaDataAddressProvider.ts`:

```ts
import type {
  AddressProvider,
  AddressSuggestion,
  FlatSuggestion,
} from './types';

const SUGGEST_URL =
  'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';

// DaData returns at most 20; we show far fewer
const HOUSE_COUNT = 7;
const FLAT_COUNT = 10;

interface DaDataRow {
  value: string;
  unrestricted_value: string;
  data: Record<string, string | null>;
}

type Fetch = typeof fetch;

export class DaDataAddressProvider implements AddressProvider {
  // fetch is injected so tests never touch the network
  constructor(private readonly fetchFn: Fetch = fetch) {}

  private async query(query: string, count: number): Promise<DaDataRow[]> {
    const token = process.env.DADATA_API_KEY;

    // Misconfiguration must fail loudly. An empty array is the resolver's signal
    // to fall back to Nominatim, which has NO apartment data — so silently
    // returning [] here would route all Russian traffic to a provider that
    // cannot do the one thing this feature exists for, with no operator signal.
    // Thrown BEFORE the try/catch below so it propagates rather than being
    // swallowed into an empty result.
    if (!token) {
      throw new Error(
        'DADATA_API_KEY is not configured — address suggestions cannot work'
      );
    }

    if (!query.trim()) {
      return [];
    }

    try {
      const res = await this.fetchFn(SUGGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          query,
          count,
          // Addresses feed Russian legal documents — always store Russian
          language: 'ru',
          // Without this every non-RU query returns zero results
          locations: [{ country: '*' }],
        }),
      });

      if (!res.ok) {
        return [];
      }

      const json = (await res.json()) as { suggestions?: DaDataRow[] };

      return json.suggestions ?? [];
    } catch {
      // Caller falls back to Nominatim
      return [];
    }
  }

  async suggestAddress(query: string): Promise<AddressSuggestion[]> {
    const rows = await this.query(query, HOUSE_COUNT);

    return rows.map((row) => ({
      label: row.value,
      oneLine: row.unrestricted_value,
      country: row.data.country ?? '',
      region: row.data.region_with_type ?? '',
      city: row.data.city ?? '',
      street: row.data.street_with_type ?? '',
      building: row.data.house ?? '',
      postalCode: row.data.postal_code ?? '',
      houseFiasId: row.data.house_fias_id ?? undefined,
    }));
  }

  async suggestFlats(
    houseLabel: string,
    fragment: string
  ): Promise<FlatSuggestion[]> {
    // Scoping by locations[{fias_id}] returns zero results, and
    // to_bound:{value:'flat'} does not filter — plain text query is the only
    // approach that works. See readmes/2026-08-06-address-dadata-design.md
    const rows = await this.query(
      `${houseLabel} кв ${fragment}`.trim(),
      FLAT_COUNT
    );

    return rows
      .filter((row) => row.data.flat)
      .map((row) => ({
        label: row.value,
        flat: row.data.flat as string,
        oneLine: row.unrestricted_value,
        flatFiasId: row.data.flat_fias_id ?? undefined,
      }));
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `yarn test src/infrastructure/address`
Expected: PASS.

- [ ] **Step 6: Document the env var**

Add to `.env.example`:

```
# DaData address suggestions — https://dadata.ru/profile/#info
DADATA_API_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/address .env.example
git commit -m "feat: add DaData address provider"
```

---

## Task 6: Nominatim fallback and resolver

**Files:**

- Create: `src/infrastructure/address/NominatimAddressProvider.ts`
- Create: `src/infrastructure/address/AddressProviderResolver.ts`
- Create: `src/infrastructure/address/__tests__/AddressProviderResolver.test.ts`

**Interfaces:**

- Consumes: `AddressProvider`, `AddressSuggestion` from Task 5.
- Produces: `AddressProviderResolver` with `suggest(query: string): Promise<AddressSuggestion[]>`.

- [ ] **Step 1: Write the failing tests**

Create `src/infrastructure/address/__tests__/AddressProviderResolver.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AddressProviderResolver } from '../AddressProviderResolver';
import type { AddressSuggestion } from '../types';

const daDataHit: AddressSuggestion = {
  label: 'г Ростов-на-Дону, Гвардейский пер, д 13',
  oneLine: '344011, …, д 13',
  country: 'Россия',
  region: 'Ростовская обл',
  city: 'Ростов-на-Дону',
  street: 'Гвардейский пер',
  building: '13',
  postalCode: '344011',
  houseFiasId: 'house-uuid',
};

const nominatimHit: AddressSuggestion = {
  label: 'Alexanderplatz 1, Berlin',
  oneLine: 'Alexanderplatz 1, Berlin',
  country: 'Германия',
  region: '',
  city: 'Берлин',
  street: 'Alexanderplatz',
  building: '1',
  postalCode: '10178',
};

describe('AddressProviderResolver', () => {
  it('uses DaData results and never calls the fallback', async () => {
    const daData = { suggestAddress: vi.fn().mockResolvedValue([daDataHit]) };
    const nominatim = {
      suggestAddress: vi.fn().mockResolvedValue([nominatimHit]),
    };
    const resolver = new AddressProviderResolver(daData, nominatim);

    const results = await resolver.suggest('Гвардейский 13');

    expect(results).toEqual([daDataHit]);
    expect(nominatim.suggestAddress).not.toHaveBeenCalled();
  });

  it('falls back to Nominatim when DaData returns nothing', async () => {
    // Verified against the live API: "Berlin Alexanderplatz" returns 0 from DaData
    const daData = { suggestAddress: vi.fn().mockResolvedValue([]) };
    const nominatim = {
      suggestAddress: vi.fn().mockResolvedValue([nominatimHit]),
    };
    const resolver = new AddressProviderResolver(daData, nominatim);

    const results = await resolver.suggest('Berlin Alexanderplatz');

    expect(results).toEqual([nominatimHit]);
    expect(nominatim.suggestAddress).toHaveBeenCalledWith(
      'Berlin Alexanderplatz'
    );
  });

  it('returns an empty list when both providers find nothing', async () => {
    const daData = { suggestAddress: vi.fn().mockResolvedValue([]) };
    const nominatim = { suggestAddress: vi.fn().mockResolvedValue([]) };
    const resolver = new AddressProviderResolver(daData, nominatim);

    expect(await resolver.suggest('zzzz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `yarn test src/infrastructure/address/__tests__/AddressProviderResolver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Nominatim provider**

Create `src/infrastructure/address/NominatimAddressProvider.ts`:

```ts
import type { AddressProvider, AddressSuggestion } from './types';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimRow {
  display_name: string;
  address: Record<string, string | undefined>;
}

type Fetch = typeof fetch;

export class NominatimAddressProvider implements AddressProvider {
  constructor(private readonly fetchFn: Fetch = fetch) {}

  async suggestAddress(query: string): Promise<AddressSuggestion[]> {
    if (!query.trim()) {
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
    });

    try {
      const res = await this.fetchFn(`${SEARCH_URL}?${params}`, {
        headers: {
          // Russian for consistency with DaData — stored addresses are always Russian
          'Accept-Language': 'ru',
          'User-Agent': 'resolutio/1.0 (address autocomplete)',
        },
      });

      if (!res.ok) {
        return [];
      }

      const rows = (await res.json()) as NominatimRow[];

      return rows.map((row) => ({
        label: row.display_name,
        oneLine: row.display_name,
        country: row.address.country ?? '',
        region: row.address.state ?? '',
        city: row.address.city ?? row.address.town ?? row.address.village ?? '',
        street: row.address.road ?? '',
        building: row.address.house_number ?? '',
        postalCode: row.address.postcode ?? '',
        // Nominatim has no ГАР ids — flats can never be suggested for these
        houseFiasId: undefined,
      }));
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Implement the resolver**

Create `src/infrastructure/address/AddressProviderResolver.ts`:

```ts
import type { AddressProvider, AddressSuggestion } from './types';

/**
 * Provider selection is result-driven, not country-driven: we cannot know the
 * country before the user has typed. DaData covers Russia down to the flat and
 * BY/KZ/UZ down to the house, but only to city level elsewhere — and a street
 * token makes those city-only queries return nothing at all. So an empty DaData
 * response is exactly the signal to try Nominatim.
 */
export class AddressProviderResolver {
  constructor(
    private readonly daData: AddressProvider,
    private readonly nominatim: AddressProvider
  ) {}

  async suggest(query: string): Promise<AddressSuggestion[]> {
    const primary = await this.daData.suggestAddress(query);

    if (primary.length > 0) {
      return primary;
    }

    return this.nominatim.suggestAddress(query);
  }
}
```

- [ ] **Step 4b: Test the Nominatim provider directly**

The resolver's tests stub `suggestAddress` entirely, so without this step Nominatim's own
fetch/parse/mapping logic has **zero** coverage — and it is the path every non-Russian
user takes. Create `src/infrastructure/address/__tests__/NominatimAddressProvider.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { NominatimAddressProvider } from '../NominatimAddressProvider';

// Trimmed real Nominatim jsonv2 response for Гвардейский пер 13
const ROWS = [
  {
    display_name:
      '13, Гвардейский переулок, Новое Поселение, Ростов-на-Дону, Ростовская область, 344011, Россия',
    address: {
      house_number: '13',
      road: 'Гвардейский переулок',
      city: 'Ростов-на-Дону',
      state: 'Ростовская область',
      postcode: '344011',
      country: 'Россия',
    },
  },
];

function providerReturning(rows: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => rows });

  return { provider: new NominatimAddressProvider(fetchMock), fetchMock };
}

describe('NominatimAddressProvider', () => {
  it('maps a Nominatim row onto AddressSuggestion', async () => {
    const { provider } = providerReturning(ROWS);

    const [s] = await provider.suggestAddress('Гвардейский 13');

    expect(s.city).toBe('Ростов-на-Дону');
    expect(s.region).toBe('Ростовская область');
    expect(s.street).toBe('Гвардейский переулок');
    expect(s.building).toBe('13');
    expect(s.postalCode).toBe('344011');
    expect(s.country).toBe('Россия');
  });

  it('never produces a houseFiasId — Nominatim has no ГАР ids', async () => {
    // The UI keys "can we suggest apartments for this address?" off houseFiasId,
    // so this must be undefined rather than an empty string.
    const { provider } = providerReturning(ROWS);

    const [s] = await provider.suggestAddress('Гвардейский 13');

    expect(s.houseFiasId).toBeUndefined();
  });

  it('requests Russian so both providers store the same language', async () => {
    const { provider, fetchMock } = providerReturning(ROWS);

    await provider.suggestAddress('Гвардейский 13');

    expect(fetchMock.mock.calls[0][1].headers['Accept-Language']).toBe('ru');
  });

  it('sends an identifying User-Agent per Nominatim usage policy', async () => {
    const { provider, fetchMock } = providerReturning(ROWS);

    await provider.suggestAddress('Гвардейский 13');

    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toContain(
      'resolutio'
    );
  });

  it('falls back to town then village when city is absent', async () => {
    const { provider } = providerReturning([
      { display_name: 'x', address: { town: 'Аксай' } },
      { display_name: 'y', address: { village: 'Ольгинская' } },
    ]);

    const results = await provider.suggestAddress('Аксай');

    expect(results[0].city).toBe('Аксай');
    expect(results[1].city).toBe('Ольгинская');
  });

  it('returns [] on a non-2xx response, so the resolver is not handed junk', async () => {
    // Body deliberately WOULD map to results if the ok check were ignored
    const { provider } = providerReturning(ROWS, false);

    expect(await provider.suggestAddress('Гвардейский 13')).toEqual([]);
  });

  it('returns [] when fetch rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    const provider = new NominatimAddressProvider(fetchMock);

    expect(await provider.suggestAddress('Гвардейский 13')).toEqual([]);
  });

  it('returns [] for a blank query without calling the network', async () => {
    const { provider, fetchMock } = providerReturning(ROWS);

    expect(await provider.suggestAddress('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

Note the asymmetry with DaData, and that it is deliberate: a missing `DADATA_API_KEY`
**throws**, but Nominatim failures return `[]`. Nominatim is the fallback of last resort —
if it is down there is nothing further to try, and an empty suggestion list is the honest
answer. DaData returning `[]` on misconfiguration would instead silently mean "use the
provider that has no apartment data", which is why only that case fails loudly.

- [ ] **Step 5: Run the tests**

Run: `yarn test src/infrastructure/address`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/address
git commit -m "feat: add Nominatim fallback and provider resolver"
```

- [ ] **Step 7: Mark Phase 2 complete in this file and stop for review**

---

# Phase 3 — HTTP surface

## Task 7: Rate limiter entry and route handlers

**Files:**

- Modify: `src/infrastructure/rateLimit/registry.ts`
- Create: `src/app/api/address/suggest/route.ts`
- Create: `src/app/api/address/flats/route.ts`

**Interfaces:**

- Consumes: `AddressProviderResolver`, `DaDataAddressProvider`, `NominatimAddressProvider`.
- Produces:
  - `POST /api/address/suggest` — body `{ query: string }` → `{ suggestions: AddressSuggestion[] }`
  - `POST /api/address/flats` — body `{ houseLabel: string, fragment: string }` → `{ flats: FlatSuggestion[] }`
  - `addressSuggestLimiter` exported from the rate limit registry.

- [ ] **Step 1: Add the limiter**

In `src/infrastructure/rateLimit/registry.ts`, after the `REPORT_CREATE` constants:

```ts
// 300 / min — protects the DaData daily quota (free tier: 10,000/day).
// The middleware session limiter (120/min) already protects the app; this one
// exists so a single session cannot burn the shared external quota.
const ADDRESS_SUGGEST_MAX = 300;
const ADDRESS_SUGGEST_WINDOW_MS = 60_000;
```

Append to the array returned by `createRegistry()`:

```ts
    {
      label: 'addressSuggest',
      limiter: new InMemoryRateLimiter(
        ADDRESS_SUGGEST_MAX,
        ADDRESS_SUGGEST_WINDOW_MS
      ),
      maxRequests: ADDRESS_SUGGEST_MAX,
      windowMs: ADDRESS_SUGGEST_WINDOW_MS,
    },
```

And the derived export, after `reportCreateLimiter`:

```ts
export const addressSuggestLimiter = limiterRegistry[9].limiter;
```

- [ ] **Step 2: Check for a registry-length assertion**

Run: `grep -rn "limiterRegistry" src/infrastructure/rateLimit/__tests__/`
If any test asserts the registry length or index order, update it to expect 10 entries.

- [ ] **Step 3: Create the suggest route**

Create `src/app/api/address/suggest/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { DaDataAddressProvider } from '@/infrastructure/address/DaDataAddressProvider';
import { NominatimAddressProvider } from '@/infrastructure/address/NominatimAddressProvider';
import { AddressProviderResolver } from '@/infrastructure/address/AddressProviderResolver';

const resolver = new AddressProviderResolver(
  new DaDataAddressProvider(),
  new NominatimAddressProvider()
);

const MIN_QUERY_LENGTH = 3;

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json(rateLimited, { status: 429 });
  }

  // Address lookup is only offered to signed-in users editing their profile
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ suggestions: [] }, { status: 401 });
  }

  const { query } = (await request.json()) as { query?: string };

  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await resolver.suggest(query.trim());

  return NextResponse.json({ suggestions });
}
```

- [ ] **Step 4: Create the flats route**

Create `src/app/api/address/flats/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { DaDataAddressProvider } from '@/infrastructure/address/DaDataAddressProvider';

const provider = new DaDataAddressProvider();

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json(rateLimited, { status: 429 });
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ flats: [] }, { status: 401 });
  }

  const { houseLabel, fragment } = (await request.json()) as {
    houseLabel?: string;
    fragment?: string;
  };

  if (!houseLabel?.trim()) {
    return NextResponse.json({ flats: [] });
  }

  const flats = await provider.suggestFlats(houseLabel.trim(), fragment ?? '');

  return NextResponse.json({ flats });
}
```

- [ ] **Step 5: Verify manually against the running app**

Run: `yarn dev`, sign in, then in the browser console:

```js
await (
  await fetch('/api/address/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Ростов-на-Дону Гвардейский 13' }),
  })
).json();
```

Expected: a `suggestions` array whose first entry has `houseFiasId` set.

Then:

```js
await (
  await fetch('/api/address/flats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      houseLabel: 'г Ростов-на-Дону, Гвардейский пер, д 13',
      fragment: '2',
    }),
  })
).json();
```

Expected: flats 2, 20, 21, 22 — and no row with `flat: null`.

- [ ] **Step 6: Run tests and typecheck**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/rateLimit src/app/api/address
git commit -m "feat: add address suggest and flats route handlers"
```

---

## Task 7, Part B: Make the quota guard real, and log it where a superadmin can see it

As first written, `addressSuggestLimiter` was **defined but never called** — inert
decoration — and configured at 300/min, which is 432,000/day against DaData's 10,000/day
free tier. A per-minute limiter cannot protect a daily quota. This part fixes both, adds
explicit 429 handling, and surfaces either event in the superadmin log panel.

**Decisions (from the project owner):** keep the cap despite its known drift (few deploys
per day, beta barely used), **and** handle 429 as a backstop, **and** log both to a file
visible in the superadmin panel like the SMS logs.

**Files:**

- Create: `src/infrastructure/address/AddressQuotaLogger.ts`
- Create: `src/infrastructure/address/__tests__/AddressQuotaLogger.test.ts`
- Modify: `src/infrastructure/rateLimit/registry.ts`
- Modify: `src/infrastructure/address/DaDataAddressProvider.ts`
- Modify: `src/infrastructure/address/__tests__/DaDataAddressProvider.test.ts`
- Modify: `src/infrastructure/logs/logSources.ts`
- Modify: `src/app/api/address/suggest/route.ts`
- Modify: `src/app/api/address/flats/route.ts`

- [ ] **Step 1: Fix the limiter to a daily window**

In `src/infrastructure/rateLimit/registry.ts`, replace the `ADDRESS_SUGGEST` constants
and their comment:

```ts
// DaData free tier allows 10,000 requests/day. This is a DAILY cap, not a per-minute
// one — a per-minute limiter cannot protect a daily quota (300/min would be 432,000/day).
// Keyed globally, not per session: the quota belongs to our DaData account and is shared
// by every user, so a per-user limit would not protect it.
// 9,500 leaves ~5% headroom for two known sources of drift: this counter lives in process
// memory and resets on deploy, and beta shares the same DaData key as production. The 429
// handling in DaDataAddressProvider is the backstop for anything that slips past.
const ADDRESS_SUGGEST_MAX = 9_500;
const ADDRESS_SUGGEST_WINDOW_MS = 24 * 60 * 60_000;
```

Leave the registry entry and the `limiterRegistry[9]` export exactly as they are.

- [ ] **Step 2: Write the failing logger test**

Create `src/infrastructure/address/__tests__/AddressQuotaLogger.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AddressQuotaLogger } from '../AddressQuotaLogger';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'addr-quota-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function readLines(): Promise<Record<string, unknown>[]> {
  const raw = await fs.readFile(path.join(dir, 'address-quota.log'), 'utf8');

  return raw
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
}

describe('AddressQuotaLogger', () => {
  it('logs a cap-reached entry as JSON with a timestamp', async () => {
    const logger = new AddressQuotaLogger(dir);

    await logger.logCapReached({
      route: 'suggest',
      dailyMax: 9500,
      retryAfterSeconds: 3600,
      fellBackToNominatim: true,
    });

    const [entry] = await readLines();

    expect(entry.level).toBe('warn');
    expect(entry.event).toBe('daily_cap_reached');
    expect(entry.route).toBe('suggest');
    expect(entry.dailyMax).toBe(9500);
    expect(entry.fellBackToNominatim).toBe(true);
    expect(typeof entry.timestamp).toBe('string');
  });

  it('logs a DaData 429 as an error-level entry', async () => {
    const logger = new AddressQuotaLogger(dir);

    await logger.logQuotaRejected({ route: 'flats', statusCode: 429 });

    const [entry] = await readLines();

    expect(entry.level).toBe('error');
    expect(entry.event).toBe('dadata_quota_rejected');
    expect(entry.statusCode).toBe(429);
  });

  it('appends rather than overwriting', async () => {
    const logger = new AddressQuotaLogger(dir);

    await logger.logQuotaRejected({ route: 'suggest', statusCode: 429 });
    await logger.logQuotaRejected({ route: 'flats', statusCode: 429 });

    expect(await readLines()).toHaveLength(2);
  });

  it('never throws when the log directory cannot be written', async () => {
    // Logging must never take down an address lookup.
    // Point logsDir at an existing FILE: mkdir then fails ENOTDIR immediately, on every
    // platform. Do NOT use a /proc path — mkdir under procfs hangs in some sandboxes
    // instead of rejecting, which turns this into a flaky timeout rather than a test.
    const filePath = path.join(dir, 'iam-a-file');
    await fs.writeFile(filePath, 'x');

    const logger = new AddressQuotaLogger(filePath);

    await expect(
      logger.logQuotaRejected({ route: 'suggest', statusCode: 429 })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `yarn test src/infrastructure/address/__tests__/AddressQuotaLogger.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the logger**

Create `src/infrastructure/address/AddressQuotaLogger.ts`, mirroring
`src/infrastructure/ai/AILogger.ts` (read it first and match its conventions, including
the Moscow-time field):

```ts
import fs from 'fs/promises';
import path from 'path';

export interface AddressCapReachedLogEntry {
  route: 'suggest' | 'flats';
  dailyMax: number;
  retryAfterSeconds: number;
  fellBackToNominatim: boolean;
}

export interface AddressQuotaRejectedLogEntry {
  route: 'suggest' | 'flats';
  statusCode: number;
}

export class AddressQuotaLogger {
  private readonly logFile: string;
  private dirEnsured = false;

  constructor(logsDir?: string) {
    const dir = logsDir ?? path.join(process.cwd(), 'logs');
    this.logFile = path.join(dir, 'address-quota.log');
  }

  /** Our own daily cap tripped before DaData was called. */
  async logCapReached(entry: AddressCapReachedLogEntry): Promise<void> {
    await this.append(
      this.formatLine({ level: 'warn', event: 'daily_cap_reached', ...entry })
    );
  }

  /** DaData itself rejected us — the real quota signal, not our estimate. */
  async logQuotaRejected(entry: AddressQuotaRejectedLogEntry): Promise<void> {
    await this.append(
      this.formatLine({
        level: 'error',
        event: 'dadata_quota_rejected',
        ...entry,
      })
    );
  }

  private formatLine(entry: Record<string, unknown>): string {
    /* as AILogger */
  }

  private async append(line: string): Promise<void> {
    // Must never throw — a logging failure must not break an address lookup
  }
}
```

Copy `formatLine`, `toMoscowTime` and `append` (including its directory-ensure and
swallow-errors behaviour) from `AILogger`. Do not invent a different format — the
superadmin panel parses these files as JSON lines.

- [ ] **Step 5: Register the log source**

In `src/infrastructure/logs/logSources.ts`, append to `LOG_SOURCES`:

```ts
  {
    id: 'address-quota',
    path: 'logs/address-quota.log',
    label: 'Address Quota',
    json: true,
  },
```

`src/app/api/superadmin/logs/route.ts` iterates `LOG_SOURCES`, so this is all that is
needed for it to appear in the panel.

- [ ] **Step 6: Handle 429 in the provider**

In `src/infrastructure/address/DaDataAddressProvider.ts`, accept an optional logger and
a route label, and treat 429 distinctly from other failures:

```ts
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly quotaLogger?: AddressQuotaLogger
  ) {}
```

Inside `query()`, replace the single `if (!res.ok) return [];` with:

```ts
// 429 is DaData telling us the account quota is exhausted — the authoritative
// signal, versus our own cap which is only an estimate. Logged distinctly so a
// superadmin can tell "our guard fired" from "we actually ran out".
if (res.status === 429) {
  await this.quotaLogger?.logQuotaRejected({ route, statusCode: 429 });

  return [];
}

if (!res.ok) {
  return [];
}
```

Thread a `route: 'suggest' | 'flats'` value into `query()` from `suggestAddress`
(`'suggest'`) and `suggestFlats` (`'flats'`).

Returning `[]` on 429 is correct and deliberate: it lets the resolver fall back to
Nominatim. This is NOT the same as the missing-key case, which still throws — a missing
key is a misconfiguration we can fix, an exhausted quota is expected operation where a
degraded result beats no result.

- [ ] **Step 7: Add a provider test for 429**

Add to `DaDataAddressProvider.test.ts`:

```ts
it('logs and returns [] on a 429, without trusting the body', async () => {
  const logQuotaRejected = vi.fn().mockResolvedValue(undefined);
  // Body WOULD map to results if the 429 branch were missing
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => HOUSE_PAYLOAD,
  });
  const provider = new DaDataAddressProvider(fetchMock, {
    logQuotaRejected,
  } as never);

  expect(await provider.suggestAddress('Гвардейский 13')).toEqual([]);
  expect(logQuotaRejected).toHaveBeenCalledWith({
    route: 'suggest',
    statusCode: 429,
  });
});

it('does not log a quota rejection for an ordinary non-2xx', async () => {
  const logQuotaRejected = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => HOUSE_PAYLOAD,
  });
  const provider = new DaDataAddressProvider(fetchMock, {
    logQuotaRejected,
  } as never);

  expect(await provider.suggestAddress('Гвардейский 13')).toEqual([]);
  expect(logQuotaRejected).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: Wire the cap into both route handlers**

In `src/app/api/address/suggest/route.ts`, after the auth check and before calling the
resolver:

```ts
const QUOTA_KEY = 'dadata:global'; // account-wide quota, deliberately not per-session

const quota = addressSuggestLimiter.check(QUOTA_KEY);

if (!quota.allowed) {
  // Skip DaData entirely and serve Nominatim directly. Degraded — no apartment
  // suggestions — but the address form keeps working.
  await quotaLogger.logCapReached({
    route: 'suggest',
    dailyMax: ADDRESS_SUGGEST_MAX_EXPORTED,
    retryAfterSeconds: quota.retryAfterSeconds ?? 0,
    fellBackToNominatim: true,
  });

  return NextResponse.json({
    suggestions: await nominatim.suggestAddress(query.trim()),
  });
}
```

Construct a module-level `nominatim` instance alongside the existing resolver, and export
the max from the registry so the log entry carries the real number rather than a
duplicated literal.

In `src/app/api/address/flats/route.ts`, the same check, but flats have no fallback —
Nominatim has no apartment data at all:

```ts
const quota = addressSuggestLimiter.check(QUOTA_KEY);

if (!quota.allowed) {
  await quotaLogger.logCapReached({
    route: 'flats',
    dailyMax: ADDRESS_SUGGEST_MAX_EXPORTED,
    retryAfterSeconds: quota.retryAfterSeconds ?? 0,
    fellBackToNominatim: false,
  });

  return NextResponse.json({ flats: [] });
}
```

- [ ] **Step 9: Verify the cap actually fires**

Write a scratch script (do NOT commit it) that constructs a fresh `InMemoryRateLimiter`
with the daily settings, calls `check('dadata:global')` 9,501 times, and confirms the
9,501st returns `allowed: false`. Record the output in your report, then delete the script.

- [ ] **Step 10: Full verification**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all pass.

- [ ] **Step 11: Stage (do NOT commit — the controller commits)**

```bash
git add src/infrastructure/address src/infrastructure/rateLimit/registry.ts \
        src/infrastructure/logs/logSources.ts src/app/api/address
```

- [ ] **Step 12: Mark Phase 3 complete in this file and stop for review**

---

# Phase 4 — UI — ✅ COMPLETE (2026-08-07)

Commit: ae105ce. 260 test files / 2753 tests passing.

## Task 8: UI — DaData-backed search, apartment suggestions, «Частный дом» toggle

Parts A and B land as a SINGLE commit at the end. The pre-commit hook runs prettier,
`yarn typecheck` and the full Vitest suite, and the tree does not typecheck between
the two parts.

### Task 8, Part A: AddressSearch — call our proxy, capture provenance

**Files:**

- Modify: `src/web/components/account/AddressSearch.tsx`

**Interfaces:**

- Consumes: `POST /api/address/suggest`.
- Produces: `AddressFields` extended with `isPrivateHouse: boolean`, `oneLine: string`, `houseFiasId: string`, `flatFiasId: string`; `onSelect` now receives a full `AddressFields` plus a `houseLabel: string` used for flat lookups.

- [ ] **Step 1: Replace the Nominatim types and call**

Rewrite the top of `src/web/components/account/AddressSearch.tsx`. Delete the
`NominatimResult` interface entirely and replace with:

```ts
interface AddressSuggestion {
  label: string;
  oneLine: string;
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  postalCode: string;
  houseFiasId?: string;
}

export interface AddressFields {
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  postalCode: string;
  isPrivateHouse: boolean;
  oneLine: string;
  houseFiasId: string;
  flatFiasId: string;
}

type Props = {
  onSelect: (fields: AddressFields, houseLabel: string) => void;
  disabled?: boolean;
};
```

Note the `locale` prop is gone — the server always requests Russian.

- [ ] **Step 2: Replace the search function, with a per-query cache**

Every call costs one middleware session hit against the 120/min budget, so backspacing
and retyping must not re-fetch. Add the cache ref alongside the other refs:

```ts
const cacheRef = useRef<Map<string, AddressSuggestion[]>>(new Map());
```

```ts
const search = useCallback(async (q: string) => {
  const key = q.trim();

  if (key.length < 3) {
    setResults([]);
    setShowDropdown(false);

    return;
  }

  // Typing "Ростов" then backspacing to "Росто" must not re-hit the API —
  // each call costs one middleware session hit out of 120/min
  const cached = cacheRef.current.get(key);

  if (cached) {
    setResults(cached);
    setShowDropdown(cached.length > 0);

    return;
  }

  setIsSearching(true);

  try {
    const res = await fetch('/api/address/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: key }),
    });

    if (res.ok) {
      const { suggestions } = (await res.json()) as {
        suggestions: AddressSuggestion[];
      };
      cacheRef.current.set(key, suggestions);
      setResults(suggestions);
      setShowDropdown(suggestions.length > 0);
    }
  } catch {
    // Silently fail — user can fill manually
  } finally {
    setIsSearching(false);
  }
}, []);
```

Update the `useState` for results to `useState<AddressSuggestion[]>([])`.

- [ ] **Step 3: Replace handleSelect**

```ts
function handleSelect(result: AddressSuggestion) {
  onSelect(
    {
      country: result.country,
      region: result.region,
      city: result.city,
      street: result.street,
      building: result.building,
      // Reset — a new building invalidates any previously entered flat.
      // This also fixes the stale-apartment carry-over bug.
      apartment: '',
      postalCode: result.postalCode,
      isPrivateHouse: false,
      oneLine: result.oneLine,
      houseFiasId: result.houseFiasId ?? '',
      flatFiasId: '',
    },
    result.label
  );
  setQuery(result.label);
  setShowDropdown(false);
}
```

- [ ] **Step 4: Update the dropdown rendering**

Replace `key={result.place_id}` with `key={result.oneLine}` and
`{result.display_name}` with `{result.label}`. Add `cursor-pointer` to the
option `<button>` className.

- [ ] **Step 5: Typecheck — expect failures, do NOT commit yet**

Run: `yarn typecheck`
Expected: errors **only** in `AddressForm.tsx` (it still passes `locale` and uses the old
`onSelect` signature).

**Do not commit here.** This repo has a pre-commit hook that runs prettier, `yarn typecheck`
and the full Vitest suite; a commit at this point would be rejected. Part B below repairs
`AddressForm.tsx`, and the two parts land as one commit at the very end.

---

### Task 8, Part B: Apartment suggest, «Частный дом» toggle, submit gating

**Files:**

- Create: `src/web/components/account/ApartmentSearch.tsx`
- Modify: `src/web/components/account/AddressForm.tsx`
- Modify: `src/app/[locale]/account/page.tsx`
- Modify: `messages/en.json`, `messages/ru.json`

**Interfaces:**

- Consumes: `AddressFields` from Part A, `POST /api/address/flats`.
- Produces: the finished form.

- [ ] **Step 1: Add the UI messages**

`messages/ru.json` → `account`:

```json
    "addressPrivateHouse": "Частный дом",
    "addressPrivateHouseDescription": "В частном доме нет номера квартиры",
    "addressApartmentRequired": "Укажите квартиру или отметьте «Частный дом»",
```

`messages/en.json` → `account`:

```json
    "addressPrivateHouse": "Private house",
    "addressPrivateHouseDescription": "A private house has no apartment number",
    "addressApartmentRequired": "Enter an apartment or check \"Private house\"",
```

- [ ] **Step 2: Create ApartmentSearch**

Create `src/web/components/account/ApartmentSearch.tsx`:

```tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/src/web/components/catalyst/input';

interface FlatSuggestion {
  label: string;
  flat: string;
  oneLine: string;
  flatFiasId?: string;
}

type Props = {
  value: string;
  houseLabel: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (flat: string, flatFiasId: string) => void;
};

export function ApartmentSearch({
  value,
  houseLabel,
  invalid,
  disabled,
  onChange,
}: Props) {
  const [results, setResults] = useState<FlatSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (fragment: string) => {
      if (!houseLabel) {
        return;
      }

      try {
        const res = await fetch('/api/address/flats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ houseLabel, fragment }),
        });

        if (res.ok) {
          const { flats } = (await res.json()) as { flats: FlatSuggestion[] };
          setResults(flats);
          setShowDropdown(flats.length > 0);
        }
      } catch {
        // Silently fail — the field stays free-text
      }
    },
    [houseLabel]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    // Typing by hand invalidates any previously picked ГАР flat id
    onChange(next, '');

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => search(next), 300);
  }

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
        name="apartment"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        invalid={invalid}
      />
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.map((result) => (
            <li key={result.oneLine}>
              <button
                type="button"
                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => {
                  onChange(result.flat, result.flatFiasId ?? '');
                  setShowDropdown(false);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire AddressForm state**

In `src/web/components/account/AddressForm.tsx`:

Extend `AddressData` and the initial `values` with the four new fields:

```ts
type AddressData = {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
  isPrivateHouse: boolean;
  oneLine?: string;
  houseFiasId?: string;
  flatFiasId?: string;
};
```

```ts
const [houseLabel, setHouseLabel] = useState(address?.oneLine || '');
const [values, setValues] = useState<AddressFields>({
  country: address?.country || '',
  region: address?.region || '',
  city: address?.city || '',
  street: address?.street || '',
  building: address?.building || '',
  apartment: address?.apartment || '',
  postalCode: address?.postalCode || '',
  isPrivateHouse: address?.isPrivateHouse ?? false,
  oneLine: address?.oneLine || '',
  houseFiasId: address?.houseFiasId || '',
  flatFiasId: address?.flatFiasId || '',
});
```

Add the validity flag, used for both the inline error and the disabled button:

```ts
const apartmentMissing =
  !values.isPrivateHouse && values.apartment.trim() === '';
```

Extend `changed` with the new fields:

```ts
values.isPrivateHouse !== (address?.isPrivateHouse ?? false) ||
  values.oneLine !== (address?.oneLine || '') ||
  values.houseFiasId !== (address?.houseFiasId || '') ||
  values.flatFiasId !== (address?.flatFiasId || '');
```

- [ ] **Step 4: Clear provenance on manual edits**

Replace the body of `handleFieldChange` so hand-editing a structured field drops the
ГАР ids — otherwise they would describe a different address than the one shown:

```ts
function handleFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
  const { name, value } = e.target;
  setValues((prev) => ({
    ...prev,
    [name]: value,
    // Hand-edited addresses carry no ГАР provenance
    oneLine: '',
    houseFiasId: '',
    flatFiasId: '',
  }));
  setHouseLabel('');

  if (fieldErrors[name]) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];

      return next;
    });
  }

  if (error) {
    setError(null);
  }

  if (success) {
    setSuccess(null);
  }
}
```

- [ ] **Step 5: Replace handleNominatimSelect with the probing select handler**

```ts
async function handleAddressSelect(fields: AddressFields, label: string) {
  setValues(fields);
  setHouseLabel(label);
  setShowManualAddress(true);
  setError(null);
  setSuccess(null);

  // Probe ГАР for flats. Found → it is demonstrably an apartment block, so
  // apartment stays required. None found → most likely a private house.
  // Nominatim results have no houseFiasId and cannot be probed, so they keep
  // the safe default of "apartment required".
  if (!fields.houseFiasId) {
    return;
  }

  try {
    const res = await fetch('/api/address/flats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ houseLabel: label, fragment: '' }),
    });

    if (res.ok) {
      const { flats } = (await res.json()) as { flats: unknown[] };
      setValues((prev) => ({ ...prev, isPrivateHouse: flats.length === 0 }));
    }
  } catch {
    // Leave the safe default in place
  }
}
```

- [ ] **Step 6: Send the new fields on submit**

In `handleSubmit`, after the `addressPostalCode` line:

```ts
formData.set('addressIsPrivateHouse', String(values.isPrivateHouse));
formData.set('addressOneLine', values.oneLine);
formData.set('addressHouseFiasId', values.houseFiasId);
formData.set('addressFlatFiasId', values.flatFiasId);
```

And reset the new fields in `handleClear`'s `setValues({...})` call:

```ts
          isPrivateHouse: false,
          oneLine: '',
          houseFiasId: '',
          flatFiasId: '',
```

- [ ] **Step 7: Render the toggle and the gated apartment field**

Add the imports:

```ts
import {
  Field,
  Label,
  FieldGroup,
  SwitchField,
  Description,
} from '@/src/web/components/catalyst/fieldset';
import { Switch } from '@/src/web/components/catalyst/switch';
import { ApartmentSearch } from './ApartmentSearch';
```

Update the `AddressSearch` usage (the `locale` prop is gone):

```tsx
<AddressSearch onSelect={handleAddressSelect} disabled={isPending} />
```

Replace the whole Квартира `<Field>` block:

```tsx
<SwitchField>
  <Label>{t('addressPrivateHouse')}</Label>
  <Description>{t('addressPrivateHouseDescription')}</Description>
  <Switch
    color="brand-green"
    checked={values.isPrivateHouse}
    onChange={(checked) => {
      setValues((prev) => ({
        ...prev,
        isPrivateHouse: checked,
        // A private house has no flat
        apartment: checked ? '' : prev.apartment,
        flatFiasId: checked ? '' : prev.flatFiasId,
      }));
      setError(null);
      setSuccess(null);
    }}
    disabled={isPending}
  />
</SwitchField>;

{
  !values.isPrivateHouse && (
    <Field>
      <Label>{t('addressApartment')}</Label>
      <ApartmentSearch
        value={values.apartment}
        houseLabel={houseLabel}
        disabled={isPending}
        invalid={apartmentMissing || !!fieldErrors.apartment}
        onChange={(flat, flatFiasId) => {
          setValues((prev) => ({ ...prev, apartment: flat, flatFiasId }));
          setError(null);
          setSuccess(null);
        }}
      />
      {apartmentMissing && (
        <p className="text-sm text-red-600">{t('addressApartmentRequired')}</p>
      )}
      {fieldErrors.apartment && (
        <p className="text-sm text-red-600">{fieldErrors.apartment[0]}</p>
      )}
    </Field>
  );
}
```

- [ ] **Step 8: Gate the submit button**

```tsx
        <Button
          type="submit"
          disabled={isPending || !changed || !hasAddress || apartmentMissing}
        >
```

- [ ] **Step 9: Pass the new fields from the server component**

In `src/app/[locale]/account/page.tsx`, the address serialization around line 91:

```ts
                          apartment: user.address.apartment,
                          isPrivateHouse: user.address.isPrivateHouse,
                          oneLine: user.address.oneLine,
                          houseFiasId: user.address.houseFiasId,
                          flatFiasId: user.address.flatFiasId,
```

- [ ] **Step 10: Verify the whole flow**

Run: `yarn test && yarn typecheck && yarn lint`
Expected: all pass.

Then `yarn dev` and, on the account page:

1. Type `Ростов-на-Дону Гвардейский 13` → pick the house.
   Expected: fields fill, «Частный дом» stays **off**, Квартира is empty and shows the
   required hint, Save is disabled.
2. Type `2` in Квартира.
   Expected: dropdown offers кв 2, 20, 21, 22. Pick кв 2 → hint clears, Save enables.
3. Save, reload.
   Expected: apartment 2 persists and the toggle is still off.
4. Pick a _different_ building.
   Expected: apartment resets to empty (the stale carry-over bug is gone).
5. Check «Частный дом».
   Expected: the Квартира field disappears and Save enables.
6. Type `Berlin Alexanderplatz`.
   Expected: Nominatim fallback returns street-level results; «Частный дом» stays off and
   apartment is required until the user opts out.

- [ ] **Step 11: Commit**

```bash
git add src/web/components/account src/app/\[locale\]/account/page.tsx messages/en.json messages/ru.json
git commit -m "feat: DaData address search with apartment suggestions and private house toggle"
```

- [ ] **Step 12: Mark Phase 4 complete in this file and stop for review**

---

## Notes

- The DaData API key used during design was exposed in a chat transcript and should be
  regenerated in the DaData dashboard before this ships.
- `Address.create()` is called during reconstitution in `PrismaUserRepository`, so the
  Task 1 backfill is required for correctness, not convenience. Skipping it makes every
  legacy apartment-less user unloadable.
