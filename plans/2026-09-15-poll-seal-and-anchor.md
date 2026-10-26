# Poll seal and blockchain anchor — implementation plan

**Created:** 2026-09-15  
**Revised:** 2026-10-26

**Status:** Phase 1 complete, including type review corrections; awaiting review. Phases 2–9 not started.

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

| Phase | Reviewable result                                         | Depends on      | Status                    |
| ----- | --------------------------------------------------------- | --------------- | ------------------------- |
| 1     | Canonical record, receipts and cryptographic domain       | Approved design | Complete; awaiting review |
| 2     | Atomic voting cutoff and reproducible cast-time receipts  | 1               | Not started               |
| 3     | Consistent immutable sealing and post-commit dispatch     | 1–2             | Not started               |
| 4     | Real anchoring and durable recovery                       | 3               | Not started               |
| 5     | Authorized exports and standalone verifier CLI            | 1, 3–4          | Not started               |
| 6     | Receipt emails and recoverable first bundle delivery      | 2, 4–5          | Not started               |
| 7     | Hosted receipt and verification flows                     | 5–6             | Not started               |
| 8     | Frozen final results and all three PDFs                   | 3, 5, 7         | Not started               |
| 9     | Rollout rehearsal, operational checks and release handoff | 1–8             | Not started               |

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

**Completed 2026-10-26 — awaiting user review.**

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

**Type review correction complete, 2026-10-26 — awaiting review.**

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

## Phase 2 — Atomic voting and cast-time receipts — NOT STARTED

**Outcome:** a ballot either commits completely before finishing or is rejected. Its returned receipt
can be reproduced without changing the secret, timestamps, original labels or leaf hashes.

**Files:** `src/domain/poll/{Poll,Vote,PollParticipant,PollRepository,ParticipantRepository}.ts`, new
`PollFinished` event, `src/application/poll/FinishVotingUseCase.ts`, `FinishPollUseCase.ts`, receipt
construction/secret-generation ports; Prisma poll/participant/vote adapters, other poll-state writers,
`prisma/schema.prisma`, migration, `prisma/backfill-receipt-secrets.ts`, database test harness/tests.

**Work and tests first:**

- [ ] Add `finishedAt`, set-once receipt secrets and `PollFinished`. Reconstitution emits no new
      event. Test before implementation through the poll/participant APIs.
- [ ] Establish an explicitly configured disposable PostgreSQL test database/schema and migration
      harness. Tests must not silently use an application's production connection or mutate its data.
- [ ] Replace organization-poll split writes with transactional `castVotes`; extend open-poll
      `joinAndVote`. Lock the parent poll, re-read state and validate the complete accepted ballot
      inside the write boundary. Persist votes, exact `createdAt`, secret and willingness together.
- [ ] Persist the cast-time receipt data needed for exact replay, including format version and
      labels; do not regenerate an original receipt from mutable live joins. Return it only after
      commit. Test repeat/concurrent requests, rollback, and replay after the poll has finished.
- [ ] Make draft-cleanup failure unable to turn a committed ballot into a failed cast response.
      Prepare the same rule for receipt-email failure in Phase 6. No duplicate secret or vote on retry.
- [ ] Give finish and every competing poll-state write the same lock/expected-state guard. Audit
      full-row `updatePoll`, activation, deactivation, return-to-draft and reconfiguration paths;
      no stale object may reopen or overwrite `FINISHED`.
- [ ] Add the alternate-path vote-insert guard and vote update/delete immutability trigger. Test
      actual concurrent vote/finish interleavings, direct late inserts, stale saves, rollback and the
      transaction-scoped operator bypass. Do not use timing sleeps as the concurrency assertion.
- [ ] Backfill only missing secrets for voters in `ACTIVE` and paused `READY` polls. Test reruns,
      preservation of existing secrets and exclusion of existing `FINISHED` polls. Migrated voters
      have no original pre-deployment receipt; exports must make that distinction explicit.

**Acceptance:** real database tests prove both vote/finish orderings, no partial ballots, stable
receipt replay and exact timestamp round trips. Run affected poll/application tests, database tests,
Prisma generation and typecheck. Mark complete, record evidence, stop for review.

## Phase 3 — Consistent immutable sealing — NOT STARTED

**Outcome:** finishing commits independently; a successful seal saves one complete consistent
snapshot and is never rebuilt from current data.

**Files:** `src/application/seal/{SealingTransaction,PollRecordSnapshotReader,SealInputMapper,SealPollUseCase,SealWorkRepository}.ts`,
Prisma snapshot/seal/work adapters, schema/migrations, explicit `PollFinished` dispatch/handlers,
`FinishPollUseCase` integration and matching tests.

