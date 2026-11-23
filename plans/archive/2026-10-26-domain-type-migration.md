# Domain types and primitive-obsession migration

**Created:** 2026-10-26

**Status:** Complete, 2026-11-10. All migration phases and batches complete; no commits.

**Goal:** Remove primitive obsession across the codebase, starting in the domain and carrying
meaningful types through application, infrastructure and web boundaries. On 2026-11-04 the user
replaced automatic continuation with review batches, later enlarged to roughly three earlier
batches per review (about 9–15 related source/test files where practical). On 2026-11-10 the user
set a new active goal to finish all batches; this supersedes intermediate review stops. Preserve
batch checkpoints and verification while continuing through the complete remaining scope. No commits.

## Completion checklist — 2026-11-10

The resumed worktree contains the preceding migration, including batches 1–15. Fresh baseline:
full production/test TypeScript passes; all 4,245 unit tests pass across 453 files. Existing staged
work is preserved. This checklist closes the original type/state/boundary requirements and the
notification compatibility work already introduced; unrelated global repository rewrites are not
implied by it. Completion requires evidence for every item below and phase checkboxes reconciled
against current source/tests, rather than historical counts or a primitive-text search alone.

- [x] Audit all domain retained-state/value/port declarations; classify remaining primitives as
      raw decoding inputs, canonical wire values, display/search text, independent booleans or
      local arithmetic. Fix actual missing value/state constraints with client regressions.
- [x] Finish typed notification production/save outcomes and integrate all callers; remove the
      transitional duplicate query/mutation compatibility contracts and unsafe notification loads.
- [x] Verify application/infrastructure/web paths retain existing IDs/units/closed alternatives;
      resolve remaining erasure, constructor bypasses and mutable-state leaks found by the audit.
- [x] Verify poll/ownership invariants and decimal/evidence compatibility with focused regression
      and disposable PostgreSQL checks. Record the separately identified participant-removal
      lifecycle/storage issue without silently changing retention policy or application data.
- [x] Add a maintainable regression guard for meaningful core type contracts and document the
      intentional raw/wire/text representations and separately scoped legacy exception contracts.
- [x] Run final full unit, production/test compiler, applicable PostgreSQL, lint/format,
      whitespace and localization checks; record exact results, reconcile phases, archive the
      completed plan and update the documentation index/assessment. Never commit.

**Assessment:** [Scope, baseline and risks](../../readmes/2026-10-26-domain-type-migration-assessment.md).
This migration includes ongoing new poll/seal type corrections. It does not authorize starting
new feature work in [poll-sealing Phase 3](../2026-09-15-poll-seal-and-anchor.md).

## Review batch 1 — Ownership responses — COMPLETE, reviewed

2026-11-04. Scope: `listActiveOwnershipForAssetAction` and `listOwnershipRowsAction`,
finishing the already-started ownership projection work. Both responses retain validated
identities/shares; history retains validated instants. Owner data stays an exclusive user/external
alternative through explicit plain-field serializers. Display labels use existing validated user
identities. Authorization, query scope, wire shapes and numeric precision are unchanged.

- [x] Connect both ownership actions to the typed projections and serializers.
- [x] Verify user/external owners, unavailable profiles and exclusion of extra source fields.
- [x] Verify the three ownership action contracts reject ambiguous/missing owners and invalid time.
- [x] Record the unfinished broader work; stop for review before another batch.

**Checks:** 33 focused tests pass across ownership domain/value, repository and serializer suites;
production TypeScript and scoped lint/format checks pass. Full production/test TypeScript now reports only 14 unused
`@ts-expect-error` directives in `property-action-type-contracts.ts`, down from 17 before this batch.
These are pre-existing failing contracts for unfinished property/claim responses. They remain
visible; the full working tree is not green. The historical 4,008-test checkpoint below predates
that interrupted work. No database checks rerun, migrations or commits; automatic goal stays paused.

**Deferred:** Property/asset creation and list responses, member search and claim responses;
parent-request/system-setting projections and the broader domain audit remain later batches.

## Review batch 2 — Property and asset responses — COMPLETE, reviewed

2026-11-04. Scope: property/asset creation and list actions, their shared serializers and tests
(four source/test files). Creation returns distinct `PropertyId`/`AssetId` types. Lists preserve
validated IDs, names, address, size units, asset sizes and nullable archive instants. The existing
request validation, authorization and serialized field names/values remain unchanged.

- [x] Connect both list actions to typed plain-field serializers; retain creation result IDs.
- [x] Verify eight compile contracts reject swapped IDs, unknown units, shares used as sizes,
      and invalid archive timestamps. All eight failed before this batch's implementation.
- [x] Verify active/archived serialization, absent addresses, exact sizes/times and field filtering.
- [x] Record the remaining failures and stop for review.

**Checks:** 47 focused tests pass across property/asset domain, creation use cases and property/
ownership serializers. Production TypeScript, scoped lint/format and unstaged whitespace checks
pass. Full production/test TypeScript reports only ten pre-existing unused
`@ts-expect-error` directives for member-search and claim responses, down from fourteen at the
previous review stop (four additional assertions were added and fixed in this batch).
No migrations or commits; automatic goal stays paused.

**Deferred:** Member-search and claim responses, then parent-request/system-setting projections
and the broader domain audit. Full-tree verification remains incomplete until those contracts pass.

## Review batch 3 — Member-search response — COMPLETE, reviewed

2026-11-04. Scope: the tree-member search action and its response/serialization tests (three
source/test files). The action now uses the existing explicit serializer and preserves `UserId`
and `OrganizationName[]`. Display labels remain formatted text. Request validation, authorization,
tree scope, result limits and serialized fields are unchanged.

- [x] Preserve member identities and organization-name types through the action response.
- [x] Observe both negative type contracts fail before implementation and pass afterward.
- [x] Check labels with/without middle names and plain serialization of the permitted fields.
- [x] Record checks and stop for review.

**Checks:** 21 focused tests pass across directory authorization, repository and serialization.
Production TypeScript, scoped lint/format and unstaged whitespace checks pass.
Full production/test TypeScript reports only nine pre-existing failing claim-response contracts,
down from ten at the previous review stop (one additional contract was added and fixed here).
The full tree remains unverified until those failures are resolved. No commits or migrations;
automatic goal stays paused. Next batch: claim responses.

## Review batch 4 — Claim submission and attachment responses — COMPLETE, reviewed

2026-11-04. Scope: `submitPropertyClaimAction`, `listClaimAttachmentsAction` and their compiler
contracts (two source/test files). Submission preserves `PropertyClaimId`; the attachment response
selects the existing metadata port's validated ID, filename, MIME type and byte count. The explicit
field mapping, access checks and runtime behavior are unchanged. Content bytes remain confined
to the download path.

- [x] Preserve claim/attachment identities and validated attachment metadata in action responses.
- [x] Observe all five negative contracts fail before implementation and pass afterward.
- [x] Verify the existing claim submission, attachment validation and repository suites.
- [x] Record checks and stop for review.

**Checks:** 37 focused tests, production TypeScript, scoped lint/format and unstaged whitespace
checks pass. Full production/test TypeScript reports only six pre-existing
failing claim-list contracts, down from nine at the previous review stop (two new assertions were
added and fixed here). No migrations or commits; automatic goal stays paused.

**Deferred:** Member property/claimable-asset lists and pending/own-claim responses, then
parent-request/system-setting projections and the broader audit. The full tree is not green yet.

## Review batch 5 — Member property and claimable-asset lists — COMPLETE, reviewed

