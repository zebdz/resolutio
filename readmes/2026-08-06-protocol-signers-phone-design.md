# Protocol Signers — Phone Number Sharing

**Date:** 2026-08-06
**Status:** Approved, not yet implemented

## Problem

At the end of a poll, a voter toggles "willing to sign the final protocol". Admins get a report (on-screen list + PDF export) of who is willing and who is not.

The report shows names only. To actually collect signatures, an admin has to contact each willing person — and has no way to reach them from the report.

## Solution

Fold phone-number sharing into the same consent, and surface the number to admins in both the on-screen report and the PDF.

The toggle's meaning becomes: **"Ready to sign the protocol and share my phone number for contact."**

## Key decision: phone appears only in the "ready to sign" list

Someone who toggled the switch off declined the whole combined statement. Showing their number would contradict the label they read.

- Ready-to-sign list → name + phone
- Not-ready list → name only, unchanged

This holds in both the on-screen report and the PDF.

## Decisions taken

| Question                                                                | Decision                                                      | Rationale                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Consents recorded under the old wording (which never mentioned a phone) | Show their phones anyway; reuse `willingToSignProtocol` as-is | No schema change. Accepted because no polls exist on production yet, so there is no real prior consent to widen.                  |
| Toggle default state                                                    | Stays ON (`useState(true)`)                                   | Intended. Maximizes the willing-list size. Same reasoning: no production polls, and the label now names the phone explicitly.     |
| Phone display format                                                    | As stored — E.164, e.g. `+79161234567`                        | It is the login identifier, already normalized. Admins need to dial it.                                                           |
| Relationship to `allowFindByPhone`                                      | Untouched, unrelated                                          | That setting governs user-to-user discoverability. This is a per-poll consent to share with organization admins. Do not conflate. |

## Data flow

No schema change. `PollParticipant.willingToSignProtocol` (`Boolean?`) already carries the consent.

`UserRepository.findByIds` already returns full `User` entities in `GetPollResultsUseCase`, so the phone is available with no extra query.

| Layer            | File                                                       | Change                                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application      | `src/application/poll/GetPollResultsUseCase.ts`            | `ProtocolSignWillingnessEntry` gains `phoneNumber: string \| null`. Populated from `user.phoneNumber.getValue()` **only when `willingToSignProtocol === true`**, otherwise `null`. The whole block already sits behind `if (isAdmin)`. |
| Serialization    | `src/app/[locale]/polls/[pollId]/results/page.tsx`         | Add `phoneNumber: entry.phoneNumber` inside the existing `canViewVoters ? … : []` gate.                                                                                                                                                |
| On-screen report | `src/web/components/polls/results/PollResults.tsx`         | Ready-to-sign `<li>` renders name + phone as a `tel:` link. Not-ready loop untouched.                                                                                                                                                  |
| PDF              | `src/web/lib/pdf/protocolSignersPdfGenerator.ts`           | `buildSignersTable` takes a `showPhone` flag. Ready table → 3 columns, widths `[30, '*', 110]`. Not-ready table → current 2 columns.                                                                                                   |
| PDF route        | `src/app/api/polls/[pollId]/results/protocol-pdf/route.ts` | Pass `phoneNumber` through in the `entries` map.                                                                                                                                                                                       |

### Interface change

```ts
// GetPollResultsUseCase.ts
export interface ProtocolSignWillingnessEntry {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
  phoneNumber: string | null; // non-null only when willingToSignProtocol === true
}

// protocolSignersPdfGenerator.ts
export interface ProtocolSignerEntry {
  firstName: string;
  lastName: string;
  middleName: string | null;
  willingToSignProtocol: boolean;
  phoneNumber: string | null;
}
```

## Wording

Both `messages/en.json` and `messages/ru.json`. Russian is the default language, so the Russian phrasing is the one that matters most in practice.

### Voting toggle (`poll.voting`)

| Key                                | EN                                                                                                                                           | RU                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `willingToSignProtocolTitle`       | Willing to sign the protocol and share my phone number for contact                                                                           | Готов подписать протокол и поделиться номером телефона для связи                                                                       |
| `willingToSignProtocolDescription` | I confirm my willingness to sign the final protocol of this vote and allow organization admins to see my phone number so they can contact me | Подтверждаю готовность подписать финальный протокол данного голосования и разрешаю администраторам видеть мой номер телефона для связи |

**Why first person, not "By enabling this…":** the toggle defaults to ON, so a voter who consents most often does so by _leaving it alone_ — "by enabling this" describes an action they never took. First person also matches the title ("Готов подписать…" / "…share my phone number") and avoids the Russian calque «Включая это», which parses as "Including this" before it parses as "By switching this on".

### Results report (`poll.results`)

| Key                     | EN                                | RU                                      |
| ----------------------- | --------------------------------- | --------------------------------------- |
| `willingToSignProtocol` | Willing to sign and share phone   | Готовы подписать и поделиться телефоном |
| `protocolNotWilling`    | Not willing to sign _(unchanged)_ | Не готовы подписать _(unchanged)_       |

`willingToSignProtocolCount` / `protocolNotWillingCount` are already parameterized — unchanged.

### PDF (`poll.results.protocolPdf`)

| Key                     | EN    | RU      |
| ----------------------- | ----- | ------- |
| `columnPhone` **(new)** | Phone | Телефон |

`willingSection`, `notWillingSection`, `title`, and the rest stay as they are.

**Terminology:** English keeps "willing", not "ready". English _willing_ is the direct counterpart of Russian _готов_, which the RU copy already used — so the two locales were never out of step, and the code identifiers (`willingToSignProtocol`, `protocolSignWillingness`, `willingSection`) keep matching the words on screen.

## Security

The phone must never reach a non-admin. Three existing gates already cover it, and all three stay in place:

1. `GetPollResultsUseCase` — `protocolSignWillingness` is only populated `if (isAdmin)`.
2. `results/page.tsx` — serialization is wrapped in `canViewVoters ? … : []`.
3. `protocol-pdf/route.ts` — re-checks `canViewVoters` before generating, returns 403 otherwise.

Nothing new is sent to the client outside those gates.

## Testing

TDD, unit tests preferred.

**`src/application/poll/__tests__/GetPollResultsUseCase.test.ts`** (extend)

- Ready-to-sign entry carries the participant's phone number.
- Not-ready entry has `phoneNumber === null` even though the user record has one.
- Non-admin caller gets an empty `protocolSignWillingness`, so no phone leaks.

**`src/web/lib/pdf/protocolSignersPdfGenerator.test.ts`** (new file, co-located beside its source — matching the existing `pollResultsPdfGenerator.test.ts`; there is no `__tests__/` dir under `src/web/lib/pdf/`)

- Ready table renders a phone column with the header from `columnPhone`.
- Not-ready table renders 2 columns and contains no phone string in any row.
- Empty ready list still produces a valid document definition.

## Out of scope

- Separating "ready to sign" from "share my phone" into two independent toggles. Deliberately one combined consent.
- Any change to `allowFindByPhone` or the privacy-setup flow.
- Letting an admin edit or export phones anywhere outside this report.
