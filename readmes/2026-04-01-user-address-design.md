# User Address Feature

## Overview

Users can optionally fill in their structured address for legal/document purposes and discoverability. Address autocomplete powered by Nominatim (OpenStreetMap) with manual fallback.

## Data Model

### New `Address` table (one-to-one with User, optional)

| Field      | Type     | Required | Notes                        |
| ---------- | -------- | -------- | ---------------------------- |
| id         | UUID     | yes      | PK                           |
| userId     | UUID     | yes      | unique FK -> User            |
| country    | String   | yes      |                              |
| region     | String   | no       | oblast/state                 |
| city       | String   | yes      |                              |
| street     | String   | yes      |                              |
| building   | String   | yes      | freeform: "3/1", "5 k.1" etc |
| apartment  | String   | no       |                              |
| postalCode | String   | no       |                              |
| createdAt  | DateTime | yes      |                              |
| updatedAt  | DateTime | yes      |                              |

### User model changes

- New optional relation: `address? Address`
- New boolean: `allowFindByAddress` (default false)
- `UserPrivacyAuditLog` extended with `allowFindByAddress`

## Nominatim Integration

- Client-side only, no backend proxy
- Debounced search input (300ms) calls `/search?format=jsonv2&addressdetails=1`
- `Accept-Language` set to user's locale so results come in the right language
- Nominatim usage policy: max 1 req/sec (enforced via debounce). Browser `Referer` header identifies the app (client-side `fetch` cannot override `User-Agent`).
- On selection: parse `address` object, auto-fill country/region/city/street/building/postalCode
- All auto-populated fields are editable after selection
- "Fill in manually" link skips search, shows empty fields
- No Nominatim IDs or coordinates stored — only the final field values user confirms

## Search / "Find by Address"

- When `allowFindByAddress` is true, user is discoverable by city or city+street
- Building/apartment/postalCode **never** exposed in search results
- Existing `searchUsers` in `PrismaUserRepository` extended with optional address filter
- Follows same `respectPrivacy` pattern as name/phone search

## UI

### Address section in AccountForm

- New form section between preferences and privacy sections
- Search input at top with autocomplete dropdown
- "Fill in manually" link below search
- Field group: country, region, city, street, building, apartment, postalCode — all editable
- If address already saved: fields pre-populated, search box still available to re-search
- Own save button, pending/error/success state — same pattern as other sections

### Privacy toggle

- New toggle in privacy section: "Allow others to find me by address"
- Same Switch component, same pattern as allowFindByName/allowFindByPhone

## Architecture

### Domain

- New value object: `src/domain/user/Address.ts` — validates required fields (country, city, street, building)
- `User` entity: optional `address` property, `updateAddress(address)` method
- `User.updatePrivacySettings()` extended with `allowFindByAddress`

### Application

- `UpdateUserProfileUseCase` extended with optional address fields
- `UpdateUserProfileSchema` extended with address Zod validation
- `CompletePrivacySetupUseCase/Schema` extended with `allowFindByAddress`

### Infrastructure

- Prisma migration: new `Address` model
- `PrismaUserRepository`:
  - `USER_SELECT` includes address relation
  - `save()` handles address upsert
  - `updatePrivacySettings()` transaction includes `allowFindByAddress`
  - `searchUsers()` extended with address filtering
- `UserPrivacyAuditLog` gets `allowFindByAddress` column

### Web

- `updateProfileAction` handles address fields
- `AccountForm` extended with address section + privacy toggle
- New component: `src/web/components/account/AddressSearch.tsx` (Nominatim autocomplete)
- Localization keys in en.json and ru.json

### No new use cases or server actions — extends existing ones.