2026-11-04. Scope: `listOrgPropertiesForMemberAction`, `listClaimableAssetsAction` and their
compiler contracts (two source/test files). Both actions reuse the application layer's existing
safe projections, preserving distinct property/asset IDs and names plus validated nullable
property addresses. Runtime projections, authorization and pending-claim filtering are unchanged.

- [x] Preserve `SafePropertyView` and `ClaimableAssetView` in the action return types.
- [x] Observe all five negative contracts fail before implementation and pass afterward.
- [x] Verify existing access, field-selection and pending-claim filtering tests.
- [x] Record checks and stop for review.

**Checks:** Seven focused tests, production TypeScript, scoped lint/format and unstaged whitespace
checks pass. Full production/test TypeScript reports only four
pre-existing failures in pending/own-claim response contracts, down from six at the previous
review stop (three new assertions were added and fixed here). No commits or migrations;
automatic goal stays paused.

**Deferred:** Pending/own-claim responses, then parent-request/system-setting projections and
the broader audit. Full-tree verification remains incomplete.

## Review batch 6 — Pending and personal claim responses — COMPLETE, reviewed

2026-11-04. Scope: both remaining claim-list actions, a plain-field serializer module and their
runtime/compiler contracts (five source/test files). Pending rows preserve IDs, names, instants,
attachment metadata and ownership percentages. External-owner slots retain a non-null validated
label. Personal rows preserve the domain's pending/approved/denied alternatives with the required
decision time and denial reason. Private actors and attachment bytes stay outside the payload.

- [x] Preserve domain values and decision alternatives through both response types.
- [x] Verify six negative contracts fail before implementation and pass afterward; the pending
      decision check now uses a valid branded instant so it tests the state combination itself.
- [x] Verify all decision variants, zero/fractional/full shares and nested field filtering.
- [x] Add failing regressions for attachment/ownership read failures, then propagate those errors.
- [x] Record checks and stop for review.

**Behavior correction:** Previously, a failed attachment or ownership read silently became an
empty list in a successful response. The action now returns the translated failure code for the
whole request. Successful empty reads still succeed. Authorization, successful field shapes,
percentage arithmetic and stored data are unchanged.

**Checks:** All 47 focused domain/repository/action/serializer tests pass, including both new
read-failure regressions. The full production/test TypeScript check now passes: all previously
unfinished property/claim action contracts are resolved. Scoped lint/format and unstaged whitespace
checks pass. Full unit/database suites were not rerun for this batch; the broader audit remains open.
No commits or migrations; automatic goal stays paused.

**Next review batch:** Parent-request/system-setting response projections, then remaining boundary
and persisted-state audit work. The participant-removal history issue still needs a separate
lifecycle/storage decision.

## Review batch 7 — Parent-request responses — COMPLETE, reviewed

2026-11-04. Scope: three parent-request read actions, transport contracts/serializer, compiler
and serialization tests, and the incoming-request table integration (five source/test files).
Responses retain request/organization identities, validated messages, rejection reasons and
profile names. The combined view preserves pending/accepted/rejected decision alternatives.
Existing Date projections, nullable missing profiles and the `Unknown` organization label remain
explicit transport conventions. Nested profiles are mapped field by field.

- [x] Observe eight negative response contracts fail before implementation and pass afterward.
- [x] Preserve valid decision data and exclude private nested profile fields.
- [x] Integrate the consumer without constructing partial local decisions.
- [x] Verify checks and stop for review.

**Consumer correction:** The incoming table previously patched only status/reason locally after
handling a request, retaining a null handling time; its initial-state copy also ignored refreshed
server props. It now renders the current server-provided requests after the existing refresh.
The compiler exposed the invalid partial decisions before the integration fix.

**Checks:** 22 focused domain/application/serialization tests, eight negative compiler contracts,
full production/test TypeScript, scoped lint/format and unstaged whitespace checks pass. UI
integration was typechecked; no browser smoke test or full unit/database rerun for this batch.
No commits or migrations; automatic goal stays paused.

**Next batch:** System-setting response projections, followed by the broader boundary and
persisted-state audit. The participant-removal history issue remains a separate storage decision.

## Review batch 8 — System-setting response units — COMPLETE, reviewed

2026-11-04. Scope: the system-settings read action and runtime/compiler contracts (three
source/test files). Responses preserve distinct checks-per-hour, daily-token-cap and minimum
organization-size values. The read helper retains the whole setting alternative until its key
is checked; independent reads run together. Defaults and zero-disabled gates retain their values.

- [x] Observe three swapped-unit compiler contracts fail before implementation and pass afterward.
- [x] Add a failing regression for a repository result returned under the wrong setting key.
- [x] Preserve defaults, stored values, authorization and rate-limit checks.
- [x] Record checks and stop for review.

**Behavior correction:** A wrong-key repository result previously populated unrelated fields
with its numeric value. The read action now returns the translated unexpected-error code.
Valid settings retain their existing numeric wire representation.

**Checks:** Eight focused domain/adapter/action tests, three negative compiler contracts and
full production/test TypeScript pass. Scoped lint/format and unstaged whitespace checks pass.
Full unit/database suites were not rerun for this batch.
No commits or migrations; automatic goal stays paused.

**Deferred:** The existing throwing setting decoder/storage contracts (including AI callers)
need a separate Result-based slice. Broader boundary/persisted-state audit and the participant
history storage decision remain open.

## Review batch 9 — Settings failures through storage, AI and admin — COMPLETE, reviewed

2026-11-04. First enlarged batch: 14 related source/test files. Settings decoding and persistence
now return typed Results. A shared application reader applies defaults only to absent rows,
checks the requested key and preserves its specific value unit without casts. AI quota validation
and admin reads/writes explicitly propagate failures. Existing product ranges, zero-disabled gates,
quota ordering, superadmin bypasses and storage strings are preserved.

- [x] Replace expected decoder exceptions with typed validation failures; test malformed/valid input.
- [x] Make repository reads/writes return Results; test absent, invalid, wrong-key and failed storage.
- [x] Preserve key-specific units and default semantics in a shared application reader.
- [x] Integrate AI and admin callers, with failing regressions before correcting error handling.
- [x] Map configuration/storage failures to HTTP 500 before provider calls; retain other statuses.
- [x] Verify the full slice and stop for review.

**Checks:** 51 focused tests pass across domain, adapter, application, admin action and HTTP suites.
Negative compiler contracts verify three specific setting units and mandatory failure handling.
Full production/test TypeScript, scoped lint/format and unstaged whitespace checks pass.
No full unit/database rerun or live provider calls for
this batch. No commits or migrations; automatic goal stays paused.

**Remaining:** Broader domain/boundary audit, especially retained state and constructor/rehydration
contracts. The participant-removal history issue remains a separate lifecycle/storage decision.

## Review batch 10 — Typed inline attachment ownership — COMPLETE, reviewed

2026-11-04. Scope: shared attachment reference contracts/extraction/validation and all poll/report
creation/editing callers (nine source/test files). A discriminated scope binds each recognized
URL prefix to readonly IDs of the corresponding attachment type. Canonical prefix constants live
with that contract and retain their existing exports. No unchecked identity casts are introduced.

- [x] Observe three compiler contracts fail before tightening the API: swapped poll/report IDs
      and raw string ownership IDs must be rejected.
- [x] Bind ownership scope to the recognized namespace and integrate all four aggregate call sites.
- [x] Verify owned/foreign references, report scope and readonly ownership snapshots.
- [x] Preserve existing URL extraction, content error codes and creation/editing behavior.
- [x] Record checks and stop for review.