**Work and tests first:**

- [ ] Add immutable seal storage, nullable-proof anchor storage, per-poll work claims, anchor-state
      checks and the partial unique active-anchor index. Add the seal mutation trigger. Manifest
      downloads must reproduce the exact bytes hashed, even if the stored manifest uses JSON.
- [ ] Implement fenced claims with owner, expiry and monotonically increasing token. Validate a
      claim and persist its result in one transaction. Test expired ownership and stale saves using
      the database; network work will use these claims in Phase 4.
- [ ] Implement `SealingTransaction` with repeatable-read and transaction-scoped read/repository
      ports. Do not expose Prisma transaction clients to the core or call network services inside it.
- [ ] Read archived questions/answers, full attachment metadata, persisted votes, all participants,
      organization/board/user metadata and protocol holdings as of participant `snapshotAt`.
      The existing filtered `getPollById()` is not the sealing reader.
- [ ] Map into the seal context and atomically save canonical sections, private salted preimages,
      ordered leaves, manifest and `metadataCapturedAt`. Never store receipt secrets in seal exports.
- [ ] Test metadata changed after finish but before sealing, concurrent metadata changes during the
      snapshot, failed-transaction retry with newer metadata, and unchanged reads after a saved seal.
      Receipt leaf hashes must equal sealed hashes after the complete database round trip.
- [ ] Make concurrent sealing idempotent: recover the saved seal after a uniqueness race without
      replacing it. Reject non-finished polls and legacy finished polls with null `finishedAt`.
- [ ] Dispatch `PollFinished` only after commit to explicit handlers. Preserve finish success and
      finish notification delivery when sealing fails; do not make notification dispatch depend on
      successful anchoring. Reconciliation will recover interrupted sealing work in Phase 4.

**Acceptance:** snapshot, immutability, idempotency and fencing integration tests pass; signer fields
and holdings remain frozen after live mutations. Run affected tests and typecheck. Mark complete,
record evidence, stop for review.

## Phase 4 — Anchoring and durable recovery — NOT STARTED

**Outcome:** OpenTimestamps failures and process interruptions leave discoverable work; concurrent
workers cannot replace authoritative state with stale results.

**Files:** `AnchorSealUseCase`, `UpgradeAnchorsUseCase`, `SealWorkRepository` extensions,
`src/infrastructure/anchor/` providers/configuration, work/seal adapters, composition wiring,
`src/app/api/internal/anchors/upgrade/route.ts`, `.env.example`, package metadata and tests.

**Work and tests first:**

- [ ] Wrap OpenTimestamps behind the domain port; verify installed library behavior with fixtures.
      Submit the raw manifest digest, validate proof/digest agreement, bound calls with timeouts,
      preserve upgraded proof bytes when explorer verification fails, and isolate library logging.
- [ ] Fail production startup for missing, unknown or stub provider configuration. Require the
      internal worker secret. Dev/test simulations are explicitly identifiable throughout read models
      and can never produce a real Bitcoin-verification result.
- [ ] Keep network calls outside database transactions. Save aggregate changes with the current
      fencing token; test a slow expired worker returning after another worker has acquired the claim.
- [ ] Implement failure backoff (5 min, 15 min, 1 h, 6 h, then daily), pending upgrades and atomic
      supersession/replacement after three days. Preserve at most one active anchor, including after
      failed first submission and failed replacement submission.
- [ ] Reconcile eligible finished polls without seals, seals without active anchors and due anchors
      in bounded batches. Add the hook for missing/pending bundle deliveries implemented in Phase 6.
      Test restart after each durable boundary; one failing item must not starve the rest.
- [ ] Reuse claims for immediate handlers, cron and poll-specific lazy nudges. Enforce the lazy
      nudge interval through durable state so multiple server instances cannot bypass it.
- [ ] Add the POST-only internal worker route with constant-time bearer authentication, fail-closed
      behavior and counts. Test unauthorized requests, empty/malformed secrets and concurrent calls.
- [ ] Add an opt-in `OTS_LIVE_TEST=1` smoke test. It is not a dependency of normal tests; pending
      calendar acceptance is not evidence of Bitcoin confirmation.

**Acceptance:** failure/restart/fencing/state-constraint tests pass with no external services in the
regular suite. Test real adapter behavior with retained proof fixtures and run the live smoke test
when the integration environment is available. Mark complete, record evidence, stop for review.

## Phase 5 — Authorized exports and standalone CLI — NOT STARTED

**Outcome:** exported local files can be checked independently of the running application, and every
server export obeys the disclosure matrix.

