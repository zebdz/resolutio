# Open Polls (platform-wide voting) — Design

Date: 2026-07-30
Status: approved design, not yet implemented

## Goal

Let **any verified (phone-confirmed) user of the platform** vote in a poll that belongs to an
organization — including users who are not members of that organization, and users who register or
join after the poll started. One person = one vote (weight 1). Such a poll is a new **poll type**:
`OPEN`.

Because the electorate is open-ended, an OPEN poll takes **no participant snapshot**. Results are
computed live from the votes cast, exactly as they already are for every poll (results are an
aggregation performed on read).

## Ubiquitous language

- **Open poll** — poll whose electorate is every verified platform user (`pollType = OPEN`).
- **Organization poll** — today's poll: electorate fixed by snapshot (`pollType = ORGANIZATION`).
- **Join-on-vote** — an open poll's voter becomes a `PollParticipant` at the moment they finish
  voting, not before.

## Non-goals

- Anonymous / logged-out voting. Voter identity is required (who voted, when, how).
- Any discovery feed or listing of open polls a user has not voted in. Distribution is **by
  shareable link only**. (Once a user votes, the poll shows up in their own `/polls` list — see §4.)
- Extending `canPollSatisfyReportAudience` so `PUBLIC_AUTH` reports may cite open polls. Natural
  follow-up; explicitly out of scope here.
- Changing a poll's type after creation.

## 1. Domain model

### 1.1 `PollType` value object — `src/domain/poll/PollType.ts`

Mirrors `DistributionType`:

```ts
export const PollType = {
  ORGANIZATION: 'ORGANIZATION',
  OPEN: 'OPEN',
} as const;
export type PollType = (typeof PollType)[keyof typeof PollType];
export function parsePollType(value: string): Result<PollType, string>;
```

Invalid value → `PollDomainCodes.POLL_TYPE_INVALID`.

### 1.2 `Poll` aggregate — `src/domain/poll/Poll.ts`

- `PollProps` gains `pollType: string`; getter `pollType`, predicate `isOpen()`.
- `Poll.create(...)` takes `pollType` (default `ORGANIZATION`) and enforces the OPEN invariants:
  - `boardId` must be `null` → `POLL_OPEN_CANNOT_BE_BOARD_SCOPED`
  - weight config is fixed to `EQUAL` / `RAW_SUM` / `[]`
- `applyWeightConfig()` on an OPEN poll rejects anything other than `EQUAL` / `RAW_SUM` / `[]` →
  `POLL_OPEN_MUST_BE_EQUAL`. (Signature changes from `void` to `Result<void, string>`; existing
  call sites in `CreatePollUseCase`, `UpdatePollWeightConfigUseCase` and tests must handle it.)
- Poll type is immutable: no setter. Switching type on an existing poll would invalidate a taken
  snapshot or already-cast votes.

### 1.3 `PollVotingPolicy` domain service — `src/domain/poll/PollVotingPolicy.ts`

Pure function, no I/O:

```ts
canVote(
  poll: Poll,
  facts: { isParticipant: boolean; isConfirmedUser: boolean; hasFinishedVoting: boolean }
): Result<void, string>
```

Rules, in order:

1. `poll.isFinished()` → `POLL_FINISHED`
2. `!poll.isActive()` → `POLL_NOT_ACTIVE`
3. ORGANIZATION and `!isParticipant` → `NOT_PARTICIPANT`
4. OPEN and `!isConfirmedUser` → `USER_NOT_CONFIRMED`
5. `hasFinishedVoting` → `ALREADY_VOTED`

This is the single place the type branch lives. Today the same participant/state checks are
re-implemented in `SubmitDraftUseCase`, `FinishVotingUseCase`, `GetUserVotingProgressUseCase` and
`canUserVoteAction`; all four switch to the policy.

### 1.4 New codes

`PollDomainCodes`:

- `POLL_TYPE_INVALID: 'domain.poll.pollTypeInvalid'`
- `POLL_OPEN_CANNOT_BE_BOARD_SCOPED: 'domain.poll.openCannotBeBoardScoped'`
- `POLL_OPEN_MUST_BE_EQUAL: 'domain.poll.openMustBeEqual'`
- `USER_NOT_CONFIRMED: 'domain.poll.userNotConfirmed'`

`PollErrors`:

- `OPEN_PARTICIPANTS_IMMUTABLE: 'poll.errors.openParticipantsImmutable'`
- `OPEN_CONFIG_FIXED: 'poll.errors.openConfigFixed'`

All added to `messages/en.json` and `messages/ru.json` (ru is the default language).

## 2. Persistence

`prisma/schema.prisma` — native PostgreSQL enum, following the existing `PollState` precedent:

```prisma
enum PollType {
  ORGANIZATION
  OPEN
}

model Poll {
  // ...
  pollType PollType @default(ORGANIZATION) @map("poll_type")
}
```