**Audit finding:** Most remaining raw ID declarations scanned in domain files describe untrusted
persistence/serialization inputs, rather than retained domain state. They remain primitive at the
decoding boundary. Extracted URL tokens also remain untrusted strings: exact comparison against
validated ownership IDs is intentional. The previous interchangeable `ownIds: string[]` policy
input was a real type-erasure gap and is now removed.

**Checks:** 146 focused tests pass across extraction, ownership validation, poll/report content
and aggregate suites, including existing owned/foreign edit and new-content rejection cases.
Full production/test TypeScript, scoped lint/format and unstaged whitespace checks pass.
Compiler contracts cover both invalid substitutions and valid poll/report scopes. Full unit/
database suites were not rerun. No commits or migrations; automatic goal stays paused.

**Remaining:** Continue the bounded domain/port audit, including moderation reason contracts and
retained-state/rehydration failure paths. Participant-removal history still needs a storage decision.

## Review batch 11 — Typed user moderation commands and direct reads — COMPLETE, reviewed

2026-11-04. Scope: 14 source/test files spanning the domain, application, persistence and direct
admin actions. New moderation entries retain distinct validated audit/user identities, a closed
status choice, a nonblank exact-byte reason and a caller-supplied immutable instant. Historical
reason snapshots are separate and deliberately preserve empty/null legacy values.

- [x] Add a validated immutable moderation record and compiler checks for IDs/reasons/block states.
- [x] Authorize commands in a use case and append through a dedicated Result-based core port.
- [x] Decode stored status/history explicitly; reject malformed rows and propagate storage failures.
- [x] Route block/unblock/status/history actions through the core; preserve Date payloads and
      profanity field errors. Existing generic user-repository compatibility methods retain typed reasons.
- [x] Verify existing action callers and append-only audit behavior, then stop for review.

**Behavior corrections:** Direct moderation commands validate target identities before storage;
failed appends/reads return translated failures. Invalid stored statuses cannot appear as an
unblocked result through the new direct read path. New audit IDs/time are supplied by the
application instead of relying on DB defaults. Existing stored records are untouched.

**Checks:** 74 focused domain/application/adapter/action tests pass, including legacy caller and
authorization suites. Full production/test TypeScript passes with seven negative compiler
contracts. Scoped lint/format and unstaged whitespace checks pass.
No full unit/database rerun, live moderation calls, commits or migrations.
Automatic goal stays paused.

**Remaining at this checkpoint:** Activity-summary/search status projections and generic
authentication block checks retain their legacy read contracts; batch 12 addresses these reads.
The broader retained-state/rehydration audit and participant-removal history storage decision remain.

## Review batch 12 — Moderation projections and authenticated access — COMPLETE, reviewed

2026-11-04. Scope: 15 source/test files spanning the core read port, Prisma adapter, admin
projections and authenticated layout. Bulk status reads and blocked-user filtering now return
validated identities, closed block alternatives and explicit storage Results. A pure domain
access policy distinguishes allowed/blocked; the application reader propagates unavailable state.

- [x] Decode bulk statuses and latest blocked-user identities at the persistence boundary;
      reject invalid identities/statuses and propagate query failures.
- [x] Move activity summaries, user search and paged user-list moderation reads onto the core port;
      batch status queries and preserve existing Date/ISO timestamp representations.
- [x] Keep active block timestamps required and historical reason snapshots exact in shared
      transport projections; verify invalid state/value combinations fail compilation.
- [x] Route the authenticated layout gate through the Result-based application reader;
      preserve blocked redirects and display localized failures before rendering protected children.
- [x] Surface activity-page read failures instead of displaying an empty summary; use an empty
      ID set for an empty blocked filter instead of a sentinel identity.
- [x] Verify the complete moderation slice and existing authorization callers, then stop for review.

**Behavior corrections:** Malformed/unavailable moderation reads cannot appear as successful
unblocked/empty results through these paths. The admin page displays the translated read error;
the authenticated layout displays a localized error when moderation state is unavailable.
Missing audit history still means allowed. Empty blocked filters cannot match a real user whose
ID happens to equal the former sentinel. Stored records and permission checks are preserved.

**Checks:** 100 focused tests pass across 11 domain/application/adapter/action/layout suites.
Full production/test TypeScript passes, including five new negative compiler contracts.
Scoped lint/format and unstaged whitespace checks pass. No full unit/database rerun,
live moderation calls, commits or migrations. Automatic goal stays paused.

**Remaining:** Generic user-repository moderation read methods are deprecated compatibility
contracts with no active production consumers; their legacy implementations/test fakes remain.
Broader primitive/retained-state/rehydration auditing and the participant-removal history storage
decision remain separate work. The mocked adapter suites do not verify live PostgreSQL execution.

## Review batch 13 — Notification transport and navigation contracts — COMPLETE, reviewed

2026-11-04. Scope: 11 source/test files spanning notification actions, explicit transport mapping,
navigation and the inbox page/list. Existing domain notification alternatives now retain their
correlated payloads, validated IDs, localization keys and authoritative count units through the
action response and client props. No new domain brands or storage formats were needed.

- [x] Preserve notification identities, closed event kinds/payloads and count units in list/count
      actions; observe erased action contracts fail before implementation.
- [x] Explicitly copy permitted nested fields for all 32 event kinds; exclude recipient/audit
      fields, detach Dates/payloads and preserve historical labels/reasons/body choices.
- [x] Accept one correlated event in navigation; exhaustively handle every kind, retain existing
      destinations/no-action cases and use closed action localization keys.
- [x] Preserve typed notification selections and props in the list; use validated localization
      keys directly, removing translation casts. Optimistic presentation counters remain numbers.
- [x] Show localized inbox read failures instead of replacing them with an empty successful list;
      observe the regression before correcting the fallback.
- [x] Verify recipient/rate gates, domain/application/adapter callers and compiler contracts;
      stop for review.

**Behavior correction:** An initial inbox read failure now displays the translated error rather
than an empty inbox. Valid payload fields, historical text, Date transport, navigation destinations,
recipient scoping and rate limits are preserved. Invalid raw events are rejected by the existing
domain schema before typed navigation; the helper no longer accepts independent kind/data arguments.

**Checks:** 150 focused tests pass across 29 notification domain/application/adapter/action/page/
navigation suites. Full production/test TypeScript passes, including nine new negative compiler
contracts. Scoped lint/format and unstaged whitespace checks pass. No full unit/database rerun,
browser smoke test, migrations or commits. Automatic goal stays paused.

**Remaining:** Notification persistence/rehydration still uses legacy throwing contracts; paged
client mutation/load failures retain existing handling. Broader primitive/retained-state auditing
and the participant-removal history storage decision remain separate work. No live DB/provider
calls were made; adapter tests mock persistence.

## Review batch 14 — Notification inbox read failures — COMPLETE, reviewed

2026-11-04. Scope: 15 source/test files spanning checked domain restoration, a dedicated inbox
read port/Prisma adapter, read use cases/actions and the authenticated shell. The separate query
port bounds this migration without changing every notification producer's write contract.

- [x] Add `Notification.restore` returning a typed Result for stored identities, content and
      instants; preserve detached state, exact labels and the original read timestamp.
- [x] Add a Result-based inbox reader for recipient-scoped lists and unread/total counts;
      decode rows/counts outside query catches and fail the entire read on a malformed row.
- [x] Keep valid empty lists/zero counts distinct from query or decoding failures; propagate
      every list/count failure through the two application readers and localized actions.
