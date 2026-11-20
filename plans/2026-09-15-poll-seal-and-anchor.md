# Poll seal and blockchain anchor — implementation plan

**Created:** 2026-09-15  
**Revised:** 2026-11-20

**Status:** Phases 1–8 complete locally on `blockchain`. Phase 9 in progress. Final review requested after all phases.

**Source of truth:** [approved design](../readmes/2026-09-11-poll-seal-and-anchor-design.md), committed as `8653fa9`.
This revision replaces the earlier task list and its conflicting format refinements and golden vectors.
The design determines behavior; this plan determines implementation order and review gates.

## Delivery rules

- Implement one phase at a time. Run its checks, mark its checklist and heading complete, record the
  evidence here, then **stop for user review**. Do not start the next phase automatically.
- Use TDD: first demonstrate client usage of each new domain object in a failing test, then implement
  the smallest behavior that passes. Add a failing regression for every bug fixed.
- Keep `src/domain/seal/` pure and independent of `src/domain/poll/`. Translate complete poll snapshot
  DTOs in the application layer. Core-owned ports have infrastructure implementations; Prisma,
  Next.js, email, network and filesystem types stay out of the domain.
- Put invariants and state transitions in aggregates/value objects. Application services coordinate
  load → behavior → save → post-commit dispatch. Poll and seal use separate transactions.
- Use fakes for application tests and a dedicated test database for transaction guarantees. Mocks
  cannot establish locking, isolation, triggers, uniqueness or fencing.
- Add purpose comments to important new or materially changed files. Preserve relevant comments.
- Add every user-visible code/message in English and Russian; use existing error translation and
  rate-limit helpers. Follow the repository's React and UI conventions when implementing web work.
- Keep implementation local through the review phases. Phase 9 rehearses production rollout;
  partial implementations must not introduce mixed old/new vote writers in production.
- Stage or commit only when requested. Do not run repository-wide formatting for a scoped change.

## Fixed decisions and corrections

1. Commit five sections: `poll`, `tallies`, `register`, `signers`, `votes`. The signers list is always
   admin-only, including named polls; own-vote bundles and participant emails exclude it.
2. Capture external metadata in the **successful sealing transaction**, recording
   `metadataCapturedAt`. Reuse saved section bytes forever; failed attempts may capture newer data.
3. Final covered results and all three PDFs use the sealed record. The footer describes record
   verification; exact PDF-byte authentication and stored canonical PDFs are out of scope.
4. Ship a standalone CLI before the hosted verifier UI. The CLI checks local exported files;
   OpenTimestamps tooling separately verifies Bitcoin evidence.
5. HMAC uses the **decoded 32-byte receipt secret**, not the UTF-8 hex string. Internal Merkle nodes
   hash decoded child hashes. Regenerate the old plan's fixtures using these approved rules.
6. Explicit NFC preparation precedes JCS serialization. Verification rejects changed/noncanonical
   received bytes; it must not normalize altered input into success.
7. Only an original cast-time receipt supports original-ballot comparison. Code-only checks are
   current-record inclusion checks. Re-downloaded data is not independent cast-time evidence.
8. Coordinate votes, finish and all other poll-state writers on the poll row. Keep exact persisted
   vote timestamps, complete ballots, receipt secrets and willingness atomic.
9. Recover missing seals, seals without active anchors, due anchors and missing initial bundle
   deliveries. Use persistent claims with fencing, not in-process locks alone.
10. Production requires explicit OpenTimestamps configuration. Pending and simulated proofs never
    appear as confirmed Bitcoin evidence. Existing finished polls remain ineligible.

## Phase map

Phases run in this order. The dependencies indicate the contracts each phase extends, not permission
for parallel implementation.

| Phase | Reviewable result                                         | Depends on      | Status               |
| ----- | --------------------------------------------------------- | --------------- | -------------------- |
| 1     | Canonical record, receipts and cryptographic domain       | Approved design | Complete             |
| 2     | Atomic voting cutoff and reproducible cast-time receipts  | 1               | Complete             |
| 3     | Consistent immutable sealing and post-commit dispatch     | 1–2             | Complete             |
| 4     | Real anchoring and durable recovery                       | 3               | Complete; approved   |
| 5     | Authorized exports and standalone verifier CLI            | 1, 3–4          | Complete, approved   |
| 6     | Receipt emails and recoverable first bundle delivery      | 2, 4–5          | Complete, approved   |
| 7     | Hosted receipt and verification flows                     | 5–6             | Approved for Phase 8 |
| 8     | Frozen final results and all three PDFs                   | 3, 5, 7         | Complete             |
| 9     | Rollout rehearsal, operational checks and release handoff | 1–8             | In progress          |

## Phase 1 — Canonical record and cryptographic domain — COMPLETE

**Outcome:** a deterministic five-section record and receipt model, usable without the database,
framework or network. Format correctness is settled before persistence and UI depend on it.

**Files:** new `src/domain/seal/` primitives, record/input types, `SealedRecordBuilder`, `PollSeal`,
`SealAnchor`, domain codes and aggregate/provider ports; matching tests and golden fixtures;
`package.json`, `yarn.lock`, `messages/en.json`, `messages/ru.json`.

**Work and tests first:**

- [x] Write client-usage tests for `Weight`, leaf construction, Merkle paths, record building and
      anchor transitions. Add `@noble/hashes` through a small browser-compatible hashing module;
      check the installed version's supported imports rather than copying the old plan's version.
- [x] Define versioned record and receipt DTOs from design §4. Specify exact field names, nullability,
      collection order and decimal representations, including property holdings. Keep v1 fixtures
      self-contained; schema changes after publication require versioning.
- [x] Separate NFC preparation, canonical serialization and strict received-byte validation. Test
      nested key ordering, invalid Unicode, noncanonical JSON, unsupported values, dates and exact
      weight bounds; reject unsupported versions and algorithms.
- [x] Pin decoded-key HMAC, leaf and internal-node prefixes, sorted leaves, odd-node promotion,
      empty tree and paths for zero through five leaves. Validate fixed bytes/digests with an
      independent reference calculation, not expectations computed by the code under test.
