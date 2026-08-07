# Anonymous polls and the named protocol — design

**Date:** 2026-08-07
**Status:** approved, not yet implemented

## 1. Problem

Today every poll behaves the same way:

- Only an org admin or superadmin can see **how each person voted** (`GetPollResultsUseCase.canViewVoters`,
  surfaced through `VoterBreakdownDialog`).
- Non-admins cannot open the results page at all while the poll is `ACTIVE`.
- The exported protocol (`/api/polls/[pollId]/results/pdf`) carries only per-answer counts, weights,
  percentages and a winner mark, and is only exportable once the poll is `FINISHED`.

For most decisions an organization takes, that secrecy is the wrong default. Members want a document
that shows **who voted for what**, and they want it while the vote is still running, not only after it
closes. Secret voting should be the deliberate exception.

## 2. Ubiquitous language

| Term                                          | Meaning                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| **anonymous poll**                            | Opt-in at creation. Behaves exactly as every poll behaves today.                 |
| **named poll**                                | The default. Voter identities are part of the record.                            |
| **protocol**                                  | The existing results document — counts, weights, percentages, winner. Unchanged. |
| **named protocol** (RU: _поимённый протокол_) | The new document. Per question and answer, who voted for it.                     |
| **register** (RU: _реестр участников_)        | Table at the head of the named protocol: person → holdings → weight.             |
| **holdings**                                  | A voter's in-scope property assets — building, unit, area, share.                |

## 3. Decisions

### 3.1 Visibility matrix

Viewer facts are `isAdmin` (org admin or superadmin), `isOrgMember`, `isPollVoter` (has a
`PollParticipant` row).

| Capability                                    | anonymous poll                     | named poll                    |
| --------------------------------------------- | ---------------------------------- | ----------------------------- |
| View results — `ACTIVE`                       | admin only                         | admin, org member, poll voter |
| View results — `DRAFT` / `READY` / `FINISHED` | admin, org member, open-poll voter | same                          |
| View voter names                              | admin only                         | anyone who can view results   |
| Export protocol (existing PDF)                | `FINISHED` only                    | `ACTIVE` or `FINISHED`        |
| Export named protocol                         | never — no such document           | `ACTIVE` or `FINISHED`        |
| View sign-willingness + phone numbers         | **admin only**                     | **admin only**                |

The last row is why `canViewVoters` has to be split. It currently gates both the voter breakdown and
`protocolSignWillingness`, which carries **phone numbers** collected under a separate combined consent.
Opening voter names to members without splitting the flag would leak those numbers to the whole org.

### 3.2 Settled choices

- **Separate document.** The named protocol is its own PDF and its own route. The existing protocol is
  untouched byte-for-byte.
- **Create-only flag.** `anonymous` is set once, at creation, and is immutable thereafter — including in
  `DRAFT`. An admin who picks wrong recreates the poll. Rationale: a voter decides whether to vote based
  on the privacy label, so the label must not be able to change under them.
- **Visible up front.** The flag shows as a badge on `PollCard` and as a notice above the ballot on the
  vote page, so nobody votes without knowing which kind of poll they are in.
- **Open polls may be named.** An `OPEN` poll's electorate is every verified platform user. When it is
  named, the named protocol is visible to org members _and_ to any outsider who cast a vote in it —
  extending the existing `isOpenPollVoter` carve-out to the `ACTIVE` state as well.
- **Board polls follow org membership.** A named board-scoped poll's protocols are visible to all org
  members, matching the org-level check the results path already uses.
- **Preliminary marking.** A protocol exported while the poll is still `ACTIVE` is stamped
  `[ПРЕДВАРИТЕЛЬНЫЙ]` in its header. An unmarked interim document could be mistaken for a final one.
- **Existing polls become named.** Accepted risk, decided explicitly: the migration adds
  `anonymous BOOLEAN NOT NULL DEFAULT false` with no backfill, so every poll already in the database —
  including finished ones whose voters cast ballots under the old admin-only rule — becomes named and
  has its voter names exposed to its org retroactively.

### 3.3 Holdings in the named protocol

For a **property-based** poll (`isOwnershipMode(distributionType)` — `OWNERSHIP_UNIT_COUNT` or
`OWNERSHIP_SIZE_WEIGHTED`) the register lists each person's property, e.g.
`Дом Гвардейский 13, кв. 738, 64 м²; Дом Гвардейский 13, кв. 737, 43 м²`.