- [x] Connect the authenticated shell to the unread-count application reader; keep parallel
      reads, setup/moderation gates and blocked-redirect priority.
- [x] Cover failing restoration/adapter/use-case/action/layout regressions before implementation;
      verify compiler rejection of unchecked IDs and unhandled restoration/read Results.
- [x] Verify existing notification producers, mutations, serialization/navigation and page callers;
      record remaining compatibility paths, then stop for review.

**Behavior corrections:** Inbox list/count reads now return localized errors for unavailable or
malformed stored data instead of relying on promise rejection. An unavailable unread count in the
authenticated shell displays a localized error before rendering the shell/children; it cannot
appear as a successful zero badge. Active user blocks retain redirect priority. Valid payloads,
recipient filters, pagination/order, count units, timestamps and stored records are preserved.

**Checks:** 177 focused tests pass across 31 domain/application/adapter/action/page/navigation/
layout suites. Full production/test TypeScript passes, including four new negative read/result
contracts. Scoped lint/format and unstaged whitespace checks pass. No full unit/database rerun,
browser smoke test, live DB/provider calls, migrations or commits. Automatic goal stays paused.

**Remaining:** Legacy `Notification.reconstitute` remains throwing and is deprecated; legacy
creation still validates with parse/catch. Write/read-delete mutation paths and producer failures
remain outside this read slice. The generic repository retains compatibility read methods with no
active production consumers for list/unread/total queries. Paged client mutation/load error handling,
broader primitive/retained-state auditing and the participant-removal history storage decision remain.
Mocked adapter tests do not verify live PostgreSQL behavior or a transactionally consistent page/count snapshot.

## Review batch 15 — Notification recipient mutation results — COMPLETE, continuation authorized

2026-11-04. Scope: 14 source/test files spanning a recipient repository port/Prisma adapter,
mark-one/mark-all/delete use cases and actions, compatibility annotations and compiler contracts.
Existing notification/user identity brands and immutable instants remain distinct through writes;
expected loading/persistence failures now appear in Result signatures and call-site branches.

- [x] Add a dedicated Result-based recipient repository; require the recipient identity on
      individual read updates and selected deletions, alongside typed notification IDs/time.
- [x] Restore loaded rows through the checked domain constructor and reject malformed selections
      without partial successful reads; translate query/write rejections at the adapter boundary.
- [x] Propagate failed loads/writes through mark-one, mark-all and deletion use cases; retain
      not-found/ownership checks, supplied time and first-read idempotence.
- [x] Add recipient filters to Prisma writes; retain unread-only updates, empty port no-ops and
      existing successful no-change behavior when concurrent operations leave no rows to change.
- [x] Route all recipient mutation actions through the port; localize failures and preserve
      authentication/rate gates and successful response shapes.
- [x] Deprecate generic repository query/mutation methods; verify typed arguments and explicit
      Result handling, existing producers/readers and serialization/navigation; stop for review.

**Behavior corrections:** Recipient mutations propagate failed persistence instead of reporting
success if a port returns failure. Unavailable/malformed selections cannot reach a mutation.
Writes now include the authorized recipient in their database filter. Expected failures return
translated codes through actions. Existing permission checks, first-read timestamps, notification
deletion policy and concurrent no-change success behavior are preserved; stored data is untouched.

**Checks:** 215 focused tests pass across 32 domain/application/adapter/action/page/navigation/
layout suites. Full production/test TypeScript passes with five new negative mutation contracts.
Scoped lint/format and unstaged whitespace checks pass. No full unit/database rerun, browser smoke
test, live DB/provider calls, migrations or commits. Automatic goal stays paused.

**Remaining:** Notification production/save failures, creation parse/catch and deprecated throwing
rehydration remain later work. Generic query/mutation implementations/test fakes remain compatibility
code without active production callers of those methods. Client mutation/load error presentation,
broader primitive/retained-state auditing and the participant-removal history storage decision remain.
Adapter tests mock Prisma; live database concurrency/transaction behavior was not verified here.

## Batch 16 — Completion inventory and retained poll membership — COMPLETE

2026-11-10. Fresh baseline: full production/test TypeScript and 4,245 unit tests pass. The
[completion audit](../../readmes/2026-11-10-domain-type-completion-audit.md) records reviewed core
contracts and intentional raw/wire/text/Date representations. A compiler-backed regular test
now resolves aliases and checks identity/unit/state fields, repository parameters, readonly
collections and private constructor state against an explicit reviewed boundary catalog.

A failing poll-client regression exposed that reconstruction accepted foreign and duplicate
questions. The aggregate now validates membership/uniqueness and copies the valid question list;
a repository fixture was corrected to represent a valid second poll. Focused aggregate/adapter
and compiler guard tests pass, as does full TypeScript. The subsequent full run passed 4,250
checks and exposed only the new batch-17 creation regression, which was then corrected and
verified with its notification/guard suites. Final full verification remains on the checklist.
No commits, schema changes or application migrations. Goal remains active; continue across batches.

## Batch 17 — Notification production/save integration — COMPLETE

Creation now validates through explicit schema results rather than catching programming bugs.
Save/save-batch ports and Prisma append operations return typed outcomes; 32 test repositories
were updated without weakening identity/state contracts. Producers now collect construction
Results instead of filtering failed members, and propagate create/append failures. Explicit
lookup failures remain failures, while legitimate missing/no-recipient cases stay successful no-ops.

Producer/caller regressions cover append failures, invalid batch recipients, failed recipient
facts, best-effort logging and awaited propagation. All 30 producers, report publication and
their callers handle typed delivery outcomes. Optional delivery logs failures and preserves
primary success; awaited delivery propagates failure, including after primary persistence where
that was already the lifecycle order. No rollback/outbox guarantee is introduced.

The append writer no longer duplicates eight inbox/recipient methods; checked reader/recipient
ports own those operations. Removed the throwing notification reconstruction compatibility API;
all loads use checked restoration. The 32 writer test doubles return the current append Results.
Full unit verification passes: **4,266 tests / 456 files**, with no unexpected TypeError or
ReferenceError logs. Full production/test TypeScript passes. Final formatting/lint follows.

## Batch 18 — Poll and analysis output type continuity — COMPLETE

The boundary audit found voting/result DTOs widening validated identities, text/position units,
tally units and signing consent alternatives. Poll creation responses, search counts, evidence
metadata and legal-analysis metadata also erased existing domain types. Compiler client checks
were observed failing before each correction. Explicit plain-field serialization, numeric
summation order and privacy filtering are preserved; brands do not change serialized values.

Full production/test TypeScript passes with the new contracts. Voting/results action regressions
pass, preserving plain payloads and voter/contact filtering. Formatting and lint pass across the
complete 922-file migration snapshot. Final full verification follows batch 19; no commits.

## Batch 19 — Moderation compatibility consolidation and decimal evidence — COMPLETE

Removed five unused generic user-repository moderation methods in favor of the checked core
moderation port. Compiler clients prove that user persistence cannot perform these legacy reads/
writes. Removed 190 compatibility methods from the production port/adapter and 36 test fakes;
updated remaining object fixtures and moved the old adapter clients onto explicit moderation
Results. No active production caller depended on these methods. Source/test TypeScript passes.