- [x] Build all five sections. Test archived content, attachment metadata, deterministic arrays,
      unique-voter tally arithmetic, anonymous/named/open polls, missing secrets and invalid vote
      relationships. Use exact decimal arithmetic throughout the seal model.
- [x] Test signers with true/false/null decisions and non-voters: omit missing decisions/non-voters,
      retain phones only for willing voters, and commit an empty list when appropriate.
- [x] Model immutable seal contents and anchor transitions through the aggregate. Test initial
      failure without proof, required submission evidence, confirmation prerequisites, retry timing,
      supersession and at most one active anchor. Test proof validation separately from status labels.
- [x] Apply type review corrections: validated domain IDs/secrets/digests/timestamps, bounded row
      weights, distinct units, typed ports and anchor state variants. Keep raw DTOs at codecs and
      prove invalid client usage fails compilation without changing v1 fixture bytes.

**Acceptance:** exact golden record/receipt fixtures are checked in; changing any committed field
changes its commitment; pure modules load in Node and a browser bundle without Node-only imports.
Run focused domain tests and typecheck. Mark complete, record evidence, stop for review.

**Completed 2026-10-26 — accepted for Phase 2.**

- Added the pure seal context, immutable record/receipt models, aggregate-owned anchor transitions,
  repository/provider ports, and English/Russian domain codes. No application or database wiring yet.
- Defined the exact unpublished v1 format in [the domain reference](../src/domain/seal/README.md),
  strict schemas, and self-contained golden record/receipt fixtures. Holding sizes use six decimal
  places; ownership shares preserve the database's eight places. IDs exclude the HMAC separator.
- `@noble/hashes@2.4.0` is pinned; installed `sha2.js`, `hmac.js`, and `utils.js` exports were checked.
  Runtime minimum is Node 20.19.0. Zod's existing dependency validates strict DTO shapes.
- Independent Python `hashlib`/`hmac` calculations reproduce the golden vectors, including trees
  with zero through five leaves. Expected record tallies are specified independently.
- Observed red → green for arithmetic, canonical validation, leaves/paths, snapshot invariants,
  receipts, rehydration and anchor transitions. Regression tests caught reused historical anchor
  IDs and Node Buffer views sharing proof memory; both root causes are fixed.
- **Passing after type review:** 99 domain tests in 11 files, including 13 compile-time rejection
  examples; complete suite **3,430 tests / 328 files**; repository typecheck;
  scoped domain/test typecheck; scoped ESLint/Prettier; browser-targeted bundle execution without
  Node globals or builtins; fixture regeneration. Checks used four workers and a 20 GiB memory cap.
- Boundary details: seal identity is its root digest; DB surrogate IDs belong to adapters. Anchor
  provider results explicitly distinguish pending, simulated and verified Bitcoin evidence. The
  domain validates those assertions; real OTS parsing and Bitcoin verification remain Phase 4.
- No live OTS, database rollout, full Next.js build or interactive browser checks claimed. These
  require later phases. This phase preserves existing voting/results behavior.

**Type review correction complete, 2026-10-26 — accepted for Phase 2.**

- Raw snapshot/receipt/record DTOs remain primitive at serialization boundaries. Parsed core
  values use distinct validated types; vote and register weights remain exact `RowWeight` values.
  Arithmetic returns unbounded `Weight` totals, which cannot be reused as bounded row weights.
- `SealAnchor` is a readonly discriminated union. Confirmations require the real provider and
  complete evidence; failures require an error/retry time and pair earlier proof with submission
  time. Rehydration checks untrusted data; transitions retain cross-field timing/identity rules.
- Observed failing compiler contracts for swapped IDs, unvalidated secrets, incomplete/stub
  confirmations, mixed units and tally sums used as row weights, then passing contracts. Also
  observed red → green for parsed vote round trips and value-based weight equality.
- Regression tests cover structurally compatible objects carrying extra private fields. Outgoing
  vote/register serializers explicitly list allowed fields, including nested holdings, preventing
  accidental secret/phone export through object spreads.
- Golden record/receipt/crypto fixtures and browser compatibility are unchanged. No wire version
  change or product decision. Future adapters must construct domain values through validated
  factories; branding does not establish authorization or cryptographic proof authenticity.

## Phase 2 — Atomic voting and cast-time receipts — COMPLETE

**Outcome:** a ballot either commits completely before finishing or is rejected. Its returned receipt
can be reproduced without changing the secret, timestamps, original labels or leaf hashes.

**Files:** `src/domain/poll/{Poll,Vote,PollParticipant,PollRepository,ParticipantRepository}.ts`, new
`PollFinished` event, `src/application/poll/FinishVotingUseCase.ts`, `FinishPollUseCase.ts`, receipt
construction/secret-generation ports; Prisma poll/participant/vote adapters, other poll-state writers,
`prisma/schema.prisma`, migration, `prisma/backfill-receipt-secrets.ts`, database test harness/tests.

**Work and tests first:**

- [x] Add `finishedAt`, set-once receipt secrets and `PollFinished`. Reconstitution emits no new
      event. Test before implementation through the poll/participant APIs.
- [x] Establish an explicitly configured disposable PostgreSQL test database/schema and migration
      harness. Tests must not silently use an application's production connection or mutate its data.
- [x] Replace organization-poll split writes with transactional `castVotes`; extend open-poll
      `joinAndVote`. Lock the parent poll, re-read state and validate the complete accepted ballot
      inside the write boundary. Persist votes, exact `createdAt`, secret and willingness together.
- [x] Persist the cast-time receipt data needed for exact replay, including format version and
      labels; do not regenerate an original receipt from mutable live joins. Return it only after
      commit. Test repeat/concurrent requests, rollback, and replay after the poll has finished.
- [x] Make draft-cleanup failure unable to turn a committed ballot into a failed cast response.
      Prepare the same rule for receipt-email failure in Phase 6. No duplicate secret or vote on retry.
