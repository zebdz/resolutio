# Domain type completion audit

Updated: 2026-11-10. Domain type migration complete; final evidence below.
Execution: [migration plan](../plans/archive/2026-10-26-domain-type-migration.md).

## Evidence and scope

The resumed worktree passed full production/test TypeScript and 4,245 unit tests across 453 files
before new audit corrections. An AST inventory covered annotated domain state, raw DTOs, ports,
factories and Date projections. Source inspection distinguishes validated retained state from raw
inputs and serialized records; finding a string in a domain file alone does not establish a defect.

The audit found a real reconstruction gap: a poll accepted questions from another poll and duplicate
question identities. A failing client regression precedes the fix. Reconstruction now checks class,
aggregate ownership and uniqueness, matching the existing answer/question boundary. Repository fixtures
must describe valid parent/child relationships. Valid polls keep their existing payload and lifecycle.

## Contract inventory

| Area                                   | Retained contracts and boundary evidence                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared identity/time                   | Per-entity regex-backed schemas, distinct brands, explicit `EntityCreation`/`Clock`, immutable `Instant`; identity compiler matrix and runtime schema tests.                                                                                                                           |
| User/auth/OTP                          | Phone/email/nickname/address objects; separate plaintext/hash/generated credentials; distinct session/OTP IDs, attempts/limits/counts/duration units; email and destination state alternatives. Raw DTOs decode before retention.                                                      |
| Organizations/boards                   | Organization/board/property/asset/ownership IDs; validated names/addresses/sizes/shares/counts; exclusive user/external ownership; detached lifecycle dates. Search text and formatted names remain text.                                                                              |
| Invitations/parent requests/join links | Kind-correlated board references, decision state and actor/time data; validated join tokens and separate usage units; raw nullable database columns are decoded.                                                                                                                       |
| Poll/ballot                            | Separate poll/question/answer/participant identities, page/order/weight units, revisions and lifecycle states; checked OPEN policy and nested ownership; ballot/receipt credentials stay distinct from public projections.                                                             |
| Reports/attachments                    | Publication/audience alternatives, typed references and attachment filename/MIME/byte limits; explicit viewer-authorized serialization and validated inline attachment ownership.                                                                                                      |
| Notifications                          | Event-kind/payload correlation, recipient/count/time contracts and checked restoration. All 30 producers, report publication, readers, recipient mutations and append writers return explicit Results; callers handle their delivery policy. Duplicate compatibility APIs are removed. |
| AI/settings                            | Registry model identities, closed risk alternatives, annotation/issue units and summary agreement; typed setting keys/value units and Result-based decoding/storage.                                                                                                                   |
| Seal context                           | Independent ID/digest/decimal/time schemas and canonical validation. `RecordFormat`, `ReceiptData` and `SealInput` expose explicit wire/decoding representations; they are not retained application aggregates. Existing receipt/seal byte fixtures remain acceptance evidence.        |

## Intentional primitives

- Raw persistence/request records (`PollData`, `BoardData`, `RawUserProps`, `RawOtpVerificationProps`,
  report/attachment/ownership/claim DTOs and their peers) accept unbranded values for validation.
  The retained model and operational ports keep validated types.
- Canonical JSON/receipt/sealed-record DTOs contain their wire values. Parsing validates IDs,
  digests, decimal text, timestamps, versions and relationships before accepting evidence.
- Detached Date getters and notification Date snapshots preserve existing transport contracts;
  mutable input/output references do not become internal state.
- Captured names, notification interpolation text, free audit text, formatted labels and fuzzy
  search filters retain their text meaning. Historical bytes must not be silently normalized.
- Independent yes/no facts and local arithmetic/counters remain primitive; closed lifecycle
  choices and meaningful units have explicit domain contracts.
- Direct operational telemetry/admin query DTOs retain wire-level scalars and historical display
  text where no domain aggregate/value is loaded. They do not establish domain validation guarantees.
  Paths invoking typed core ports decode their references first; moderation lookup maps retain
  `UserId` keys. Existing domain IDs/units are preserved in migrated application/browser views.