All **25 disposable PostgreSQL tests / 5 files** pass. New adapter round trips cover six-place
asset sizes through the maximum stored value and eight-place ownership shares from zero through
one, preserving supplied identities/time. Ballot acceptance now checks stored participant/vote
weights, replay snapshots and receipt preimages retain `12.345678`. A cross-context regression
preserves organization zero shares while rejecting zero sealed holdings and accepting the minimum
positive eight-place share. Future seal snapshot assembly remains poll-sealing Phase 3; this
migration does not invent a zero-share omission/storage policy or start that feature.

The disposable container was stopped. No application DB, schema/data migrations, provider calls
or commits. Final whole-tree verification and documentation reconciliation remain.

## Scope and execution rules

- Target identifiers, constrained values, units, closed alternatives and required state data.
  Preserve intentional wire-format primitives, unconstrained text, independent booleans and local
  counters. Do not replace every primitive mechanically.
- Work in small vertical slices: failing behavior/type-contract test → implementation → callers
  and adapters → verification. Group roughly three earlier slices per review (about 9–15 related
  source/test files where practical), recording completion/checks. The 2026-11-10 active goal
  authorizes continuing across batch boundaries through final completion without review stops.
- Keep domain behavior deterministic, constructors validated and rehydration unable to bypass
  invariants. Dependencies point inward; raw database/HTTP shapes are decoded at boundaries.
- Use distinct brands/value objects and explicit cross-context translation. Entity references may
  share an identity-only contract with one brand per entity kind; entities stay context-private.
  Seal-format IDs remain separate and require explicit conversion.
  Each string identity owns a regex matching its contract; shared factories take that regex.
  Verify accepted/rejected runtime values and compiler rejection of mismatched identities.
  Do not introduce unchecked casts or primitive aliases merely to satisfy the compiler.
- Preserve existing ID storage formats, public serialized shapes, decimal/rounding behavior,
  historical ballots, receipt bytes and sealed evidence. Never silently rewrite persisted data.
- Reject nonfinite and newly invalid inputs. Keep supported legacy states explicit; surface
  unexpected invalid persisted data instead of inventing a valid replacement.
- Brands alone require no schema migration. Any schema or data change needs concrete justification;
  none is implied by this plan. Do not run application-database migrations or cleanup by default.
- Preserve existing work and relevant comments. Add/update important file descriptions and
  localized error codes where required. **Never commit.**
- Prefer unit tests. Use disposable PostgreSQL tests for persistence guarantees. Typecheck
  affected tests explicitly because the build configuration excludes them.
- Run heavy checks sequentially with at most four workers and a 20 GiB memory/2 GiB swap cgroup;
  coordinate agent work so heavy builds never overlap. Use the established repository commands.

## Phase 0 — Finish new poll/seal type corrections — COMPLETE

- [x] Audit all new Phase 1–2 declarations and newly introduced contracts for meaningful primitives.
- [x] Tighten poll facts, IDs, timestamps, revisions, events, snapshot/transaction ports and mappings.
- [x] Preserve OPEN poll weight 1, organization-poll weights and receipt/seal serialization.
- [x] Verify invalid inputs and swapped IDs are rejected; run affected unit, type and database checks.
- [x] Record remaining intentional primitives and update the poll-sealing design/plan evidence.

**Evidence:** Before widening the migration: 3,457 unit tests, 22 disposable PostgreSQL
checks, production typecheck and scoped new-code typecheck passed. New/changed boundary files
formatted and linted. Shared identity foundations subsequently passed 27 targeted tests and
poll compile contracts distinguish eleven invalid substitutions. Broad migration checks will
be rerun after all caller integrations; the evolving tree is not yet fully integrated.

## Phase 1 — Identity/value foundations and creation lifecycle — COMPLETE

- [x] Review factories, repositories and tests that previously constructed `id: ''`.
- [x] Choose and document generated IDs before creation: application `IdGenerator` and `Clock`
      produce an explicit `EntityCreation` input; domain factories never create empty-ID entities.
- [x] Add validated identity/value foundations with runtime and compile-time contracts.
- [x] Migrate a board creation/read/write slice before widening adoption; preserve stored IDs.

**Evidence:** Board domain/application/adapter suites: 69 tests passed; scoped TypeScript
including negative identity contracts passed; changed files linted/formatted. IDs and immutable
times are supplied before creation; stored data is validated; archive time comes from `Clock`.
Cross-context caller integration continues with the broader migration.

**Integration checkpoint (2026-10-30):** All production and test sources compile with
`tsc --noEmit -p tsconfig.json`. All 3,717 unit tests and 22 disposable PostgreSQL checks pass.
Production domain scans find no empty-ID factories or ambient clock/randomness calls.
Test fixtures now supply identities/time, check `Result` alternatives and implement current
repository contracts. Invalid external-input tests retain explicit compile-error assertions.

New UUID strings satisfy existing opaque-token/storage constraints. Existing stored IDs remain
untouched; mixed old/new formats are supported without a schema migration.

## Phase 2 — Poll and ownership contracts/invariants — COMPLETE

- [x] Carry typed IDs/configuration/units through poll, question, answer, participant and vote flows.
- [x] Model ownership identity alternatives, shares, sizes and voting weights with explicit constraints.
- [x] Enforce valid finite/integer ranges and state-dependent data in creation, mutation and rehydration.
- [x] Preserve current arithmetic/rounding and historical evidence; verify boundary decimal round trips.
- [x] Preserve organization ownership share zero while converting explicitly to the seal format,
      whose holding rows require positive shares; do not merge these context constraints.
- [x] Update each slice's application callers, repository adapters and affected tests together.

**Historical partial evidence:** Question/answer slices passed 99 runtime tests and scoped TypeScript.
Board/question/answer/ballot negative compile contracts pass. Ballot entities reject invalid
weights and persisted identities; Vote/Draft/Participant adapters preserve assigned IDs and
timestamps. Draft commands validate question/answer membership and saved cardinality. Weight
updates now save their audit entry atomically; snapshot history no longer relies on row order.
Ballot suites passed 187 runtime tests; production and new regression tests pass scoped TypeScript. Snapshot/reconfiguration
callers and web composition now compile with the complete test tree. The 2026-10-30 database
run verifies atomic voting, receipt replay, stale writers and snapshot discard after migration.
The final contract/invariant audit remains open.

**Existing issue found:** Weight reconfiguration deletes a participant before inserting removal
history, but the history table has a cascading participant foreign key. Preserving removal
audit history requires an explicit lifecycle/storage decision; no schema change made here.

## Phase 3 — Remaining bounded contexts — COMPLETE

- [x] Migrate organizations/boards, user/auth/OTP, invitations, reports, notifications and AI.
- [x] Replace meaningful primitive contracts and invalid state combinations using each context's model.
- [x] Reuse valid existing value objects; make time/randomness explicit where construction requires it.
- [x] Complete each context's calling paths and checks before treating its migration as complete.

## Phase 4 — Boundary integration and tests — COMPLETE

- [x] Audit application ports/commands and infrastructure adapters for type erasure and bypasses.
- [x] Validate HTTP/form/database inputs and explicitly serialize permitted plain client DTOs.
- [x] Preserve privacy, localization, rate limits and externally observable payload formats.
- [x] Cover changed boundary failures, persistence round trips and type contracts; resolve regressions.

Boundary work also occurs within earlier slices; this phase verifies coverage across the codebase.