- [x] Give finish and every competing poll-state write the same lock/expected-state guard. Audit
      full-row `updatePoll`, activation, deactivation, return-to-draft and reconfiguration paths;
      no stale object may reopen or overwrite `FINISHED`.
- [x] Add the alternate-path vote-insert guard and vote update/delete immutability trigger. Test
      actual concurrent vote/finish interleavings, direct late inserts, stale saves, rollback and the
      transaction-scoped operator bypass. Do not use timing sleeps as the concurrency assertion.
- [x] Backfill only missing secrets for voters in `ACTIVE` and paused `READY` polls. Test reruns,
      preservation of existing secrets and exclusion of existing `FINISHED` polls. Migrated voters
      have no original pre-deployment receipt; exports must make that distinction explicit.

**Acceptance:** real database tests prove both vote/finish orderings, no partial ballots, stable
receipt replay and exact timestamp round trips. Run affected poll/application tests, database tests,
Prisma generation and typecheck. Mark complete, record evidence, stop for review.

**Completed 2026-10-26.**

- Organization and open ballots lock the poll, re-read eligibility, validate complete selections
  through `BallotPolicy`, and commit votes, exact millisecond timestamps, willingness, a set-once
  secret and a versioned cast snapshot together. Duplicate requests return the saved evidence.
- The snapshot stores original labels and exact six-place weights. `VoteReceiptView` translates
  it into seal v1 after commit, without live joins. Legacy ballots return `{ kind: 'legacy' }`.
  A repeatable-read lookup prevents a concurrent commit being mistaken for a legacy ballot.
- `Poll.finish(now)` records its timestamp and emits `PollFinished`; rehydration emits nothing.
  Lifecycle saves and snapshot/configuration writers share the poll lock, checking the loaded
  revision or reloading inside the transaction.
  A database revision trigger covers narrow writers too. Discarding a snapshot uses an explicit
  application transaction port: lock/load fresh inputs, invoke `Poll.discardSnapshot`, save and
  remove participants atomically. Generic `updatePoll` only persists the poll; participant weights
  lock against activation. Failed callback results and write errors roll back the transaction.
- SQL guards reject late inserts, changed/deleted votes, replaced credentials/receipt data and
  reopening finished polls. The deliberate `SET LOCAL` operator bypass expires at commit.
- Draft cleanup failures cannot invalidate committed votes or finish, or suppress finish
  notifications. The participant-list server action explicitly omits receipt secrets.
- Restartable backfill covers missing secrets for ACTIVE/READY voters only, preserving existing
  secrets and null original snapshots. It never fills legacy `finished_at` values.