**Files:** seal read use cases/errors, shared pure verification core, the four
`src/app/api/polls/[pollId]/seal/{manifest,proof,sections,my-proof}/route.ts` routes, standalone CLI
adapter/build entry, fixture bundles, package scripts and verifier documentation under `readmes/`.

**Work and tests first:**

- [ ] Define public status/manifest/proof read models and policy-gated sections. Serve canonical
      manifest/section bytes; never reformat downloaded commitments. Proof is confirmed when
      available, otherwise pending; unavailable proof returns the specified error/404.
- [ ] Test the full anonymous/named/open × admin/member/voter/outsider matrix. Finished anonymous
      members receive `poll` and `tallies`; named members may receive `register`; only admins receive
      `signers`. No export exposes another person's receipt secret.
- [ ] Base own-proof eligibility on sealed participation and return only the authenticated voter's
      leaves and paths. Gate canonical poll labels separately under current results policy, including
      after membership is lost. Own participation must not unlock unrelated sections.
- [ ] Implement structured verification outcomes: canonical section/manifest consistency, complete
      original-receipt agreement, current-record inclusion, authenticated labels and proof/digest
      binding. Treat timestamp confirmation as a separate check.
- [ ] Test changed ballots with the same secret and valid replacement paths, missing/extra/duplicate
      own leaves, forged labels, tampered canonical bytes/manifests, invalid paths, mismatched proof
      digest, unsupported format, empty or malformed bundles and pending/synthetic proof handling.
      Strictly validate imported structures before hashing or interpreting them.
- [ ] Add a standalone CLI over the shared core. Filesystem and argument handling remain in its
      adapter. It reads local receipts/bundles/sections/proofs, reports specific failed checks and uses
      nonzero exit codes for failures. It never needs a site login, application database or server.
- [ ] Package a runnable standalone artifact with its dependencies and instructions; prove it runs
      from a clean directory with application environment variables absent. Use exported fixtures
      and the same adversarial cases as the core, not a second verification implementation.
- [ ] Document and execute the exact `ots` commands against fixtures, explicitly distinguishing a
      raw digest from a text file containing hex. Record consistency works offline; obtaining or
      independently checking Bitcoin evidence has its own stated prerequisites.

**Acceptance:** policy route tests pass; the CLI verifies the valid fixture and fails tampered cases
without contacting the app. Document how to upgrade/verify pending timestamps and the limits of
receipt-code-only checks. Mark complete, record evidence, stop for review.

## Phase 6 — Receipt and bundle delivery — NOT STARTED

**Outcome:** voters receive their cast-time receipt; the first usable proof can trigger a first bundle
email even after delayed sealing or submission. Ambiguous sends are not silently retried.

**Files:** receipt/bundle email services, `EmailSender`/template ports and email adapters,
`NotifyPollFinishedUseCase`, bundle-delivery schema/work adapter/reconciliation, composition wiring,
locale messages and matching tests.

**Work and tests first:**

- [ ] Extend email attachments and localized plain-text/HTML templates. Attach the exact versioned
      cast-time `receipt.json`; email failure leaves the committed on-screen receipt available.
- [ ] Add unique `(sealId, userId)` delivery records with `PENDING`, `SENDING`, `SENT`, `FAILED` and
      `UNKNOWN`. Discover missing initial deliveries once a usable proof exists. Confirm current
      recipient eligibility/email and authorized label data when preparing a send.
- [ ] Atomically claim pending delivery before external email I/O. Record success/failure; expired
      interrupted sends become `UNKNOWN`. Never automatically resend `SENT`, `FAILED` or `UNKNOWN`.
      Test concurrent workers and crashes before send, during send and before persisting success.
- [ ] Send only manifest, own leaves/paths, authorized canonical label data and proof. Even an
      administrator's participant bundle excludes the signer list, others' preimages and receipt
      secrets. Reuse the export assembler instead of a separate permissive email mapper.
- [ ] Complete the fourth recovery scan and test first delivery after sealing/submission recovery,
      changed email status and uniqueness across repeated scans.
- [ ] Add the optional root digest to finish notifications without suppressing the notification when
      sealing fails. Use the existing `notification.types.<type>.<field>` localization resolver.

**Acceptance:** attachment/privacy tests and real database delivery-state tests pass; delayed first
send works while failed/ambiguous sends remain terminal. Mark complete, record evidence, stop for review.

## Phase 7 — Hosted receipts and verification — NOT STARTED

**Outcome:** the voter can save an original receipt and later distinguish original-ballot verification
from weaker inclusion checks; public visitors see commitments without private record contents.