- `OrganizationProperty.name` → building, `PropertyAsset.name` → unit,
  `PropertyAsset.size` + `OrganizationProperty.sizeUnit` → area. The unit renders through the existing
  `SizeUnit.translationKey()` → `propertyAdmin.sizeUnit.*` (`squareMeters` → `м²`).
- Partial ownership appends a share suffix — `доля 50%` — whenever `share < 1`. `share` is
  `Decimal(9,8)`, so a percentage renders every value cleanly; fractions would not.
- **As of the poll snapshot.** Holdings are read as of each participant's `PollParticipant.snapshotAt`,
  the same instant that fixed their weight. If a flat changes hands after the vote, the document still
  explains the weight printed beside it.
- **In-scope only.** Holdings are filtered by the poll's `propertyIds` (empty = the whole org tree), so
  the listed areas are exactly the assets that produced the weight.
- An `EQUAL` poll has no holdings column at all. `OPEN` polls are always `EQUAL`, so holdings never
  apply to them.

### 3.4 Document shape

```
ПОИМЁННЫЙ ПРОТОКОЛ                              [ПРЕДВАРИТЕЛЬНЫЙ]
Организация / Правление / Голосование / Описание / Период

РЕЕСТР УЧАСТНИКОВ
 №  ФИО              Собственность                        Вес
 1  Иванов И. И.     Дом Гвардейский 13, кв. 738, 64 м²;  107.00
                     Дом Гвардейский 13, кв. 737, 43 м²
 2  Петров П. С.     Дом Гвардейский 13, кв. 12, 18 м²,    18.00
                     доля 50%
 3  Кузнецов Д. А.   Дом Гвардейский 13, кв. 9, 12 м²      12.40
 4  Волков С. С.     Дом Гвардейский 13, кв. 41, 4 м²       4.10

Вопрос 1. Утвердить бюджет?                        (одиночный выбор)
  1. Да — 2 голоса, вес 125.00 (72.10%)                     ✓ принято
       1. Иванов И. И.        107.00
       2. Петров П. С.         18.00
  2. Нет — 1 голос, вес 12.40 (12.40%)
       1. Кузнецов Д. А.       12.40
  Не голосовали (1):
       1. Волков С. С.          4.10

Председатель ____  Секретарь ____  Дата ____  М.П.
```

The register lists **every participant** — voters and non-voters alike — so both the per-answer lists and
the `Не голосовали` block can reference it by name. It appears once, so per-answer lines stay short and a
multi-choice voter appearing under several answers does not repeat their holdings. The `Собственность`
column is omitted entirely for non-property polls, and the `Не голосовали` block is omitted for `OPEN`
polls, which have no fixed electorate to be absent from.

## 4. Domain layer

### 4.1 `src/domain/poll/Poll.ts`

- `PollProps` gains `anonymous: boolean`.
- `Poll.create(..., pollType = PollType.ORGANIZATION, anonymous = false)` — new trailing parameter.
- `public isAnonymous(): boolean`.
- **No mutator.** `UpdatePollUseCase` is not touched, so nothing can change the flag after creation.

### 4.2 `src/domain/poll/PollResultsPolicy.ts` — new

Single source of truth for "what may this viewer see of this poll's results", mirroring the shape of the
existing `PollVotingPolicy`: pure, facts in, `Result` or boolean out, no I/O.

```ts
export interface ResultsViewerFacts {
  isAdmin: boolean;
  isOrgMember: boolean;
  isPollVoter: boolean;
}

function canViewResults(poll: Poll, facts: ResultsViewerFacts): Result<void, string>;
function canViewVoterNames(poll: Poll, facts: ResultsViewerFacts): boolean;
function canViewSignWillingness(facts: ResultsViewerFacts): boolean;
function canExportProtocol(poll: Poll, facts: ResultsViewerFacts): Result<void, string>;
function canExportNamedProtocol(poll: Poll, facts: ResultsViewerFacts): Result<void, string>;

export const PollResultsPolicy = { ... };
```

Rules:

```
canViewResults:
  isAdmin                                  → success
  audience = isOrgMember || (poll.isOpen() && isPollVoter)
  !audience                                → failure(POLL_RESULTS_NOT_ORG_MEMBER)
  poll.isAnonymous() && poll.isActive()    → failure(POLL_RESULTS_ADMIN_ONLY)
  otherwise                                → success

canViewVoterNames:
  isAdmin                                  → true
  poll.isAnonymous()                       → false
  otherwise                                → canViewResults(...).success

canViewSignWillingness:
  facts.isAdmin

canExportProtocol:
  canViewResults must succeed, else propagate
  poll.isFinished()                        → success
  !poll.isAnonymous() && poll.isActive()   → success
  otherwise                                → failure(POLL_PROTOCOL_NOT_AVAILABLE)

canExportNamedProtocol:
  poll.isAnonymous()                       → failure(POLL_IS_ANONYMOUS)
  !(poll.isActive() || poll.isFinished())  → failure(POLL_PROTOCOL_NOT_AVAILABLE)
  !canViewVoterNames(...)                  → failure(POLL_RESULTS_ADMIN_ONLY)
  otherwise                                → success
```

Note `isActive()` and `isFinished()` are mutually exclusive states, so `DRAFT`/`READY` polls fall through
to the member branch of `canViewResults` exactly as they do today (empty results, no protocol).

### 4.3 `src/domain/poll/PollDomainCodes.ts`

New codes, returned by the policy the way `PollVotingPolicy` already returns domain codes:

- `POLL_RESULTS_ADMIN_ONLY: 'domain.poll.pollResultsAdminOnly'`
- `POLL_RESULTS_NOT_ORG_MEMBER: 'domain.poll.pollResultsNotOrgMember'`
- `POLL_PROTOCOL_NOT_AVAILABLE: 'domain.poll.pollProtocolNotAvailable'`
- `POLL_IS_ANONYMOUS: 'domain.poll.pollIsAnonymous'`

The literals `poll.errors.resultsAdminOnly` and `poll.errors.notOrganizationMember` are referenced only
by `GetPollResultsUseCase`, its test, and the protocol-pdf route. All three move to the new codes, and
the two orphaned message keys are removed from `en.json` / `ru.json`.

## 5. Data layer

```sql
ALTER TABLE polls ADD COLUMN anonymous BOOLEAN NOT NULL DEFAULT false;
```

`prisma/schema.prisma`, model `Poll`: `anonymous Boolean @default(false)`. No `@map` needed — the column
name already matches. No backfill, per §3.2.

Run `yarn prisma:generate` after `prisma migrate dev` — migration does not regenerate the client in this
repo.

## 6. Application layer

### 6.1 `CreatePollUseCase` / `PollSchemas`

`CreatePollInput` gains `anonymous?: boolean`; `createPollSchema` gains
`anonymous: z.coerce.boolean().default(false)` (the form posts a string). The value is passed to
`Poll.create`. `updatePollSchema` is deliberately not changed.

### 6.2 `GetPollResultsUseCase`

- Authorization is replaced by `PollResultsPolicy.canViewResults`. `isPollVoter` is resolved by looking up
  the participant row; today that lookup is skipped for members, so the facts assembly is hoisted ahead
  of the decision.
- `GetPollResultsResult` changes:
  - `canViewVoters: boolean` → `canViewVoterNames: boolean` + `canViewSignWillingness: boolean`
  - gains `viewerFacts: ResultsViewerFacts`, so PDF routes can ask the policy about export rights
    without re-deriving the facts. **Server-side only — never serialized to a client component.**
- `protocolSignWillingness` continues to be populated only when `canViewSignWillingness`.
- No other change. In particular it does **not** learn about non-voters or holdings; it is on the results
  page hot path and should not grow property reads.

### 6.3 `GetNamedProtocolUseCase` — new

Owns the named protocol read model. Used only by the named-pdf route.

```ts
export interface NamedProtocolHolding {
  propertyName: string;
  assetName: string;
  size: number;
  sizeUnitKey: string; // e.g. 'propertyAdmin.sizeUnit.squareMeters'
  share: number; // 1 = sole owner
}

export interface NamedProtocolPerson {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  weight: number;
  holdings: NamedProtocolHolding[];
}

export interface NamedProtocolAnswer {
  answerId: string;
  answerText: string;
  voteCount: number;
  totalWeight: number;
  percentage: number;
  voters: Array<{ userId: string; weight: number }>; // reference into the register
}

export interface NamedProtocolQuestion {
  questionId: string;
  questionText: string;
  questionDetails: string | null;
  questionType: string;
  answers: NamedProtocolAnswer[];
  totalVotes: number;
  totalWeight: number;
  participantWeight: number;
  nonVoterIds: string[];
}

export interface GetNamedProtocolResult {
  poll: Poll;
  register: NamedProtocolPerson[]; // sorted by last, first, middle name
  questions: NamedProtocolQuestion[];
  totalParticipants: number;
  totalParticipantWeight: number;
}
```