**Integration checkpoint (2026-10-30):** Resolved 1,492 whole-test-tree diagnostics without
weakening production types. Corrected a translated PDF label mistakenly typed as a question
kind. A canonical-phone regression exposed an SMS adapter mismatch: SMS.RU request/response
keys now use a separate validated digits-only type, converted from the domain phone format;
all 36 SMS adapter tests pass. Provider format: [SMS.RU send documentation](https://sms.ru/docs/api/api_group_sms/send).

Lint and Prettier pass on 716 changed source/test files; staged and unstaged whitespace checks
pass. Domain error-code localization audit finds no missing English/Russian entries. No commits
or application-database migrations performed.

**Count/time audit (2026-10-30):** Search ports for reports, polls, organizations and join
links now return validated `ResultCount`. Organization statistics use `MemberCount`, property
queries use `PropertyCount`, and attachment queries/limits use `AttachmentCount`. Adapters decode
raw database counts; negative/fractional values fail at the boundary. Public compile contracts
prevent page sizes, byte sizes and unrelated counts from substituting for these quantities.

Attachment metadata, ownership history projections and report sitemap publication times now use
immutable `Instant` values. Database Dates are decoded; web/PDF serializers retain the same UTC
string payloads. Six projection tests cover immutable timestamps; ordinary entity Date getters
remain defensive compatibility projections, not mutable internal state.

**Public numeric-input audit (2026-10-30):** Question/answer factories and transitions, including
`Poll.addAnswerToQuestion`, now require distinct page/order values. Vote/participant/history
factories and participant weight changes require `VotingWeight`. Raw requests are decoded before
these calls. Runtime malformed-input defenses remain tested. The regular poll type-safety test now
compiles question/answer and ballot-entity contracts as well as the original poll contract; those
files previously depended on the separate full-tree typecheck. Swapped-unit tests were observed
failing before the API changes.

**Verification:** All 3,754 unit tests, all 22 disposable PostgreSQL checks, and the complete
production/test TypeScript tree pass after these slices. No commits or application-database
migrations performed. Lint and formatting pass on 720 changed source/test files; staged and unstaged whitespace checks pass.

**Tally/delivery/error audit (2026-10-30):** Building totals now use `BuildingWeightTotal`
with explicit `null` for EQUAL polls, whose ownership denominator does not exist. The pure domain
calculation preserves ownership arithmetic and rejects overflow; presentation retains its previous
zero/hidden-stat behavior. Poll result/protocol/weight-preview projections retain identity, content,
question-kind, ownership and tally types. `TotalVotingWeight` is distinct from an individual
`VotingWeight` and has no individual cap. Counts and percentages retain their units; summation
order, rounding behavior and multi-choice voter deduplication are unchanged. Declined signing
consent is a result variant whose phone field must be null.

OTP delivery ports now correlate SMS/email channels with the corresponding destination type.
Concrete transports and composition factories carry that correlation; password reset requires
email delivery. The email adapter also rejects an invalid runtime destination before rendering
or sending. Attachment factories require `AttachmentByteCount`; raw persistence input is decoded
on rehydration, and byte-aware upload factories derive the count from actual content.

Report, poll, organization and invitation application operations now retain known error-code
unions. Operations coordinating another context explicitly include its failures. Production
application code has no remaining `Result<..., string>` annotations; negative client contracts
cover the migrated operations. Narrow report/poll read ports preserve repository error types.
Report and organization query outputs retain pagination/count units; invalid stored member
counts fail explicitly. This does not change existing localized code strings or success payloads.

**Historical verification (2026-10-30):** All 4,008 unit tests and the complete production/test
TypeScript tree pass after directory/action integration, per-ID regexes, credential ports and
address/profile validation.
All 24 disposable PostgreSQL checks pass for voting, receipts, snapshot discard, ownership
constraints and membership history preservation. These persistence checks precede the latest
read/form, configuration, provider and retained-user-state slices. No schema or SQL changed in
these slices; malformed stored state now fails domain validation. Lint and formatting cover 851 changed source/test files; staged and unstaged
whitespace checks pass. English/Russian entries for the previously untranslated
`poll.errors.participantNotFound` exist, with a regular test covering every `PollErrors` code
in both locales. No commits or application-database migrations performed.

**Directory integration (2026-10-30):** Seven application reads now use `OrganizationDirectory`
instead of Prisma: join-link member totals, member/admin lists, organization details, tree-member
search, and both pending-request views. `PrismaOrganizationDirectory` decodes IDs, profile values,
counts and immutable timestamps. Application authorization, exact organization/board scope,
search, ordering, pagination and tree-member deduplication retain their previous behavior.
Browser serializers explicitly unwrap nicknames and preserve existing Date/null/optional-name
payloads. Legacy missing member join times remain explicit null; malformed stored profiles, dates
or counts fail without returning unvalidated data. Both production application `prisma: any`
dependencies are gone. The subsequent membership slice removes the remaining six direct Prisma dependencies.

**Aggregate configuration audit (2026-10-30):** `Poll.applyWeightConfig` now requires distinct
`DistributionType`, `PropertyAggregation` and `PropertyId` inputs. Four negative client contracts
were observed failing before the signature change. A shared pure request decoder retains the
OPEN-poll rule and existing failure precedence while passing typed values to the aggregate.
Configuration history formatting also retains the distinct mode types. No calculation, persistence
format or receipt bytes changed.

**Membership integration (2026-10-30):** `MembershipStore` now owns persistence contracts for
join requests, decisions and invitation acceptance. Pure domain policies produce explicit new,
renewed, accepted and rejected variants with typed identities, actors, times and optional reasons.
Renewal explicitly clears rejection metadata; invitation acceptance preserves prior rejection
history. The Prisma adapter retains the existing transaction boundaries. A regression exposed an
ambient `new Date()` in invitation acceptance's update branch; both upsert branches now use the
injected clock. No new concurrency guarantees are claimed.

`GetUserOrganizations` now uses the directory port and retains typed profile/name/time values.
Browser mapping preserves prior Dates and fields. Legacy accepted rows without a join time and
rejected rows without decision time/actor retain their previous display omission. Membership
hierarchy I/O moved from domain to application; the domain selects memberships to leave using
pure facts. Production application code has no direct Prisma dependency, and production domain
code contains no async I/O orchestration.

**Invitation/board contracts (2026-10-30):** Invitation detail and inbox projections retain
distinct identities, target variants, names and immutable time. Missing related names are null
in the application and mapped to existing browser labels by an explicit serializer. Board creation
requires a validated `BoardName`; request decoding preserves trimming, length errors and profanity
behavior. Its application output retains typed values instead of reusing a raw persistence DTO.

**Question/answer content (2026-10-30):** Factories and mutations now require distinct
`QuestionText`, `QuestionDetails` and `AnswerText`, including answer creation through `Poll`.
Request decoders preserve pre-trim length limits, normalization, optional details and localized
failure codes. Profanity checks remain domain behavior. The aggregate exposes its answer-target
policy so request decoding preserves lifecycle-error precedence; the mutation repeats that policy
before changing the aggregate. Runtime and negative compile contracts cover these paths; fixtures
construct validated content instead of weakening production types.

**Poll/report content and finish time (2026-10-30):** Report creation and mutations retain
`ReportTitle`/`ReportBody`; poll creation and edits retain `PollTitle`/`PollDescription`.
Decoders preserve pre-trim length limits, title normalization, report Markdown bytes and known
failure codes. Report profanity validation remains shared domain policy, including the offending-
word suffix. Aggregate content-edit policies retain lifecycle-error precedence before request
decoding and are enforced again by mutations. Attachment ownership checks remain in aggregates.
`Poll.finish` now requires `PollInstant`; the application translates its clock directly to that
validated cutoff without a mutable Date round trip. Malformed runtime values leave state/events
unchanged; rehydration and serialized finish timestamps retain their prior formats.

**Email state and poll period (2026-10-30):** User email is now an immutable absent/unconfirmed/
confirmed union. Confirmation requires an address and returns an explicit failure otherwise; changing
or removing the address clears its confirmation. Rehydration rejects an orphan confirmation timestamp
instead of silently discarding it. Existing valid records and serialized fields are unchanged; invalid
stored combinations require an explicit data decision, not automatic repair. User/auth suites pass
367 tests, including the regression and negative state contracts.

Poll creation now requires `PollType` and a nominal immutable `PollPeriod`; edits accept the whole
validated period. Its private state prevents structural lookalikes from bypassing ordering checks.
Request decoders preserve content/attachment/date/kind validation order and lifecycle precedence.
Four negative contracts were observed failing before implementation; the poll and creation/edit
suites subsequently passed 372 tests. Full integration checks follow this slice.

**Attachment metadata (2026-10-30):** Poll/report/claim factories now require `AttachmentFileName`
and their own allowed MIME types. Context-owned upload decoders retain filename normalization,
size caps and error order (claims check size before MIME; polls/reports check MIME before size).
Byte-aware factories still derive size from the actual content and check magic signatures. The
three upload use cases decode after their existing authorization/lifecycle checks. Six negative
contracts were observed failing before implementation; 68 attachment checks subsequently passed.

**Seal units and state (2026-10-30):** Parsed record order, attachment bytes, vote/participant/leaf
counts and exact decimal totals now retain distinct seal-context types. Private arithmetic and
serialized record DTOs remain primitives. Signer consent is a readonly union: declined consent
requires a null phone; willing legacy voters may still lack a phone. Existing canonical fixtures
and tampering checks passed unchanged. NFC preparation now returns validated JSON, not a generic
cast claiming to preserve literal/brand types after changing text or keys. Domain decoding follows
normalization. Canonical-byte validation and format guards no longer need unchecked type casts.

**Provider and persistence boundaries (2026-10-30):** Poll/organization queries now use Prisma
input types and inferred included-row projections instead of `any`; filtering and pagination stay
unchanged. Nominatim and DaData JSON is decoded before mapping used fields, with malformed responses
following the existing empty-result fallback. SMS.RU send/cost responses have explicit codecs for
recipient keys and status/code agreement. A successful send requires that recipient's outcome.
Prices and configured ruble ceilings retain separate types; missing/malformed prices are null,
and partial numeric strings or negative quotes cannot pass a configured ceiling. Numeric zero,
retry policy, uncapped unknown quotes and existing negative/invalid-environment cap behavior are
preserved. Provider format references: [send](https://sms.ru/api/send), [cost](https://sms.ru/api/cost).
Five address regressions, two missing/malformed send outcomes and three quote regressions were
observed failing before implementation; the regular suite also checks configuration type contracts.

**Notification/authentication contracts (2026-10-30):** Notification projections retain the
kind/payload union, recipient identity and validated count units. Raw persistence JSON is unknown
until decoded; saving validated payloads needs no Prisma JSON casts. Email delivery accepts
`EmailAddress`, retaining it through address-change notices and converting to strings only in
SMTP/stub adapters. The SMTP verification script was updated and typechecked, not run. CAPTCHA
verification receives a decoded token/IP record; malformed provider success values now fail closed.
Three malformed-outcome regressions were observed failing before the fix. Login, phone confirmation
and password-reset boundaries preserve existing enforcement, localization and rate-limit behavior.
Six ownership/asset authorization helpers retain typed identities; actor decoding stays at the
original authorization point. No authorization policy or public payload format changed.

**Generated credentials and poll projections (2026-10-30):** `GeneratedPassword` retains the
existing generator's minimum-length and letter/digit composition guarantee through the generation
port and reset result. Randomness/grouping remain the adapter's responsibility; entered login
passwords and hashes retain their existing rules. Open previews retain `OrganizationName`;
size-unit translation keys are a closed exhaustive map with unchanged strings. Consenting signer
contacts retain `PhoneNumber` until browser/PDF serialization. Result-name fields remain display
labels, including the existing missing-profile `Unknown` fallback.

**Results-action privacy correction (2026-10-30):** The boundary audit reproduced an existing
direct-call leak: `getPollResultsAction` returned raw application results, including voter details
and server-only viewer facts, while filtering happened only in the results page. A failing action
regression preceded the fix. The action now returns `PollResultsView`, with explicit nested mapping
and independent name/contact permission gates. The page and component share the plain DTO instead
of `any`. The component's displayed data, tally arithmetic and count-before-redaction behavior are
unchanged. Five action checks cover redaction, anonymous totals, named-member/admin views and
authentication/rate limits. This intentionally replaces the unsafe raw action payload; it does
not change domain access policy or expose aggregates to the browser.

**Voting-progress boundary (2026-10-30):** Progress reads now enforce the same poll-content
policy as detail reads before loading drafts/votes. Authenticated open-poll link readers retain
access; organization outsiders are rejected, while members and administrators retain read access
independently of casting eligibility. A direct-call authorization regression preceded the change.
The action returns an explicit nested plain view; allowed/denied voting decisions carry only known
localized reasons. Removing `any` also exposed an anonymous-notice bug: the page read a nonexistent
`poll.anonymous` property instead of `isAnonymous()`. Its regression was observed failing and fixed.

**Snapshots and poll query clients (2026-10-30):** Poll/question/answer serialization retains
validated identities, content, position units and closed poll/configuration kinds. Existing scalar,
Date and nested payloads are unchanged. Detail, board/user lists and search actions no longer return
`any`; list/card/editor consumers share the typed payload. Negative client contracts reproduced the
previously accepted swapped IDs, invalid positions and arbitrary poll kinds. Web action contracts
are checked by the full test-tree typecheck, separately from the domain compiler test; importing the
whole web dependency graph into that unit test had caused a five-second timeout under four workers.
Join-token snapshots and creation results similarly retain token syntax and distinct usage units.

**Poll form decoding (2026-10-30):** Multipart fields and JSON stay untrusted until validated;
file values are no longer asserted to be strings. Missing dates fail instead of becoming the Unix
epoch. Question creation no longer truncates fractional or partial numeric text with `parseInt`.
All question/answer position schemas decode supported numeric text into the existing domain units,
rejecting booleans, nulls, blanks and fractions with localized position codes. Eight direct-action
regressions and five schema regressions were observed failing before implementation. Malformed
property JSON and file-valued optional details now produce field-validation failures using existing
localized codes; missing dates use the existing invalid-dates code. Valid answer
trimming/order, optional details, zero sort order, dates and poll flags remain covered. The old test
that copied an obsolete indexed-answer parser now exercises the production JSON-form decoder.

**Participant/directory boundary audit (2026-10-30):** Participant and weight-history actions
retain their explicitly serialized DTOs, including distinct identities and weight units. The page
and history dialog consume those types; participant receipt credentials remain excluded. Organization
details now explicitly map boards, people, ancestors and every hierarchy level, retaining typed
identities and member counts without recursive `any`. Four organization client contracts and three
participant/history contracts reproduced the previous type erasure. Superadmin activity/user query
filters now use Prisma input types; query predicates and aggregation behavior are unchanged.

**Weight editor contracts (2026-10-30):** Editor props and previews retain the closed configuration
choices, poll state, poll/property identities and validated weight totals. Six negative client
contracts failed before implementation and now pass. The shared property picker preserves its
caller's identity type, including raw creation-form drafts. Distribution/aggregation selectors decode
control values using the existing domain parsers instead of asserting a union. The named-PDF route
also consumes the existing typed distribution directly. Presentation and server authorization remain
unchanged; browser type safety does not replace server validation.

**Join-token/configuration parsing (2026-10-30):** Join-token limit schemas retain `JoinTokenMaxUses`
with its existing localized failure code. Multipart limits use whole-value numeric decoding instead
of truncating `parseInt`; files cannot masquerade as token strings or usage limits. Nine action tests
cover malformed limits/files and valid integer/unlimited inputs; the invalid-input cases were observed
failing before implementation. One infrastructure decoder now supplies typed OTP minutes to email
rendering and all registration/login/confirmation/reset composition sites. Two malformed-configuration
regressions were observed failing; six factory checks preserve defaults and valid configured lifetimes.

**User retained-state audit (2026-10-30):** Four regressions exposed that raw phone/address objects,
raw nickname replacements and truthy string privacy flags could enter `User` despite its typed API.
The shared constructor now validates these fields for rehydration and immutable updates. Existing
valid profiles, absent address behavior and privacy defaults remain covered. All 3,893 unit tests and
the full production/test typecheck pass after this correction; lint/format cover 834 changed files.
The earlier 24 disposable PostgreSQL checks remain the persistence checkpoint, not a newly rerun suite.

**Audit evidence and next work:** Read retained state and decoders for poll lifecycle/period/config,
report publication/audience, ownership/claim/parent-request/invitation decisions, user email/profile,
OTP attempts/destinations, legal analysis and system limits. Explicit legacy cases remain supported:
finished polls without a timestamp, exhausted OTPs whose historical attempts exceed the limit, and
draft reports retaining a previous publication timestamp. Raw storage/request records, captured ballot
labels, detached Date getters and local arithmetic remain intentional representations. Current
production domain/application scans find no `as any`/`as unknown`, ambient clock/randomness calls or
broad `Result<..., string>` errors; scans are supporting evidence, not a complete invariant audit.

**Directory and value-object follow-up (2026-10-30):** Organization directory, join-link, report,
board and pending-invitation responses retain their existing domain types. Thirty-three negative
action client contracts were observed failing before implementation. Explicit serializers preserve
privacy filters and plain output; home leave dialogs model absence separately from a selected record.
Three runtime regressions reject array-valued phones, boxed nicknames and string-valued private-house
flags. Phone failures now use the existing localized domain code.

**Per-identity contracts (2026-10-30):** All 26 application IDs and ten seal IDs supply their own
regex. Their existing 1–256-character ASCII-token contracts remain byte-compatible with CUIDs, UUIDs
and supported opaque references. The shared factory imposes no format. Runtime tests exercise every
identity independently; compiler checks verify all pairs among 40 core identity types, including
cross-context names, AI model identities and house/flat FIAS references. SMS message identity has
separate adapter compiler/runtime checks. Eleven initial factory/AI regressions and five SMS
regressions were observed failing before implementation.

Provider formats stay separate: registry model keys and versioned model slugs follow the configured
AI registry; SMS message IDs use the numeric-pair form shown in the
[provider examples](https://sms.ru/docs/api/api_group_sms/send), without assuming component widths.
House/flat FIAS references use GUID syntax, following the address registry contract and
[DaData examples](https://dadata.ru/api/find-address/). Provider responses and address reconstruction
validate these IDs. Invalid submitted registry references return a localized domain failure; English
and Russian messages exist. Existing malformed records fail validation instead of being repaired.
Absent references, private-house removal of flat provenance, and suggestion fallback behavior remain
covered. No stored data or schema was changed.

**Credential ports (2026-10-30):** Hashing/verifying inputs use `PlaintextPassword`, distinct from
`PasswordHash`. Generated passwords retain their composition constraints and are valid plaintext
inputs. Ports, Argon2 adapters, use-case boundary decoding and the verification script retain this
distinction. Four negative port/adapter contracts failed before the change. Entered bytes, including
whitespace, remain exact; registration/reset policy and account-ownership check ordering are unchanged.

**User/admin response follow-up (2026-10-30):** Five further negative action contracts exposed
erasure of phone-search user identities, email retry seconds, reset OTP counts and generated
passwords. Response types now reuse their domain/application contracts; mappings, authorization
and payload bytes are unchanged. Full production/test TypeScript and scoped lint/format checks pass
after this type-only follow-up to the 4,008-test runtime checkpoint.

**Final audit:** Property/claim/parent-request and system-setting action projections are complete.
The completion audit classifies raw input, wire DTOs, display/text helpers, private value-object
representations and operational query DTOs. Framework process-global declarations retain their
platform casts; no production domain brands are manufactured through casts. The participant-removal/
history foreign-key issue remains a separate lifecycle/storage decision.

## Phase 5 — Final audit, verification and summary — COMPLETE

- [x] Audit remaining meaningful primitives, unchecked construction, unsafe casts and state alternatives.
- [x] Document intentional wire/text/boolean/count primitives and any concrete remaining limitations.
- [x] Run applicable full unit/database suites, production and contract typechecks, lint and formatting.
- [x] Record evidence and deviations in this plan and assessment; update the documentation index.
- [x] Summarize changes, verification, preserved behavior and unresolved limitations for the user.

## Final evidence and deviations — 2026-11-10

- All **4,267 unit tests / 456 files** pass (`VITEST_MAX_WORKERS=4 yarn test`). The final
  moderation map correction additionally passes all 52 affected admin-path tests; it preserves
  `UserId` keys instead of widening a checked core lookup to `string`.
- All **25 disposable PostgreSQL checks / 5 files** pass (`yarn test:poll-db` with the documented
  loopback test URL). The isolated container was stopped; application DBs were never used.
- `yarn typecheck` and `yarn tsc --noEmit -p tsconfig.json --pretty false` pass. The complete check
  includes action, component, port and adapter compiler contracts; the core identity matrix now
  includes the moderation audit ID, covering all pairs among 41 identity types.
- Migration-wide Prettier and ESLint pass over all changed TypeScript/TSX/MJS and Markdown files.
  `git diff HEAD --check` and `git diff --check` pass for current source. The original staged
  checkpoint is untouched and retains one Markdown hard-break warning in its old plan snapshot;
  that line is corrected in the archived/current file.
- All **309** code literals declared in domain `*Codes.ts` and application `*Errors.ts` have both
  English and Russian translations. No new untranslated UI strings or localization codes.
- Heavy checks ran sequentially under a 20 GiB memory / 2 GiB swap scope, with at most four test
  workers. No browser E2E, live provider calls, application migrations, data repair or commits.

[Completion audit](../../readmes/2026-11-10-domain-type-completion-audit.md) maps source/test evidence
and intentional primitives to the original requirements. Batches 16–19 finish the original phases;
no migration implementation batch remains. The plan and assessment retain historical checkpoints,
whose earlier unfinished-work statements are superseded by this final evidence.

Supported legacy state is explicit rather than silently repaired. Existing numeric rounding and
canonical/receipt byte fixtures remain unchanged. Notification delivery retains the existing
optional/awaited policies and does not imply rollback or an outbox. Unrelated legacy exception
contracts, the participant-removal/history FK lifecycle issue and poll-sealing Phase 3 remain
separate work. DB-to-seal snapshot assembly is not implemented by this migration; separate
organization/seal share codecs and the explicit receipt conversion retain their own constraints.

## Unresolved questions

None for this migration. Participant-removal/history retention and future seal snapshot zero-share
handling remain separate lifecycle/feature decisions; no storage policy is changed here.
