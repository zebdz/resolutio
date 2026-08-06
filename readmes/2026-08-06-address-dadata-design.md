# Address: DaData provider + required apartment

Date: 2026-08-06
Status: approved design, not yet implemented
Supersedes the Nominatim portion of `2026-04-01-user-address-design.md`

## Problem

Two related problems in the address form (`src/web/components/account/AddressForm.tsx`,
`src/web/components/account/AddressSearch.tsx`):

1. **Apartment is never suggested.** The autocomplete uses Nominatim (OpenStreetMap),
   which maps building footprints, not flats. There is no apartment data to offer.
2. **Apartment is optional.** A user in an apartment block can save an address with no
   flat number, producing an address that is useless for a legal document.

## Empirical findings

All verified against the live DaData API on 2026-08-06 using
`POST https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address`.
Test building: Гвардейский пер, д 13, Ростов-на-Дону.

### Nominatim has no flat data

Response for the test building contains `"type": "apartments"` — the OSM
`building=apartments` tag, describing the building kind — but the `address` object
carries no `unit`/`flat` field. Confirmed: nothing to suggest.

### DaData does have flat data

Flats 1, 2, 3, 4, 10, 11, 12, 20, 21, 22 all resolve, each with its own `flat_fias_id`.
`flat`, `flat_type`, `flat_fias_id` are returned on the current tariff. Only
`flat_area`, `flat_price`, `flat_cadnum` require the Максимальный plan — we do not need them.

### Two documented approaches do NOT work

| Approach                                 | Result                                                                |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `locations: [{ fias_id: <house fias> }]` | **0 results.** `locations` constrains down to street, not house.      |
| `to_bound: { value: "flat" }`            | **Does not filter.** House-level rows still return with `flat: null`. |

### What does work

Append the flat fragment to the house's `value` string as plain text:

```json
{ "query": "г Ростов-на-Дону, Гвардейский пер, д 13 кв 2", "count": 20 }
```

→ returns кв 2, 20, 21, 22.

Results must be filtered on `data.flat !== null` in our code, since `to_bound` does not do it.

**No full enumeration.** Bare `"…д 13 кв"` with `count: 20` returned only 4 flats.
DaData does prefix matching, not listing. Type-ahead works; "pick from all apartments
in this building" is not possible.

### Foreign coverage requires a flag

Without `locations: [{ "country": "*" }]` every non-RU query returns 0.
With it:

| Scope                             | Detail            | Verified example                              |
| --------------------------------- | ----------------- | --------------------------------------------- |
| Russia                            | to apartment      | `…Гвардейский пер, д 13, кв 2`                |
| Belarus / Kazakhstan / Uzbekistan | to house, no flat | `Беларусь, г Минск, пр-кт Независимости, д 4` |
| All other countries               | **city only**     | `Германия, г Берлин`                          |

Critical caveat: for city-only countries a street token kills the match.
`"Berlin"` → 2 results; `"Berlin Alexanderplatz"` → 0. Nominatim _does_ resolve
street+house there.

### FIAS codes are perishable; the one-line string is not

`fias_actuality_state`: `0` актуальный, `1–50` переименован, `51` переподчинён, `99` удалён.
DaData's own guidance is to store the address as a single string alongside the code.

Verified round-trip: feeding **only** the string
`"344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 2"` back into
`suggest` recovered the identical `flat_fias_id`. `suggest` additionally resolves
historical names to current addresses (Свердловск → Екатеринбург); `findById` matches
current codes only.

Conclusion: store both. `unrestricted_value` is the durable anchor, the fias ids are the
precise but perishable key.

### Language

`language: "en"` returns transliterated values
(`Russia, Rostov-on-Don city, pereulok Gvardeysky, dom 13`).

**Decision: always request `language: "ru"` for stored data.** Addresses feed Russian
legal documents and must be in Russian regardless of UI locale.

## Decisions

| Decision                     | Choice                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Primary provider             | DaData                                                                                                  |
| Fallback                     | Nominatim, used when DaData returns 0 results (see "How the provider is chosen")                        |
| «Частный дом» toggle default | Set by a DaData flat probe where possible, otherwise off (apartment required); user can always override |
| Provenance                   | Store `oneLine` + `houseFiasId` + `flatFiasId`                                                          |
| Transport                    | Route handler, not server action                                                                        |
| Backfill                     | Existing rows with `apartment IS NULL` → `is_private_house = true`                                      |
| Stored language              | Always Russian                                                                                          |

## Data model

`prisma/schema.prisma`, model `Address`:

```prisma
isPrivateHouse Boolean @default(false) @map("is_private_house")
oneLine        String? @map("one_line")        // DaData unrestricted_value
houseFiasId    String? @map("house_fias_id")
flatFiasId     String? @map("flat_fias_id")
```

Deliberately **not** stored:

- `fias_actuality_state` — always `0` at capture time, so it tells us nothing later.
- a `provider` column — presence of `oneLine` already implies a DaData selection.