Flow:

1. Load the poll; assemble `ResultsViewerFacts`; `PollResultsPolicy.canExportNamedProtocol` — fail closed.
2. Load votes and participants; build the per-question / per-answer tallies with the same arithmetic
   `GetPollResultsUseCase` uses (unique-voter dedupe for `participantWeight`).
3. `nonVoterIds` = participant ids minus the unique voter ids **for that question**. Empty for `OPEN`
   polls.
4. If `isOwnershipMode(poll.distributionType)`: group participants by `snapshotAt` (normally one group)
   and issue one `findHoldingsAsOf` call per distinct timestamp, scoped to
   `[organizationId, ...descendantIds]` and `poll.propertyIds`. Otherwise holdings are `[]`.
5. Build the register from participants + users + holdings.

Dependencies: `PollRepository`, `ParticipantRepository`, `VoteRepository`, `OrganizationRepository`,
`UserRepository`, `PropertyAssetRepository`.

Winner determination stays in the PDF generator, using the same rule as the existing protocol
(single-choice only, unique maximum weight).

## 7. Infrastructure layer

### 7.1 `PropertyAssetRepository` — new method

```ts
export interface HoldingRow {
  userId: string;
  propertyName: string;
  assetName: string;
  size: number;
  sizeUnit: string; // SizeUnitValue
  share: number;
}

findHoldingsAsOf(input: {
  organizationIds: string[]; // [rootOrgId, ...descendants]
  propertyIds: string[];     // empty = no property filter
  userIds: string[];
  asOf: Date;
}): Promise<Result<HoldingRow[], string>>;
```

Prisma query builder (no raw SQL): `propertyAssetOwnership` where `userId in userIds`,
`effectiveFrom <= asOf`, `effectiveUntil` null or `> asOf`, asset not archived, asset's property not
archived and in `organizationIds` (and in `propertyIds` when non-empty), including asset name/size and
property name/sizeUnit.

### 7.2 `PrismaPollRepository`

Map `anonymous` in `createPoll`, in `updatePoll` (persisted unchanged — the domain has no mutator), and
in the `Poll.reconstitute` mapper.

## 8. Web layer

### 8.1 New — named protocol PDF

- `src/web/lib/pdf/namedProtocolPdfGenerator.ts` — exports
  `buildNamedProtocolPdfDefinition(data, t)` and its `NamedProtocolPdfInput` /
  `NamedProtocolPdfTranslations` types. Reuses `generatePdfBuffer` and `pdfFonts` from
  `pollResultsPdfGenerator`. Renders §3.4: header (+ preliminary marker when the poll is `ACTIVE`),
  register table (holdings column omitted when not property-based), per-question answer blocks with
  numbered voter lists, `Не голосовали` block (omitted for `OPEN`), signature block, page numbers,
  generated-on.
- `src/app/api/polls/[pollId]/results/named-pdf/route.ts` — mirrors the existing protocol-pdf route:
  session → `GetNamedProtocolUseCase` (which enforces the policy) → org and board names → load
  `messages/<locale>.json` → build → return with a Cyrillic-safe `Content-Disposition`.
- `src/web/components/polls/results/ExportNamedProtocolPdfButton.tsx` — copy of `ExportPdfButton`
  pointing at the new endpoint.