Rationale: poll type is a closed two-value concept, so the database itself should reject anything
else — the same argument that made `PollState` an enum. (`distribution_type` and
`property_aggregation` are plain strings because they gain values as ownership modes are added;
that is not the case here.) The migration is additive and backfill-free: existing rows take the
`ORGANIZATION` default. No index — open polls are never listed or filtered by type.

Cost accepted: adding a third value later needs an `ALTER TYPE ... ADD VALUE` migration, and the
new value cannot be used in the same transaction that adds it.

Mapping stays in infrastructure, so the domain keeps its own `PollType` VO and imports nothing from
Prisma (per the DDD rule that the domain has no ORM types). `PrismaPollRepository` gains
`toPrismaPollType` / `toDomainPollType` mirroring the existing `toPrismaState`, and
`toDomainPoll` / `createPoll` / `updatePoll` map the new column.

## 3. Lifecycle

State machine is unchanged: `DRAFT → READY → ACTIVE → FINISHED`.

| Step                                     | ORGANIZATION                                                                                                       | OPEN                                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create (`CreatePollUseCase`)             | any org member                                                                                                     | any org member, `boardId` must be null                                                                                                                                                                   |
| Edit questions/answers                   | creator or superadmin                                                                                              | same                                                                                                                                                                                                     |
| `DRAFT → READY` (`TakeSnapshotUseCase`)  | org admin / superadmin; resolves members, writes `PollEligibleMember` rows, computes weights, creates participants | org admin / superadmin; **validates questions/answers only**, then persists state via `pollRepository.updatePoll` — no members resolved, no eligible-member rows, no weight computation, no participants |
| `READY → ACTIVE` (`ActivatePollUseCase`) | org admin / superadmin                                                                                             | same                                                                                                                                                                                                     |
| `ACTIVE → FINISHED`                      | org admin / superadmin                                                                                             | same                                                                                                                                                                                                     |

Authorization already matches the requirement "any org member proposes, only an admin activates":
`CreatePollUseCase` checks `isUserMember`, edits check `createdBy` or superadmin, and both
`TakeSnapshotUseCase` and `ActivatePollUseCase` require org admin or superadmin. **No auth changes
needed.**

`DiscardSnapshotUseCase` (READY → DRAFT) works unchanged for OPEN polls: it only guards on
"has votes", and an OPEN poll in READY has none.

### Finishing

No recount / tally step is introduced. `GetPollResultsUseCase` aggregates `votes` on every read, so
an OPEN poll's results are live while ACTIVE (admins only) and frozen at FINISHED simply because no
further votes can be cast.

## 4. Join-on-vote

### Drafts — `SubmitDraftUseCase`

Eligibility check replaced by `PollVotingPolicy.canVote`. For an OPEN poll the voter has no
participant row yet, so eligibility is "confirmed user" — the use case gains a `UserRepository`
dependency to read `user.isConfirmed()`. This is defence in depth: `AuthenticatedLayout` and
`LoginUserUseCase` already bar unconfirmed users, but the rule belongs in the domain, not only in
the shell. Archived-org / archived-board guards stay as they are.

### Finishing — `FinishVotingUseCase`

ORGANIZATION path unchanged. OPEN path, after the existing draft validation:

1. Build votes with weight **1**.
2. Build `PollParticipant` (weight 1) and a `ParticipantWeightHistory` record
   `0 → 1`, `changedBy` = the voter themselves, reason `open-poll-join` — preserving the
   "who / when / in what manner" audit trail the platform requires.
3. Persist atomically via a new repository method:

```ts
// ParticipantRepository (domain port), implemented in PrismaParticipantRepository with $transaction
joinAndVote(
  participant: PollParticipant,
  history: ParticipantWeightHistory,
  votes: Vote[],
  willingToSignProtocol: boolean
): Promise<Result<void, string>>;
```

Precedent for a multi-entity transactional method on this port: `executeActivation`,
`applyWeightConfigChange`.

Concurrency: the participant row is created conflict-safe on the `(pollId, userId)` unique
constraint; `votes` are protected by `@@unique([questionId, userId, answerId])`. A double submit
therefore cannot produce a second participant row or duplicate votes, and the second call fails the
`ALREADY_VOTED` check.

Consequence: **participants of an OPEN poll = users who completed voting**, so
`totalParticipantWeight` = number of votes cast and every percentage is a share of votes cast. No
change to the results math.

Side effect worth keeping: after voting, the poll appears in that user's `/polls` list — the
existing `searchPolls` visibility clause already has a `participants: { some: { userId } }` branch.

## 5. Results and access

`GetPollResultsUseCase` authorization:

| Poll state | ORGANIZATION        | OPEN                                                                |
| ---------- | ------------------- | ------------------------------------------------------------------- |
| ACTIVE     | admins only         | admins only (unchanged)                                             |
| FINISHED   | org member or admin | org member, admin, **or anyone who voted** (participant row exists) |

An outsider who has the link but did not vote sees the poll, not the results.