## Regression guard

[domain-type-audit.ts](../scripts/domain-type-audit.ts) resolves TypeScript aliases rather than
matching declaration text. The regular unit suite rejects unbranded identity/unit/state properties,
repository parameters, readonly collections and private constructor properties. Reviewed raw/wire
exceptions are explicit by source/declaration; notification Date projections have field-specific
exceptions. New exceptions require source review and boundary tests.

This guard supplements the existing compiler contracts and runtime constructor/state tests. It does
not prove that every branded value was validated, every lifecycle rule is correct or every exported
payload is authorized. Those obligations require the corresponding constructor, transition,
serializer, application and database tests in the completion checklist.

## Completion evidence

| Requirement                                    | Current evidence                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinct validated identities                  | `EntityIds.ts`, context-owned schemas and `Identifier.test.ts` / `SealIdentity.test.ts`; compiler matrix covers all pairs among 41 core identity types, including moderation audit IDs. Runtime tests cover each identity's own valid/invalid syntax.                                                                      |
| Valid creation, retained state and transitions | Per-context constructor/state/identity suites; poll foreign/duplicate-question regression, ownership alternatives, user profile/email/moderation and notification event correlation. Domain audit guard rejects unreviewed identity/unit/state primitives.                                                                 |
| Explicit creation inputs and domain isolation  | Factories consume `EntityCreation`, immutable instants and supplied facts. Source inspection finds no ambient time/randomness or framework/ORM imports in the core; repository interfaces remain ports, not I/O orchestration.                                                                                             |
| Checked requests, storage and type continuity  | Application/schema, adapter identity and action compiler suites; explicit serializers cover poll, ownership/claim, report, directory, invitation, settings, notification and analysis outputs. Source/test compiler verifies all callers.                                                                                  |
| Privacy and error behavior                     | Action/auth/layout tests retain server-side authorization and rate gates, result voter/contact redaction, recipient-scoped notification writes and localized failures. Notification batch construction cannot silently discard failed recipients.                                                                          |
| Decimal and historical evidence compatibility  | 25 disposable PostgreSQL tests cover actual size/share round trips, zero shares, atomic ballots, receipts/replay, revisions and history constraints. Canonical record/receipt fixtures, tampering checks and exact large-tally tests pass unchanged. Organization zero shares remain distinct from positive seal holdings. |
| Verification scope                             | 4,267 unit tests in 456 files; all 25 PostgreSQL tests in 5 files; production and complete source/test TypeScript; migration-wide lint/format; combined working-tree whitespace; 309 declared error codes present in both English and Russian. The plan records exact commands and final reconciliation.                   |

The final batches also remove five unused moderation compatibility methods from generic user
persistence; all active moderation paths use the checked append/read port. Notification writer
compatibility methods and throwing `Notification.reconstitute` are removed. Optional delivery
logs failures while retaining primary success; awaited delivery returns failures. A delivery failure
after primary persistence does not imply rollback or reliable outbox delivery.

## Remaining limitations and separate work

- The pre-existing participant-removal/history cascading foreign key needs an explicit lifecycle/
  retention decision. No storage policy, schema or application data was changed to hide that issue.
- Database-to-seal snapshot assembly and its zero-share policy belong to unstarted poll-sealing
  Phase 3. This migration verifies separate codecs and existing receipt conversion; it does not
  claim that the future sealing feature or adapter has shipped.
- Legacy throwing constructors/ports outside the migrated Result paths retain their established
  contracts. Global exception elimination, an outbox and stronger concurrency guarantees are
  separate changes. The new guards/tests do not prove every future business rule or security claim.
- Verification used local unit tests and disposable PostgreSQL. No application-database migrations,
  live provider requests, browser E2E run or commits. The original staged snapshot is preserved;
  its old plan entry has a Markdown hard-break whitespace warning corrected in the current files.