### 8.2 Changed

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/api/polls/[pollId]/results/pdf/route.ts`          | `if (!poll.isFinished())` → `PollResultsPolicy.canExportProtocol(poll, viewerFacts)`                                                                                                                                                                                                                                                                                                 |
| `app/api/polls/[pollId]/results/protocol-pdf/route.ts` | gate on `canViewSignWillingness` instead of `canViewVoters`                                                                                                                                                                                                                                                                                                                          |
| `app/[locale]/polls/create/CreatePollForm.tsx`         | Catalyst `SwitchField` + `Switch` + `Description`; posts `anonymous` in the form data                                                                                                                                                                                                                                                                                                |
| `app/[locale]/polls/[pollId]/results/page.tsx`         | filter `voters` by `canViewVoterNames`, `protocolSignWillingness` by `canViewSignWillingness`; pass `isAnonymous` down; never serialize `viewerFacts`                                                                                                                                                                                                                                |
| `app/[locale]/polls/[pollId]/vote/page.tsx`            | pass `anonymous` and `isPropertyBased` to `VotingInterface`                                                                                                                                                                                                                                                                                                                          |
| `web/components/polls/results/PollResults.tsx`         | props `canViewVoterNames` / `canViewSignWillingness` / `isAnonymous`; show `ExportPdfButton` when `isFinished \|\| (!isAnonymous && isActive)`; show `ExportNamedProtocolPdfButton` when `!isAnonymous && (isActive \|\| isFinished) && canViewVoterNames`; amber `adminOnly` banner only for anonymous active polls, replaced by a "preliminary results" note on named active polls |
| `web/components/polls/PollCard.tsx`                    | badge beside `openBadge` — named and anonymous each get their own, so the state is never implicit; `canViewResultsBeforePollEnds = canManage \|\| !poll.anonymous`                                                                                                                                                                                                                   |
| `web/components/polls/voting/VotingInterface.tsx`      | notice above the ballot on named polls                                                                                                                                                                                                                                                                                                                                               |
| `web/actions/poll/poll.ts`                             | `createPollAction` reads `anonymous` from the form data; poll-list serialization includes `anonymous`                                                                                                                                                                                                                                                                                |

### 8.3 Vote-page notice

Shown only on named polls, above the ballot:

- non-property: _your name will be listed next to the answers you choose, in a protocol available to
  every member of the organization._
- property-based: same, plus _…along with your property in the organization (building, unit, area)._

## 9. Localization

New keys in `messages/en.json` and `messages/ru.json`:

- `poll.anonymous.label`, `.description`, `.namedBadge`, `.anonymousBadge`
- `poll.voting.namedNotice`, `poll.voting.namedNoticeProperty`
- `poll.results.preliminaryNote`, `poll.results.exportNamedPdf`
- `poll.results.namedPdf.*` — `title`, `preliminary`, `exporting`, `organization`, `board`, `pollName`,
  `description`, `period`, `register`, `columnNumber`, `columnFullName`, `columnHoldings`,
  `columnWeight`, `share`, `question`, `questionType`, `singleChoice`, `multipleChoice`, `answerNumber`,
  `votes`, `weight`, `percentage`, `winnerMark`, `didNotVote`, `chairman`, `secretary`, `date`, `stamp`,
  `pageOf`, `generatedOn`
- `domain.poll.pollResultsAdminOnly`, `.pollResultsNotOrgMember`, `.pollProtocolNotAvailable`,
  `.pollIsAnonymous`

Removed: `poll.errors.resultsAdminOnly`, `poll.errors.notOrganizationMember`.

Counts in messages use parameters, never hardcoded numbers — e.g. `didNotVote: "Не голосовали ({count})"`.

## 10. Testing

TDD, unit-first.

- **`PollResultsPolicy.test.ts`** — the centre of gravity. Full matrix: {anonymous, named} × {DRAFT,
  READY, ACTIVE, FINISHED} × {admin, org member, open-poll voter, outsider} × {ORGANIZATION, OPEN}, for
  each of the five functions. Every access rule lives here, so the use-case tests only need to prove
  delegation.
- **`Poll.test.ts`** — `anonymous` defaults to `false`; `create` honours the argument; `reconstitute`
  round-trips it; no code path mutates it.
- **`GetPollResultsUseCase.test.ts`** — updated for the split flags and the new domain error codes;
  asserts `protocolSignWillingness` stays empty for a non-admin member of a _named_ poll.
- **`GetNamedProtocolUseCase.test.ts`** — register assembly and sort order; `nonVoterIds` per question
  including the multi-choice dedupe case and a voter who answered Q1 but not Q2; `nonVoterIds` empty for
  `OPEN`; holdings empty for `EQUAL`; holdings filtered by `propertyIds`; holdings read at `snapshotAt`
  rather than now (ownership sold after the snapshot still shows the old owner); refusal on an anonymous
  poll; refusal for a non-member.
- **`namedProtocolPdfGenerator.test.ts`** — doc-definition assertions mirroring the existing generator
  tests: holdings column present/absent, preliminary marker present only when `ACTIVE`, `Не голосовали`
  block present/absent, share suffix only when `share < 1`, winner mark on the unique single-choice
  maximum.
- **Route test** — a member is refused the named PDF on an anonymous poll (403), and served it on a
  named active poll.

## 11. Out of scope

- No on-screen named breakdown beyond the existing `VoterBreakdownDialog`, which simply becomes visible
  to members on named polls. The `Не голосовали` list and the register live in the PDF only.
- The named protocol is not attached to reports, notifications, or the signing flow.
- The anonymous flag is not exposed in the edit form, by design (§3.2).