Two web-layer reads must follow, or the rule above is unreachable:

- `getPollByIdAction` currently refuses non-members outright, and the results page calls it before
  rendering — so a voting outsider would be bounced before `GetPollResultsUseCase` ever ran. For an
  OPEN poll any authenticated user may read the poll itself; results access stays with the use case.
- `searchPollsAction` derives the list's "Vote" button from `canVote = !!participant`. An open poll
  has no participants until people vote, so even the organization's own members — the ones notified
  at activation — would see no way in. For open polls `canVote` is instead "authenticated and has
  not finished voting".

Everything else in the use case is untouched: voter names, protocol-signing willingness (admin
only), per-question dedupe of multi-choice voters.

## 6. Blocked admin surfaces for OPEN polls

- `UpdateParticipantWeightUseCase` → `OPEN_PARTICIPANTS_IMMUTABLE` (weight is 1 by definition).
- `RemoveParticipantUseCase` → `OPEN_PARTICIPANTS_IMMUTABLE` (a participant of an open poll has by
  definition already voted; removing them would destroy a cast vote, which the platform forbids).
- `UpdatePollWeightConfigUseCase` and `PreviewPollWeightConfigUseCase` → `OPEN_CONFIG_FIXED`.

`PropertyLockService` needs no change: an OPEN poll is `EQUAL` with empty property scope, which
already locks nothing.

## 7. Notifications

`ActivatePollUseCase` calls `NotifyPollActivatedUseCase`, which fans out to participants — an OPEN
poll has none at activation. For OPEN polls it instead notifies accepted org members including
descendants (`organizationRepository.findAcceptedMemberUserIdsIncludingDescendants`). No
platform-wide blast; outsiders learn about the poll through the shared link.

`NotifyPollActivatedUseCase` therefore takes the recipient set as input (resolved by the caller)
rather than resolving participants itself.

## 8. UI

- **`CreatePollForm`** — poll-type control (Organization / Open). Choosing Open hides the board
  selector and the entire weight-config fieldset (distribution type, aggregation, property scope)
  and shows a short explainer: any verified user with the link may vote, one person one vote.
  `createPollSchema` gains `pollType: z.enum(['ORGANIZATION','OPEN']).optional()`, and rejects a
  non-null `boardId` when `pollType === 'OPEN'`.
- **`EditPollForm`** — poll type displayed read-only.
- **Poll card and participants page** — "Open poll" badge, plus a **copy-link** button on both
  (poll card and participants page). The shared URL is the existing `/polls/{id}/vote`, which
  already renders title and description for the recipient.
- **Vote page** — for an OPEN poll show the owning organization's name and an open-poll banner, so
  an outsider understands what they are voting on.
- **Participants page** for an OPEN poll — list of voters who joined; no weight-edit or remove
  controls; no eligible-members / coverage block.
- **Results page** for an OPEN poll — percentages labelled as a share of votes cast (new i18n key)
  rather than of eligible participants; the "registered / building" stats stay hidden as they
  already are for `EQUAL` polls.

## 9. Testing (TDD, unit-first)

Domain:

- `PollType` parsing: valid values, invalid → `POLL_TYPE_INVALID`.
- `Poll.create` with `OPEN` + a `boardId` → `POLL_OPEN_CANNOT_BE_BOARD_SCOPED`.
- `applyWeightConfig` on an OPEN poll: non-`EQUAL` → `POLL_OPEN_MUST_BE_EQUAL`; `EQUAL/RAW_SUM/[]`
  → success.
- `PollVotingPolicy` matrix: ORGANIZATION × (participant / not), OPEN × (confirmed / not), each ×
  (DRAFT/READY/ACTIVE/FINISHED) × (has finished voting / not).

Application:

- `TakeSnapshotUseCase` on OPEN: state → READY, zero participants, zero eligible members, weight
  calculator never called.
- `SubmitDraftUseCase`: confirmed non-member may draft on OPEN; same user rejected on ORGANIZATION
  with `NOT_PARTICIPANT`.
- `FinishVotingUseCase` on OPEN: creates participant weight 1 + history `0→1` + votes weight 1 in
  one call to `joinAndVote`; second finish → `ALREADY_VOTED`.
- `GetPollResultsUseCase`: FINISHED OPEN poll readable by a non-member who voted; not readable by a
  non-member who did not.
- `UpdateParticipantWeightUseCase` / `RemoveParticipantUseCase` / `UpdatePollWeightConfigUseCase` on
  OPEN → respective rejection codes.
- `ActivatePollUseCase` on OPEN: notifies org members + descendants, not participants.

## 10. Risks

- **Abuse surface.** Anyone with a link can vote once. Existing controls (phone confirmation, rate
  limiting, user blocking) are the only defence; nothing poll-specific is added here.
- **Interpretation of results.** An open poll's percentages describe the people who chose to vote,
  not a defined electorate. UI copy must not present them as a share of any population.