- **Passing:** 3,445 unit tests in 333 files; 22 PostgreSQL tests (15 ballot/cutoff/replay/backfill,
  five snapshot-discard tests and two existing property constraints moved to the safe harness); repository and scoped
  new-test typechecks; Prisma generation/validation; scoped ESLint/Prettier; `git diff --check`.
  Checks use four workers and a 20 GiB memory cap. See [database test commands](../readmes/Testing.md#disposable-postgresql-tests).
- Observed red → green for finish events/time, secret immutability, whole-ballot acceptance,
  transaction rollback, concurrent open retries, stale saves, insert/mutation guards, backfill,
  exact timestamp adapters, cleanup failures and receipt privacy. Vote/finish interleavings use
  observed PostgreSQL lock barriers, not timing sleeps. The concurrent receipt-read regression
  uses an explicit query barrier around a real commit. Snapshot-discard review regressions cover
  generic saves without implicit removal, fresh state/votes after competing writers, and rollback.
- **Implementation choices:** receipt persistence is a strict versioned poll-context snapshot;
  the application translates it into the frozen seal v1 format. Poll and seal domain types remain
  separate. Added a persisted revision beyond the design's state guard to reject stale saves
  even after a state changes away and back. New policy/transaction/receipt contracts now use
  validated IDs, instants, weights/revisions and closed alternatives; legacy inputs are decoded
  at their boundaries. The [domain migration](archive/2026-10-26-domain-type-migration.md) completed
  older API integration on 2026-11-10. Wire DTOs, labels, independent booleans and local counts stay primitive.
- **Type review correction:** 3,457 unit tests passed before the broader migration foundations,
  including ten poll and fifteen seal compile-rejection contracts; 22 PostgreSQL tests passed.
  Production and scoped test typechecks passed. Added regressions for invalid finish identities/
  times without mutation, malformed policy facts, weighted organization ballots and mapper guards.
- **Limits:** no application database migration or production backfill run. This remains local
  Phase 2 work; rollout must pause all old vote/finish writers as the design specifies. Sealing and
  event dispatch are Phase 3; receipt email and receipt UI remain Phases 6–7. No Phase 3 work started.

## Phase 3 — Consistent immutable sealing — COMPLETE

**Outcome:** finishing commits independently; a successful seal saves one complete consistent
snapshot and is never rebuilt from current data.

**Files:** `src/application/seal/{SealingTransaction,PollRecordSnapshotReader,SealInputMapper,SealPollUseCase,SealWorkRepository}.ts`,
Prisma snapshot/seal/work adapters, schema/migrations, explicit `PollFinished` dispatch/handlers,
`FinishPollUseCase` integration and matching tests.

**Work and tests first:**

- [x] Add immutable seal storage, nullable-proof anchor storage, per-poll work claims, anchor-state
      checks and the partial unique active-anchor index. Add the seal mutation trigger. Manifest
      downloads must reproduce the exact bytes hashed, even if the stored manifest uses JSON.
- [x] Implement fenced claims with owner, expiry and monotonically increasing token. Validate a
      claim and persist its result in one transaction. Test expired ownership and stale saves using
      the database; network work will use these claims in Phase 4.
- [x] Implement `SealingTransaction` with repeatable-read and transaction-scoped read/repository
      ports. Do not expose Prisma transaction clients to the core or call network services inside it.
- [x] Read archived questions/answers, full attachment metadata, persisted votes, all participants,
      organization/board/user metadata and protocol holdings as of participant `snapshotAt`.
      The existing filtered `getPollById()` is not the sealing reader.
- [x] Map into the seal context and atomically save canonical sections, private salted preimages,
      ordered leaves, manifest and `metadataCapturedAt`. Never store receipt secrets in seal exports.
- [x] Test metadata changed after finish but before sealing, concurrent metadata changes during the
      snapshot, failed-transaction retry with newer metadata, and unchanged reads after a saved seal.
      Receipt leaf hashes must equal sealed hashes after the complete database round trip.
- [x] Make concurrent sealing idempotent: recover the saved seal after a uniqueness race without
      replacing it. Reject non-finished polls and legacy finished polls with null `finishedAt`.
- [x] Dispatch `PollFinished` only after commit to explicit handlers. Preserve finish success and
      finish notification delivery when sealing fails; do not make notification dispatch depend on
      successful anchoring. Reconciliation will recover interrupted sealing work in Phase 4.

**Acceptance:** snapshot, immutability, idempotency and fencing integration tests pass; signer fields
and holdings remain frozen after live mutations. Run affected tests and typecheck. Mark complete,
record evidence. User authorized continuing across phases on 2026-11-11; do not commit before review.

**Implementation evidence (2026-11-11, committed in `5835281`):**

- Immutable canonical text sections/manifest and ordered salted vote preimages/hashes persist
  atomically. PostgreSQL rejects seal updates/deletes and impossible anchor states, and enforces
  one active anchor. Failed first submissions may have no proof.
- Claims retain monotonic tokens after release. Real lock-wait tests caught and fixed checking
  expiry before acquiring the row lock; ownership is now checked after locking and before writes.
- The repeatable-read adapter rolls back failed callback Results and retries serialization/unique
  conflicts at most three times. An actual concurrent insert test reloads the authoritative seal.
- The private snapshot reader explicitly maps archived definitions, attachment metadata, all
  participants, board/organization/person labels, exact decimals and historical ownership windows.
  Holdings queries are grouped by participant snapshot time, matching the named protocol's
  descendant-organization, selected-property and unarchived-asset/property scope.
- The real atomic ballot adapter's original receipt matches sealed leaves after database storage.
  Concurrent metadata changes stay outside the current snapshot; rollback/retry captures newer
  metadata. Saved signer fields and holdings remain frozen after live changes.
- Explicit `PollFinished` handlers run only after a successful save. Finish success and notifications
  survive both typed sealing failures and unexpected handler rejection. Production composition now
  wires the sealing handler, with a 120-second lease; reconciliation remains Phase 4.
- Verification: 4,273 unit tests (457 files), all 40 database checks (8 files), and full source/test
  `yarn tsc --noEmit` passed. Scoped ESLint, Prettier and `git diff --check` passed. Prisma client
  generation and schema formatting completed. No application migration or commit was run.

**Implementation choices:** snapshot mapping stays in the infrastructure boundary next to its
Prisma reader instead of adding a second application DTO/mapper. `pollId` is the seal table's primary
key; the domain identity remains the root digest. Manifest/section columns store exact text. One
ordered JSON array stores each salted preimage beside its hash, avoiding separate arrays drifting
out of alignment. Anchor rows reference `pollId`; status alternatives use database CHECK constraints
rather than an extra PostgreSQL enum. No receipt secret enters seal storage.

**Resolved (2026-11-11):** omit zero-share source holdings, retaining participants, saved weights
and votes. The domain snapshot parser validates source rows before omitting zero; committed v1
holdings remain strictly positive. Three domain regressions preserve the original record bytes,
and a PostgreSQL acceptance test preserves the actual cast receipt while retaining the source row.
Targeted checks: 61 domain tests, 8 sealing database tests and full source/test typecheck passed.

**Limits:** migrations exercised only in disposable local schemas, never the application database.
No timestamp provider calls, recovery worker, exports, receipt delivery or new UI implemented here.
Do not deploy this slice as complete recovery support; Phase 4 must recover interrupted/failed work.

## Phase 4 — Anchoring and durable recovery — COMPLETE

**Outcome:** OpenTimestamps failures and process interruptions leave discoverable work; concurrent
workers cannot replace authoritative state with stale results.

**Files:** `AnchorSealUseCase`, `UpgradeAnchorsUseCase`, `SealWorkRepository` extensions,
`src/infrastructure/anchor/` providers/configuration, work/seal adapters, composition wiring,
`src/app/api/internal/anchors/upgrade/route.ts`, `.env.example`, package metadata and tests.

**Work and tests first:**

- [x] Wrap OpenTimestamps behind the domain port; verify installed library behavior with fixtures.
      Submit the raw manifest digest, validate proof/digest agreement, bound calls with timeouts,
      preserve upgraded proof bytes when explorer verification fails, and isolate library logging.
- [x] Fail production startup for missing, unknown or stub provider configuration. Require the
      internal worker secret. Dev/test simulations are explicitly identifiable throughout read models
      and can never produce a real Bitcoin-verification result.
- [x] Keep network calls outside database transactions. Save aggregate changes with the current
      fencing token; test a slow expired worker returning after another worker has acquired the claim.
- [x] Implement failure backoff (5 min, 15 min, 1 h, 6 h, then daily), pending upgrades and atomic
      supersession/replacement after three days. Preserve at most one active anchor, including after
      failed first submission and failed replacement submission.
- [x] Reconcile eligible finished polls without seals, seals without active anchors and due anchors
      in bounded batches. Add the hook for missing/pending bundle deliveries implemented in Phase 6.
      Test restart after each durable boundary; one failing item must not starve the rest.
- [x] Reuse claims for immediate handlers, cron and poll-specific lazy nudges. Enforce the lazy
      nudge interval through durable state so multiple server instances cannot bypass it.
- [x] Add the POST-only internal worker route with constant-time bearer authentication, fail-closed
      behavior and counts. Test unauthorized requests, empty/malformed secrets and concurrent calls.
- [x] Add an opt-in `OTS_LIVE_TEST=1` smoke test. It is not a dependency of normal tests; pending
      calendar acceptance is not evidence of Bitcoin confirmation.

**Acceptance:** failure/restart/fencing/state-constraint tests pass with no external services in the
regular suite. Test real adapter behavior with retained proof fixtures and run the live smoke test
when the integration environment is available. Mark complete, record evidence, stop for review.

**Partial implementation (2026-11-11, committed in `5835281`):**

- Added aggregate-owned due-work selection and deferred upgrade failure. The original pending
  proof and submission age survive upgrade failures; failed submissions retain backoff and identity.
- Added `AnchorSealUseCase` for submission, retry, pending proof refresh, verified confirmation and
  atomic three-day replacement, including failed replacements. Provider calls run between two
  fenced transactions. Provider mismatch fails explicitly; busy claims skip provider calls.
- Unit tests cover these outcomes. A real PostgreSQL slow-provider/takeover test proves an expired
  worker cannot overwrite the newer worker's saved proof.
- Final wrap-up checks: 4,285 unit tests (458 files), 42 PostgreSQL tests (8 files), full source/test
  TypeScript, scoped ESLint/Prettier and whitespace checks passed.
- This slice uses provider test doubles only and is not wired to production anchoring. Remaining:
  real OpenTimestamps adapter and retained proof fixtures, production configuration validation,
  reconciliation/discovery, durable lazy nudges, authenticated worker route, and optional live smoke
  test. Phase 4 remains incomplete. No timestamp requests or commits were made.

**Completed 2026-11-20 — approved for Phase 5.**

- The OTS adapter checks the SHA-256 file operation and manifest digest, requires a calendar
  attestation on submission, and verifies the Bitcoin Merkle root through the configured Esplora
  service before recording height and time. A Node worker isolates the library's output and
  stops network calls on timeout. The deployment archive includes the worker entry point.
- The adapter calls the library's `verifyTimestamp` on the exact upgraded bytes. The higher-level
  `verify` would request further calendar upgrades while verifying. Failed explorer verification
  retains the upgraded bytes, original submission time and a retryable error.
- Immediate finish, cron and poll-specific nudges share fenced operations. Discovery visits up to
  20 eligible polls per tick. Released failures rotate behind untouched work. Lazy admission persists
  for ten minutes across worker restarts. Phase 6 will supply the initial delivery handler.
- Production startup rejects a simulated provider and missing bearer. The built server returned
  401 for an unauthenticated POST, 405 for GET and 200 with counts for an authenticated empty POST.
  It recovered an eligible disposable poll and stored 805 bytes of real pending proof for root
  `e97870d3759f28fe65d41c54bf660a5fe54f3eb47bf7d9fe92532e418af025eb`. The stored proof
  contains pending attestations from Alice, Bob, Finney and Catallaxy.
- Two opt-in smoke runs each submitted a fresh random digest to public calendars and verified
  the upstream `hello-world.txt.ots` fixture at Bitcoin height 358391 via Blockstream Esplora.
  The second smoke also requested an immediate upgrade for
  `e07b441714184140704df21f69e1f14acede2e2f28e0d938621fa8e660d64cc5`; it remained pending.
  The historical fixture is the only Bitcoin confirmation observed in these checks.
- Offline tests use retained pending/confirmed fixtures, loopback calendars and a loopback explorer.
  They cover unsuccessful submissions, timeouts, incorrect digests and Merkle roots, unavailable
  explorers, malformed/simulated proofs and retention of upgraded bytes. PostgreSQL tests cover
  concurrent takeover, missing seals and anchors, due upgrades, and lazy admission after restart.
- Final checks passed with 4,314 offline unit tests, 45 disposable PostgreSQL tests, full source/test
  typechecking, scoped ESLint/Prettier, Prisma generation, migrations and a production build.
  The two live tests are gated out of the regular suite. No production rollout occurred. The
  weighted receipt, authorized export and standalone CLI acceptance path spans subsequent phases.

## Phase 5 — Authorized exports and standalone CLI — COMPLETE

**Outcome:** exported local files can be checked independently of the running application, and every
server export obeys the disclosure matrix.

**Files:** seal read use cases/errors, shared pure verification core, the four
`src/app/api/polls/[pollId]/seal/{manifest,proof,sections,my-proof}/route.ts` routes, standalone CLI
adapter/build entry, fixture bundles, package scripts and verifier documentation under `readmes/`.

**Work and tests first:**

- [x] Define public status/manifest/proof read models and policy-gated sections. Serve canonical
      manifest/section bytes; never reformat downloaded commitments. Proof is confirmed when
      available, otherwise pending; unavailable proof returns the specified error/404.
- [x] Test the full anonymous/named/open × admin/member/voter/outsider matrix. Finished anonymous
      members receive `poll` and `tallies`; named members may receive `register`; only admins receive
      `signers`. No export exposes another person's receipt secret.
- [x] Base own-proof eligibility on sealed participation and return only the authenticated voter's
      leaves and paths. Gate canonical poll labels separately under current results policy, including
      after membership is lost. Own participation must not unlock unrelated sections.
- [x] Implement structured verification outcomes: canonical section/manifest consistency, complete
      original-receipt agreement, current-record inclusion, authenticated labels and proof/digest
      binding. Treat timestamp confirmation as a separate check.
- [x] Test changed ballots with the same secret and valid replacement paths, missing/extra/duplicate
      own leaves, forged labels, tampered canonical bytes/manifests, invalid paths, mismatched proof
      digest, unsupported format, empty or malformed bundles and pending/synthetic proof handling.
      Strictly validate imported structures before hashing or interpreting them.
- [x] Add a standalone CLI over the shared core. Filesystem and argument handling remain in its
      adapter. It reads local receipts/bundles/sections/proofs, reports specific failed checks and uses
      nonzero exit codes for failures. It never needs a site login, application database or server.
- [x] Package a runnable standalone artifact with its dependencies and instructions; prove it runs
      from a clean directory with application environment variables absent. Use exported fixtures
      and the same adversarial cases as the core, not a second verification implementation.
- [x] Document and execute the exact `ots` commands against fixtures, explicitly distinguishing a
      raw digest from a text file containing hex. Record consistency works offline; obtaining or
      independently checking Bitcoin evidence has its own stated prerequisites.

**Acceptance:** policy route tests pass; the CLI verifies the valid fixture and fails tampered cases
without contacting the app. Document how to upgrade/verify pending timestamps and the limits of
receipt-code-only checks. Mark complete, record evidence, stop for review.

**Completed locally 2026-11-20. Approved for Phase 6.**

- Four GET routes serve exact committed bytes or policy-filtered evidence. The public reader selects
  the manifest and active anchor without fetching private sections. Tests cover the six viewer roles
  across open/organization and anonymous/named polls, unauthenticated requests, missing proofs and
  own inclusion after membership loss.
- The weighted acceptance test saved the receipt for a ballot with weight `2.123456`, finished and
  sealed the poll and submitted its digest to real calendars. The four downloads verified in a clean
  CLI process with an empty environment. A changed manifest failed. The new timestamp was pending.
  The ordinary suite repeats this flow with simulated evidence.
- The shared adversarial corpus includes a replacement ballot with the same secret and valid new
  paths, omitted or duplicate leaves, altered labels, bytes, timestamps and inconsistent weighted
  tallies. The verifier reproduces tallies when the register and complete vote list are disclosed.
  The browser-targeted bundle also verified the fixture without Node built-ins.
- A built Next server on loopback served the fixture's public manifest and proof. Sessionless private
  requests returned 403. A real disposable session downloaded the member sections and own bundle,
  and their exact HTTP response bytes passed the standalone verifier.
- The [verifier guide](../readmes/Poll-Seal-Verifier.md) records the Python OTS commands and trust
  assumptions. The fresh fixture and earlier disposable poll were pending. Both file and raw-digest
  forms verified a separate historical proof at Bitcoin block 358391 using a public Bitcoin RPC.
  Passing a text file of hex digits as the original file failed for all three proofs. The offline CLI reports a
  Bitcoin attestation as unverified until a separate chain check is performed.
- Verification passed with 4,366 unit tests, 51 disposable PostgreSQL tests, full source/test
  typechecking, scoped lint and formatting, migrations and a production build. The opt-in
  calendar submission was exercised separately. No production deployment occurred.

## Phase 6 — Receipt and bundle delivery — COMPLETE

**Outcome:** voters receive their cast-time receipt; the first usable proof can trigger a first bundle
email even after delayed sealing or submission. Ambiguous sends are not silently retried.

**Files:** receipt/bundle email services, `EmailSender`/template ports and email adapters,
`NotifyPollFinishedUseCase`, bundle-delivery schema/work adapter/reconciliation, composition wiring,
locale messages and matching tests.

**Work and tests first:**

- [x] Extend email attachments and localized plain-text/HTML templates. Attach the exact versioned
      cast-time `receipt.json`; email failure leaves the committed on-screen receipt available.
- [x] Add unique `(sealId, userId)` delivery records with `PENDING`, `SENDING`, `SENT`, `FAILED` and
      `UNKNOWN`. Discover missing initial deliveries once a usable proof exists. Confirm current
      recipient eligibility/email and authorized label data when preparing a send.
- [x] Atomically claim pending delivery before external email I/O. Record success/failure; expired
      interrupted sends become `UNKNOWN`. Never automatically resend `SENT`, `FAILED` or `UNKNOWN`.
      Test concurrent workers and crashes before send, during send and before persisting success.
- [x] Send only manifest, own leaves/paths, authorized canonical label data and proof. Even an
      administrator's participant bundle excludes the signer list, others' preimages and receipt
      secrets. Reuse the export assembler instead of a separate permissive email mapper.
- [x] Complete the fourth recovery scan and test first delivery after sealing/submission recovery,
      changed email status and uniqueness across repeated scans.
- [x] Add the optional root digest to finish notifications without suppressing the notification when
      sealing fails. Use the existing `notification.types.<type>.<field>` localization resolver.

**Acceptance:** attachment/privacy tests and real database delivery-state tests pass; delayed first
send works while failed/ambiguous sends remain terminal. Mark complete, record evidence, stop for review.

**Completed locally 2026-11-20. Approved.**

- A successful fresh cast prepares the original receipt from the winning committed snapshot. A
  concurrent replay returns the same receipt. The confirmed voter receives the original JSON bytes
  with localized text and escaped HTML. Mail failure preserves the successful vote and its receipt.
- The authenticated recovery batch and the immediate finish path share the delivery service. It
  discovers voters from sealed leaves, prepares their existing owner-only export, then claims the
  handoff in PostgreSQL while rechecking the confirmed address and language. A missing SMTP
  configuration leaves the first bundle pending. Batches rotate pending preparation so one unreadable
  record cannot indefinitely occupy a delivery slot. The development preview never logs private ballots.
- The migration uses the seal's actual primary key, `poll_id`, with `user_id` as the second key.
  A lost handoff expires after **10 minutes** and becomes `UNKNOWN`. Accepted, explicitly rejected
  and ambiguous handoffs are terminal. The first-bundle count measures SMTP acceptance.
- Finish notifications use the persisted digest when available and the existing results link.
  Notification persistence precedes bundle mail so mail latency cannot delay that write.
- The new tests use a disposable database, simulated timestamps and in-process email capture.
  English and Russian receipts, the paired JSON/OTS attachments, concurrent workers, recovery after
  delayed sealing and interrupted SMTP handoffs are covered. Two authenticated loopback requests
  to the built cron endpoint discovered one pending delivery with SMTP disabled. No SMTP handoff
  or fresh public-calendar submission occurred in this phase. Hosted receipt and verification
  pages are scheduled for Phase 7.
- The production build, full typecheck, Prisma validation/generation, disposable migrations, scoped
  lint/format, 4,374 offline unit tests and 61 disposable PostgreSQL tests passed.

## Phase 7 — Hosted receipts and verification — COMPLETE

**Outcome:** the voter can save an original receipt and later distinguish original-ballot verification
from weaker inclusion checks; public visitors see commitments without private record contents.

**Files:** finish-voting action and `VotingInterface`, new `src/web/components/seal/` components,
public `/verify/[pollId]` and voter `/polls/[pollId]/verify-my-vote` pages, results links/status,
`PollCard`, site-origin helper, locale messages and relevant component/route/browser tests.

**Work and tests first:**

- [x] Return a plain owner-only receipt DTO from the action; show copy/download, original answer
      labels/hashes, delivery outcome and confirm-email prompt. Cover reload/replay and successful
      voting despite cleanup/email failure.
- [x] Build public status, digest, five section commitments, proof/manifest downloads, block data
      and the tested independent-verification recipe. Public HTML and client props contain no poll
      title, organization name, participants, signer contents or receipt secret.
- [x] Reuse the shared verification core for authorized section checks and voter receipt imports.
      Imported receipts and secrets stay local. Clearly label original-receipt success, current-record
      inclusion only, unavailable evidence, unverified labels and pending Bitcoin confirmation.
- [x] Resolve sealed labels only after validating authorized/imported canonical poll data. Test that
      loss of results access does not reveal that section through the voter page or client props.
- [x] Add status badges, copyable digests and links on cards/results. Batch lightweight status reads
      for lists; avoid loading full sealed records once per card. Lazy nudges use Phase 4's worker.
- [x] Verify English/Russian copy, mobile layout, keyboard operation and accessible feedback.
      Add browser coverage for a complete vote → receipt → seal → import flow and privacy failures,
      using an isolated test browser profile and clearly simulated anchoring where appropriate.

**Acceptance:** browser verification agrees with the CLI on shared fixtures; no unsupported claim is
shown for code-only, pending or simulated checks. Run affected web tests, typecheck and lint.
Mark complete, record evidence, stop for review.

**Implementation evidence, 2026-11-20**

- Voters can download the original receipt after casting and retrieve their saved copy after a
  reload. The browser and standalone CLI share ballot verification rules. Both distinguish a
  matching original receipt from inclusion checked with the current record or a code.
- Public rendering reads the five commitments and anchor metadata. The voter page initially
  renders only a poll ID. A private, uncached HTTP endpoint checks the signed-in voter and
  current disclosure permissions before returning evidence. This prevents React development
  diagnostics from including private query results in the streamed page. Public views request
  a throttled recovery check after hydration. Scheduled recovery also serves visits without JavaScript.
- The weighted `poll1` fixture's published timestamp upgraded to Bitcoin block **976744**
  (2026-11-20 15:25:27 UTC). The earlier disposable poll's proof upgraded to **976737**
  (14:25:06 UTC). The application checked both through Blockstream Esplora. The independent
  Python OpenTimestamps client checked both manifests and their binary digests through a remote
  Bitcoin RPC node, and rejected a file containing the digest as hex text. The standalone CLI
  reports the upgraded proof as requiring independent Bitcoin verification. No new calendar
  submission was needed.
- Production Chromium verified the weighted original, block badge, lazy recovery and revoked
  label access. The browser rehearsal caught a delivery discovery failure in PostgreSQL. Prisma bound a
  nested SQL fragment as a timestamp. Both discovery and handoff completion now bind scalar minutes. SMTP stayed disabled.
- Two anonymous voters cast separate weighted ballots in Chromium. The owner saved and reloaded
  the receipt, verified it offline, rejected a changed receipt and checked inclusion using the code.
  The CLI agreed from a clean directory. Guest, voter and revoked-access HTML and JSON withheld
  unauthorized data. English/Russian, mobile and keyboard checks passed.
- 4,414 offline tests passed (two opt-in live tests skipped). All 61 disposable PostgreSQL tests,
  the production build, full typecheck, scoped ESLint and formatting passed.

## Phase 8 — Frozen results and protocols — COMPLETE

**Outcome:** final covered results and all three PDFs describe the same immutable record.

**Files:** `GetSealedProtocolUseCase`, results page/read-model integration, three PDF routes,
`pollResultsPdfGenerator`, `namedProtocolPdfGenerator`, `protocolSignersPdfGenerator`, shared
`sealFooter`, locale messages and regression tests.

**Work and tests first:**

- [x] Map stored `poll`/`tallies`/`register` sections into final results and named protocol inputs.
      Use frozen organization/board/user/holding values; current policy still controls access.
- [x] Build the admin-only signers protocol from stored `poll` plus `signers`. Include willing
      voters' consented phones and declining voters' names only; preserve missing-decision semantics.
- [x] Define explicit fallback states: active exports remain preliminary; eligible finished polls
      awaiting a seal show sealing pending/unsealed; legacy finished polls remain unsealed. Never
      pair live covered contents with a footer claiming a saved seal covers them.
- [x] Share the footer's digest, anchor status, URL and QR across generators. Explain record
      verification without claiming the PDF bytes are authenticated.
- [x] Change live names, titles, organizations, boards, holdings, willingness and phones after seal;
      assert final displayed/PDF data remains frozen and access remains policy-correct. Also verify
      the no-seal fallback and authorized signer route independently of client-side hiding.
      Check raw HTML, Flight and JSON responses for withheld identities, phones and sections in
      both development and production builds. React development diagnostics can include intermediate
      query results even when component props contain only an authorized view.

**Acceptance:** all three PDF inputs agree with the saved canonical sections; privacy and frozen-data
regressions pass. Inspect representative English/Russian PDFs. Mark complete, record evidence, stop
for review.

**Implementation evidence, 2026-11-20**

- The regression downloaded an actual PDF after changing the live title, board and answers.
  It initially printed all the changed values. The results view and three PDF routes now use
  the validated v1 record when present. An unavailable or invalid record fails the request.
  Live results recheck access and seal availability after reading mutable data.
- Exact six-place totals determine the winner even when JavaScript numbers round two totals
  to the same value. Multi-choice turnout counts each voter once. The sealed page omits the
  whole-building denominator and any incomplete property-label list, which v1 did not store.
- The HTML and Flight response contains the results shell. The browser loads its private view
  after hydration. The ordinary member of an anonymous poll receives totals. A named member can
  read the frozen register and holdings. Only the current administrator can read saved signer
  contacts. A missing decision is omitted and a declining voter is listed without a phone.
- A disposable PostgreSQL rehearsal changed names, phone, signing decisions, poll text, board,
  organization and holdings after sealing. It checked both locales and all three PDF downloads,
  live preliminary/sealing/legacy fallbacks, named and anonymous results, and revocation of
  membership and administrator access. The six printed QR codes resolved to the matching
  locale and poll. A four-page sample also kept its digest and readable QR on interior pages.
- The footer identifies the underlying record. Comparing the PDF contents with that record is
  necessary because an edited PDF can keep the original footer. This phase used local test
  data and disabled SMTP. Real Bitcoin evidence for the weighted fixture is recorded in Phase 7.

- Validation passed 4,466 unit tests, 61 database checks, types, production build, three development browser flows and two production browser flows.

## Phase 9 — Rollout rehearsal and release handoff — IN PROGRESS

**Outcome:** a tested release procedure covers migrations, backfill, all writers, recovery and
independent verification. Production deployment is a separate explicit action.

**Files:** `.env.example`, `.github/workflows/deploy.yml`, startup/configuration wiring,
`readmes/DEPLOYMENT-SUMMARY.md`, verifier/runbook documentation, relevant CI/test scripts and this plan.

**Work and checks:**

- [ ] Wire production provider/poller configuration and the canonical site origin in both runtime
      and build environments as needed. Validate startup before accepting traffic; never fall back
      to a synthetic provider in production.
- [ ] Rehearse the rollout on representative data: disable vote/finish writes across all instances,
      migrate, backfill, verify coverage, deploy all updated writers, then re-enable writes. Include
      paused `READY` polls and preserve legacy `FINISHED` eligibility rules.
- [ ] Document failure/rollback handling that keeps writes disabled until all writers are compatible;
      do not erase seals or replace existing receipt secrets to recover a deployment.
- [ ] Prepare and rehearse installation of the 15-minute worker schedule and nginx route restriction.
      Document restricted DB mutation privileges, deliberate transaction-scoped bypass and required
      PostgreSQL audit logging.
- [ ] Add operational evidence for pending seals, failed/due anchors, stale claims and delivery
      failures/unknown outcomes. Logs contain identifiers/status/codes, never receipt secrets or
      private ballot/signer payloads.
- [ ] Run the full bounded suite once, real-database migration/concurrency tests, production build,
      CLI-from-clean-directory checks and a representative end-to-end flow. Rehearse restart at each
      workflow boundary. Repeat checks only when failures or subsequent changes justify it.
- [ ] Complete an opt-in live OTS submission/upgrade/verification check; do not label a pending
      attestation confirmed if Bitcoin confirmation is still outstanding. Record any external wait
      as incomplete evidence rather than marking that verification passed.
- [ ] Record validation evidence and any remaining limitations; update the design's implementation
      status only after its scope is actually complete. Mark this phase complete and stop for review.

## Verification commands and progress evidence

Use focused checks while iterating. All significant Node/build/full-suite work runs with a real-memory
cap; do not apply `ulimit -v` to Node. Do not run heavy checks concurrently.

```sh
# Substitute the affected test file/directory for the current phase.
systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- env VITEST_MAX_WORKERS=4 yarn vitest run src/domain/seal

systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- yarn typecheck

# Final or otherwise justified broad validation, run sequentially.
systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- env VITEST_MAX_WORKERS=4 yarn test
systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- yarn build
```

Use ESLint and Prettier on changed supported files. After schema changes, run `yarn prisma:generate`.
Phase 2 must document the dedicated database test command/environment; Phase 5 must document the
actual standalone CLI build/run commands. Skipped database/live checks are not passing evidence.

At each phase boundary, update this record:

| Phase | Completed       | Failing test observed                                                                                | Passing checks/evidence                                                                                                  | Review status          |
| ----- | --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1     | Yes, 2026-10-26 | Yes; client usage, type contracts and regression tests                                               | 99 domain / 3,430 total tests; 13 compile rejections; types, lint, format, browser bundle, independent fixtures          | Accepted for Phase 2   |
| 2     | Yes, 2026-10-26 | Yes; domain, SQL, concurrency and privacy regressions                                                | 3,445 unit + 22 PostgreSQL tests; types, Prisma, lint, format                                                            | Continued to Phase 3   |
| 3     | Yes, 2026-11-11 | Yes, snapshot, idempotency, fencing and zero-share cases                                             | 4,273 unit and 40 PostgreSQL checks at the phase boundary, followed by zero-share regressions                            | Continued to Phase 4   |
| 4     | Yes, 2026-11-20 | Yes, provider, startup, recovery, lazy lease and route regressions                                   | 4,314 unit and 45 PostgreSQL checks, live calendars, historical Bitcoin proof, built server, types, lint and format      | Approved for Phase 5   |
| 5     | Yes, 2026-11-20 | Yes, own proof, imported evidence, tally consistency and public manifest isolation                   | 4,366 unit and 51 PostgreSQL tests, real submission, historical OTS verification, built HTTP downloads and isolated CLI  | Approved for Phase 6   |
| 6     | Yes, 2026-11-20 | Yes, receipt attachments, delivery claims, expired handoffs, fair discovery and sealed notifications | 4,374 unit and 61 PostgreSQL tests, isolated mail capture, types, production build and loopback cron                     | Approved               |
| 7     | Yes, 2026-11-20 | Yes, cast receipt, initial bundle queue, label revocation and private data in streamed pages         | 4,414 unit and 61 PostgreSQL checks, two-voter Chromium/CLI rehearsal, real Bitcoin blocks 976737 and 976744, full build | Approved for Phase 8   |
| 8     | Yes, 2026-11-20 | Yes, downloaded PDF included changed live data                                                       | 4,466 unit and 61 database tests, three development and two production browser flows, six QR codes                       | Final review requested |
| 9     | No              | —                                                                                                    | —                                                                                                                        | Not started            |

## Unresolved questions

No unresolved product decisions. The four review decisions are settled in design
§18. If implementation exposes a format or guarantee change, record it and resolve it before coding
past that boundary; do not silently resurrect the superseded plan's choices.