**Files:** finish-voting action and `VotingInterface`, new `src/web/components/seal/` components,
public `/verify/[pollId]` and voter `/polls/[pollId]/verify-my-vote` pages, results links/status,
`PollCard`, site-origin helper, locale messages and relevant component/route/browser tests.

**Work and tests first:**

- [ ] Return a plain owner-only receipt DTO from the action; show copy/download, original answer
      labels/hashes, delivery outcome and confirm-email prompt. Cover reload/replay and successful
      voting despite cleanup/email failure.
- [ ] Build public status, digest, five section commitments, proof/manifest downloads, block data
      and the tested independent-verification recipe. Public HTML and client props contain no poll
      title, organization name, participants, signer contents or receipt secret.
- [ ] Reuse the shared verification core for authorized section checks and voter receipt imports.
      Imported receipts and secrets stay local. Clearly label original-receipt success, current-record
      inclusion only, unavailable evidence, unverified labels and pending Bitcoin confirmation.
- [ ] Resolve sealed labels only after validating authorized/imported canonical poll data. Test that
      loss of results access does not reveal that section through the voter page or client props.
- [ ] Add status badges, copyable digests and links on cards/results. Batch lightweight status reads
      for lists; avoid loading full sealed records once per card. Lazy nudges use Phase 4's worker.
- [ ] Verify English/Russian copy, mobile layout, keyboard operation and accessible feedback.
      Add browser coverage for a complete vote → receipt → seal → import flow and privacy failures,
      using an isolated test browser profile and clearly simulated anchoring where appropriate.

**Acceptance:** browser verification agrees with the CLI on shared fixtures; no unsupported claim is
shown for code-only, pending or simulated checks. Run affected web tests, typecheck and lint.
Mark complete, record evidence, stop for review.

## Phase 8 — Frozen results and protocols — NOT STARTED

**Outcome:** final covered results and all three PDFs describe the same immutable record.

**Files:** `GetSealedProtocolUseCase`, results page/read-model integration, three PDF routes,
`pollResultsPdfGenerator`, `namedProtocolPdfGenerator`, `protocolSignersPdfGenerator`, shared
`sealFooter`, locale messages and regression tests.

**Work and tests first:**

- [ ] Map stored `poll`/`tallies`/`register` sections into final results and named protocol inputs.
      Use frozen organization/board/user/holding values; current policy still controls access.
- [ ] Build the admin-only signers protocol from stored `poll` plus `signers`. Include willing
      voters' consented phones and declining voters' names only; preserve missing-decision semantics.
- [ ] Define explicit fallback states: active exports remain preliminary; eligible finished polls
      awaiting a seal show sealing pending/unsealed; legacy finished polls remain unsealed. Never
      pair live covered contents with a footer claiming a saved seal covers them.
- [ ] Share the footer's digest, anchor status, URL and QR across generators. Explain record
      verification without claiming the PDF bytes are authenticated.
- [ ] Change live names, titles, organizations, boards, holdings, willingness and phones after seal;
      assert final displayed/PDF data remains frozen and access remains policy-correct. Also verify
      the no-seal fallback and authorized signer route independently of client-side hiding.

**Acceptance:** all three PDF inputs agree with the saved canonical sections; privacy and frozen-data
regressions pass. Inspect representative English/Russian PDFs. Mark complete, record evidence, stop
for review.

## Phase 9 — Rollout rehearsal and release handoff — NOT STARTED

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

| Phase | Completed       | Failing test observed                                  | Passing checks/evidence                                                                                         | Review status        |
| ----- | --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1     | Yes, 2026-10-26 | Yes; client usage, type contracts and regression tests | 99 domain / 3,430 total tests; 13 compile rejections; types, lint, format, browser bundle, independent fixtures | Awaiting user review |
| 2     | No              | —                                                      | —                                                                                                               | Not started          |
| 3     | No              | —                                                      | —                                                                                                               | Not started          |
| 4     | No              | —                                                      | —                                                                                                               | Not started          |
| 5     | No              | —                                                      | —                                                                                                               | Not started          |
| 6     | No              | —                                                      | —                                                                                                               | Not started          |
| 7     | No              | —                                                      | —                                                                                                               | Not started          |
| 8     | No              | —                                                      | —                                                                                                               | Not started          |
| 9     | No              | —                                                      | —                                                                                                               | Not started          |

## Unresolved questions

None requiring a product decision before Phase 2. The four review decisions are settled in design
§18. If implementation exposes a format or guarantee change, record it and resolve it before coding
past that boundary; do not silently resurrect the superseded plan's choices.