### Migration

```sql
ALTER TABLE addresses
  ADD COLUMN is_private_house BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN one_line        TEXT,
  ADD COLUMN house_fias_id   TEXT,
  ADD COLUMN flat_fias_id    TEXT;

UPDATE addresses SET is_private_house = true WHERE apartment IS NULL;
```

The backfill is required for correctness, not convenience: without it, every existing
apartment-less row would violate the new invariant and throw on load.

### Accepted risk: the deploy write window

Migrations run automatically in production — `deploy-on-server.sh:58` calls
`migrate-production.sh`, which runs `prisma migrate deploy`. That happens **before** the
old server is killed (line 61), so there is a window of seconds to a minute in which the
backfill has run but old code is still serving and still writing.

Old code does not know about `is_private_house`, so an address it saves in that window
gets the column default `false` with a possibly-NULL `apartment`. Reconstitution calls
`Address.create()`, which throws `APARTMENT_REQUIRED` — that user's pages then 500 until
the row is fixed by hand.

**Decision: accepted.** Reconstitution stays strict; there is deliberately no
`fromPersistence` escape hatch. The invariant is enforced everywhere without exception,
at the cost of tolerating this window. The same exposure applies to a restored backup
predating the migration, or a rollback-then-roll-forward.

Recovery, should it ever fire — the backfill is idempotent and safe to re-run:

```sql
UPDATE addresses SET is_private_house = true
 WHERE apartment IS NULL AND is_private_house = false;
```

A row hitting this is identifiable in logs by the thrown code
`domain.user.address.apartmentRequired` on a read path rather than a write path.

Run `yarn prisma:generate` after `prisma migrate dev` — this repo does not regenerate
the client automatically.

## Domain

`src/domain/user/Address.ts`:

- `AddressProps` gains `isPrivateHouse: boolean` and optional `oneLine`, `houseFiasId`, `flatFiasId`.
- New code `AddressDomainCodes.APARTMENT_REQUIRED = 'domain.user.address.apartmentRequired'`.
- New invariant in `create()`:

  ```ts
  if (!props.isPrivateHouse && !props.apartment?.trim())
    throw new Error(AddressDomainCodes.APARTMENT_REQUIRED);
  ```

- When `isPrivateHouse` is true, `apartment` is forced to `undefined` — the aggregate
  never holds a contradictory "private house with flat 12".
- `equals()` and `toPlain()` extended to cover the new fields.

### Provenance consistency

If a user hand-edits street or building after picking from DaData, the stored ids and
one-liner no longer describe the address. Rule: **any manual edit to a structured field
clears `oneLine`, `houseFiasId` and `flatFiasId`.** Enforced in the form's
`handleFieldChange`, so a hand-built address simply carries no provenance.

## Infrastructure

`src/infrastructure/address/DaDataAddressProvider.ts` — token read from
`process.env.DADATA_API_KEY`, server-side only.

```ts
suggestAddress(query: string): Promise<AddressSuggestion[]>   // house level
suggestFlats(houseValue: string, fragment: string): Promise<FlatSuggestion[]>
```

There is deliberately no separate `hasFlats` method. The "is this an apartment block"
probe is `suggestFlats(label, '').length > 0`, served by the same route the apartment
dropdown already uses — a dedicated method would be a second name for one behaviour.

- All calls send `language: "ru"` and `locations: [{ country: "*" }]`.
- `suggestFlats` filters `data.flat !== null`.
- Nominatim stays behind `src/infrastructure/address/NominatimAddressProvider.ts`,
  also requesting `Accept-Language: ru` so both providers store Russian consistently.

### How the provider is chosen

We cannot know the country before the user has typed, so selection is **result-driven,
not country-driven**:

1. Query DaData first.
2. If it returns ≥ 1 suggestion, use those.
3. If it returns 0, fall back to Nominatim and use its results.

This resolves the city-only problem exactly. `"Berlin Alexanderplatz"` returns 0 from
DaData (verified), so it falls through to Nominatim, which does resolve street and house.
`"Berlin"` alone returns from DaData and never reaches the fallback. Russian addresses
never reach the fallback at all.

Cost: one wasted DaData call per foreign street query. Acceptable — foreign addresses are
the minority case, and the alternative (guessing country from locale) misroutes any user
whose UI language differs from where they live.

Both providers normalize to one `AddressSuggestion` shape. Flat suggestions are only ever
offered when the selected suggestion came from DaData and carries a `houseFiasId`.

## Route handler and rate limiting

`src/app/api/address/suggest/route.ts` and `src/app/api/address/flats/route.ts`.

Both call `checkRateLimit()` at the top, matching
`src/app/api/polls/[pollId]/legal-check/route.ts`.

### Budget

Middleware (`src/proxy.ts`) covers `/api` routes at **120 req/min per session**. Two
type-ahead streams can consume this quickly, so:

- keep the 300 ms debounce and the 3-character minimum already in `AddressSearch`;
- memoize responses per query string on the client so backspacing costs nothing;
- add a dedicated `addressSuggest` limiter to `src/infrastructure/rateLimit/registry.ts`
  as a second layer protecting the DaData daily quota (free tier: 10,000/day), separate
  from the middleware session budget.

The dedicated limiter guards our DaData quota; the middleware limiter guards the app.
They are not redundant.

## UI

### `AddressSearch.tsx`

- Calls our route handler instead of `https://nominatim.openstreetmap.org` directly.
  The DaData token must never reach the browser.
- On select: fills structured fields from the suggestion, captures
  `oneLine` / `houseFiasId`, then **resets apartment and the toggle**.
- Field mapping comes from DaData pre-parsed (`region_with_type`, `city`,
  `street_with_type`, `house`, `postal_code`), replacing the hand-rolled Nominatim
  mapping at `AddressSearch.tsx:104-116`. This yields "Ростовская обл" rather than
  Nominatim's raw "Ростовская область".

### `AddressForm.tsx`

- New «Частный дом» `SwitchField` using the existing pattern from
  `AccountForm.tsx:202-224` (`color="brand-green"`). Always rendered, including for
  foreign addresses.

Toggle default after a house is selected:

| Situation                                      | Default                      | Rationale                                        |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------ |
| DaData house, probe finds flats                | off — apartment required     | It is demonstrably an apartment block            |
| DaData house, probe finds none                 | on — apartment optional      | Most likely a private house                      |
| Nominatim result, or city-only foreign address | **off — apartment required** | No probe possible; fall back to the safe default |

The last row matters: when we cannot probe, we require an apartment and make the user
opt out deliberately. That is the original requirement — required unless explicitly
declared a private house — and it never silently lets an apartment dweller save a
flat-less address.

- Квартира becomes a suggest input when `houseFiasId` is set and the toggle is off;
  plain text otherwise.
- Submit disabled and an inline error shown when the toggle is off and apartment is empty.
- Checking the toggle clears the apartment value.

### Bug fixed in passing

`AddressForm.tsx:86` currently does `setValues((prev) => ({ ...prev, ...fields }))`, and
`fields` never contains `apartment`. Selecting a different building today silently carries
the previous apartment number onto the new address. The reset in the new select handler
removes this.

## Localization

New keys in `messages/en.json` and `messages/ru.json`:

| Key                                      | ru                                          | en                                          |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `account.addressPrivateHouse`            | Частный дом                                 | Private house                               |
| `account.addressPrivateHouseDescription` | В частном доме нет номера квартиры          | A private house has no apartment number     |
| `account.addressApartmentRequired`       | Укажите квартиру или отметьте «Частный дом» | Enter an apartment or check "Private house" |
| `domain.user.address.apartmentRequired`  | Укажите номер квартиры                      | Apartment number is required                |

Server-side translation goes through `translateErrorCode` from
`@/web/actions/utils/translateErrorCode`, per CLAUDE.md.

## Validation layers

1. **Domain** — `Address.create()` throws `APARTMENT_REQUIRED`. Single source of truth.
2. **Application** — `UpdateUserProfileSchema.ts` gains a cross-field refinement so the
   user gets a field-level error rather than a thrown domain error.
3. **UI** — submit disabled plus inline message.

## Testing

Unit tests first, per CLAUDE.md.

- `src/domain/user/__tests__/Address.test.ts`
  - throws `APARTMENT_REQUIRED` when not a private house and apartment is blank
  - accepts a blank apartment when `isPrivateHouse` is true
  - forces `apartment` to `undefined` when `isPrivateHouse` is true
  - `equals()` / `toPlain()` cover the new fields
- `UpdateUserProfileSchema` — cross-field refinement produces a field error on `address.apartment`
- `DaDataAddressProvider` — against recorded fixtures, no live calls:
  - filters out `flat: null` rows
  - maps `region_with_type` / `street_with_type` correctly
  - returns no flats when the response contains only non-flat rows
  - returns an empty list when DaData errors, so the resolver can fall back
- Provider resolver — falls back to Nominatim only when DaData returns 0 suggestions,
  and never calls Nominatim when DaData returned results

## Out of scope

- Backfilling `oneLine` / fias ids for existing addresses. They stay null until the user
  next edits their address.
- Re-validating stored addresses against ГАР on a schedule.
- `flat_area` / `flat_price` (Максимальный tariff).
- Address collection during registration — this covers the account page only.

## Operational note

The DaData API key was pasted into a chat transcript during this investigation and should
be regenerated in the DaData dashboard. It belongs in `.env` only.

## Resolved during design

1. **Always-Russian storage is accepted**, including the consequence that an
   English-locale user sees a Russian address in their own profile form. Legal documents
   outweigh the display oddity.
2. **The «Частный дом» toggle is always shown**, including for city-only foreign
   addresses where we have no house data. Those users fill street, building and apartment
   manually, and the toggle governs whether apartment is required exactly as it does for
   Russian addresses.
