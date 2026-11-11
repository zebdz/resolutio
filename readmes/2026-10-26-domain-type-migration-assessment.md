# Domain type migration — assessment

Date: 2026-10-26. Updated: 2026-11-10. Status: complete; no commits.

The domain type migration and its calling paths are complete. The user authorized review batches,
then continuation through all remaining batches on 2026-11-10. The
[archived migration plan](../plans/archive/2026-10-26-domain-type-migration.md) records all phases,
checkpoints and deviations. Poll-sealing Phase 3 remains unstarted under its
[separate feature plan](../plans/2026-09-15-poll-seal-and-anchor.md).

## Final completion — 2026-11-10

The [completion audit](2026-11-10-domain-type-completion-audit.md) maps the requirements to source,
compiler contracts, behavioral and database evidence. Batches 16–19 finish the retained-state
inventory, poll reconstruction membership, notification production/save Results and callers,
output type continuity, moderation compatibility removal and decimal/evidence verification.

Meaningful core identities, constrained values, units and alternatives retain validated types.
Raw decoding/wire records, historical/display text, private value-object storage, independent
booleans and local arithmetic remain intentional primitives. Direct operational query DTOs retain
wire values; they are not claims of domain validation. The compiler matrix covers 41 core identity
types, and the regular domain guard checks semantic state/port contracts with explicit DTO exceptions.

All 4,267 unit tests / 456 files and 25 disposable PostgreSQL checks / 5 files pass, together with
production and complete source/test TypeScript. Final migration-wide lint/format, whitespace and
English/Russian error-code evidence are recorded in the plan. The existing staged snapshot remains
untouched; current files fix its old plan's Markdown hard-break warning. No commits, application DB
migrations, live provider calls or browser E2E run.

Notification creation/restoration and append/read/recipient operations now expose explicit Results.
All producers/callers handle outcomes, and duplicate generic notification/moderation methods are
removed. Optional delivery retains best-effort logging; awaited delivery propagates failure after
primary persistence where that is the existing order. No rollback/outbox guarantee is introduced.

The pre-existing participant-removal/history cascading foreign key remains a separate lifecycle/
retention decision. Organization zero shares and positive sealed holding shares remain distinct;
future DB-to-seal snapshot assembly belongs to sealing Phase 3. Legacy exception contracts outside
the migrated paths, new reliability guarantees and further UX behavior are separately scoped.

The checkpoint sections below are historical; their stated unfinished work is superseded by the
completion audit and final plan evidence.

## Prior reviewed checkpoint — 2026-11-04

Batch 15 completes explicit notification recipient mutation results across 14 source/test files.
A dedicated port keeps notification/user identities and immutable timestamps distinct and returns
Results for loading, marking read and deletion. The Prisma adapter restores checked domain state,
rejects malformed selections and filters writes by the authorized recipient. Use cases propagate
load/write failures while preserving ownership checks and first-read idempotence; actions translate
failures after their existing authentication/rate gates. Generic query/mutation methods are deprecated.

All 215 focused tests and full production/test TypeScript pass, including five new negative mutation
contracts; scoped lint/format checks pass. No full unit/database rerun, browser smoke test, migrations,
commits or live DB/provider calls. Legacy creation validation still uses parse/catch, and deprecated
`Notification.reconstitute` remains throwing. Producer/save failures and client mutation/load error
presentation remain later work. Generic query/mutation implementations and test fakes remain for
compatibility, without active production callers of those methods. Adapter tests mock persistence;
live database concurrency/transaction behavior was not verified. The broader primitive/retained-state
audit and participant-removal history storage decision remain unfinished. Batch 12 moderation
compatibility methods remain deprecated with no active consumers.
Work stops for review here. The migration plan records the completed scope and remaining batches.

## Scope and baseline

This audit counted files before the current type correction added new modules. Production
counts include `.ts` files, excluding `__tests__` directories and `*.test.ts` files.

| Measure                              | Baseline | Meaning                                                                                                          |
| ------------------------------------ | -------: | ---------------------------------------------------------------------------------------------------------------- |
| Domain production files              |      112 | Across 12 top-level folders, including `shared`; folders are not necessarily bounded contexts.                   |
| Domain test files                    |       57 | Files named `*.test.ts`.                                                                                         |
| Files with raw string ID annotations |       61 | 416 field/parameter annotations named `id` or ending in `Id`/`Ids`, including arrays; not 416 distinct concepts. |
| Files constructing `id: ''`          |       22 | 23 occurrences; persisted identity is commonly assigned later.                                                   |
| Application production files         |      223 | Surrounding scope, not a claim that every file needs changes.                                                    |
| Infrastructure production files      |       77 | Surrounding scope, not a claim that every file needs changes.                                                    |

The ID inventory matches declarations such as `userId: string` and `propertyIds: string[]`;
it excludes getter return types and IDs hidden in generic collections. These counts establish
that this is a change across layers, not a reliable estimate of the final diff or duration.

Existing foundations include `PhoneNumber`, `EmailAddress`, `Nickname`, `Address`, `OtpCode`,
`PollWeightConfig`, closed status/type unions, and the seal context's validated value types.
Keep ordinary text, independent yes/no facts and local algorithm counters primitive when no
domain constraint or distinct meaning warrants a type. The objective is enforceable meaning
and valid states, not eliminating every `string`, `number` or `boolean`.

## Migration considerations

1. **Identity and creation.** Application `IdGenerator` and `Clock` supply validated IDs and time
   through `EntityCreation` before domain factories run; empty-ID entities are eliminated.
   New UUID tokens fit current storage constraints; existing IDs remain untouched and both formats
   are supported without a schema migration. Each identity supplies its own regex to the shared
   factory; matching representations do not make brands interchangeable. Provider/registry IDs
   use their own formats. Factories in [User](../src/domain/user/User.ts),
   [Organization](../src/domain/organization/Organization.ts) and
   [Question](../src/domain/poll/Question.ts) were examples of the baseline sentinel pattern;
   consult the plan for completed slices rather than treating baseline findings as current state.
2. **Poll model and callers.** Migrate IDs, page/order integers, weight configuration and time
   values through factories, transitions, repositories, commands and serialization. Enforce
   rehydration constraints too. Entity references may share an identity-only contract with distinct
   entity brands; domain entities stay context-private. Seal-format IDs stay separate with explicit
   conversion; separate modules alone do not distinguish identical Zod brand tags.
3. **Ownership quantities and calculations.** Distinguish voting weight, ownership share,
   asset size and units. [WeightDistribution](../src/domain/poll/WeightDistribution.ts) currently
   calculates with JavaScript numbers; repository adapters convert Prisma decimals to numbers.
   The [schema](../prisma/schema.prisma) stores weights/sizes as `Decimal(15,6)` and shares as
   `Decimal(9,8)`. Preserve current decimal/rounding behavior during this migration; changes to
   arithmetic rules need a separate, evidenced decision. Organization ownership supports share
   zero; seal holding rows require positive shares. Keep this conversion explicit.
4. **Lifecycle alternatives.** Model required data with each state. Examples include
   [ownership](../src/domain/organization/PropertyAssetOwnership.ts) as a user or external owner,
   [claim decisions](../src/domain/organization/PropertyClaim.ts), and board-specific
   [invitations](../src/domain/invitation/Invitation.ts). Independent nullable fields currently
   allow combinations that the domain does not intend.
5. **Remaining contexts and boundaries.** Migrate user/auth/OTP, organizations/boards, reports,
   invitations, notifications and AI in reviewable slices. Validate external/database data at
   boundaries; retain plain serialized DTOs. Move time/randomness into explicit inputs where
   constructor changes require it. Avoid casts that merely silence the new type contracts.
6. **Verify each slice.** Use failing constructor/invariant tests, compile-time swapped-ID tests,
   transition tests and database/JSON round trips. Preserve decimal and receipt output.
   [tsconfig.build.json](../tsconfig.build.json) excludes tests, so compile-time contract tests
   need an explicit check. Complete checks and record evidence for each review batch, then stop
   for user review before beginning another batch.

## Risks and decisions

At the initial audit, validation was uneven: ownership shares admitted `NaN`, asset sizes admitted
`Infinity`, and question page/order checks did not require finite integers. Many reconstitution
factories accepted unchecked props and exposed mutable `Date` references. These cases now have
validated values and regression coverage. The remaining port/state audit must still establish
coverage across contexts; brands alone do not prove runtime invariants.

Reject nonfinite and newly invalid inputs. Audit legacy compatibility before strengthening
read-time validation; represent supported old states explicitly and surface unexpected invalid
records as failures. Do not silently coerce evidence into new values or repair persisted records.
Existing persisted ballots, receipts and seal bytes must remain unchanged. In particular,
calculation changes must not retroactively rewrite historical voting weights.

Brands and value objects do not automatically require schema migrations: existing strings and
decimals can remain the storage representation. Data repairs, changed precision or new database
constraints require concrete justification and separate changes after an audit. No schema or
data changes are implied by adding brands; no such changes have been approved in this assessment.

## Historical verification checkpoint — 2026-10-30

This predates the interrupted property/claim response work. It is not evidence that the current
working tree passes the full typecheck; see the latest review batch in the migration plan.

All 4,008 unit tests and the complete production/test TypeScript tree pass. The latest persistence
checkpoint has 24 passing disposable PostgreSQL checks; it precedes the subsequent read/form,
configuration, provider and retained-user-state slices. No schema or SQL changed in these slices.
All 851 changed source/test files pass lint and formatting. English/Russian domain error codes have
matching localization entries. The missing participant-not-found application translations were
added in English/Russian and are covered by a regular poll-error localization test. No commits or
application-database migrations were performed.

Integration corrected PDF translation text that had been typed as a question kind, and distinguished
canonical domain phone numbers from [SMS.RU's digits-only transport keys](https://sms.ru/docs/api/api_group_sms/send).
Existing provider tests now start with validated domain phone values and verify the conversion.

Search/collection counts and core timestamp projections now use distinct validated values.
Question/answer page/order arguments and vote/participant/history weight arguments retain their
units through factories and transitions; negative compile contracts are part of the regular unit
suite. Serialized timestamp strings and voting/receipt persistence behavior remain covered.

Building totals now have a distinct aggregate unit and explicit absence for EQUAL polls.
Poll read models retain IDs, question/content/ownership types, counts, aggregate weights and
percentages. The arithmetic and serialized scalar values remain unchanged. Signing-consent
variants prevent a declined consent from carrying a phone number.

OTP transports now correlate channel and recipient types; email also rejects malformed runtime
destinations before sending. Attachment creation requires validated byte counts. Application
`Result` contracts preserve known error codes across poll, report, organization and invitation
operations; cross-context errors stay explicit. Report/organization query totals retain their
validated units rather than erasing them in the application layer.

Seven organization read use cases now depend on a typed directory port; a Prisma adapter decodes
profile values, identities, counts and timestamps. Explicit browser mappings preserve prior
payloads, authorization and visibility. Both application `prisma: any` dependencies are removed.
Poll weight configuration mutations now require distinct mode types and property identities;
a shared pure decoder preserves OPEN-poll policy and error precedence.

The subsequent membership slice removes all remaining direct Prisma application dependencies.
Typed membership transitions carry required actors/times and explicit optional reasons; renewal
clears rejection metadata while invitation acceptance preserves it. Both invitation upsert branches
use the injected clock, fixing an ambient-time regression. Persistence transaction boundaries are
unchanged. Hierarchy I/O moved into application orchestration with pure domain selection rules.
User-organization reads retain typed names/profile values and immutable times, preserving the
previous display omission for incomplete legacy decisions and the existing browser payloads.

Invitation detail/inbox reads retain identities, target variants and immutable time, with explicit
nulls for missing related names. Browser serializers preserve existing Date/label payloads. Board
creation now requires `BoardName`; decoding retains existing errors and normalization, and the
application output retains core types instead of erasing them through a storage DTO.

Question/answer creation and editing now require distinct validated content values, including the
poll aggregate's answer-creation method. Request decoding retains normalization, pre-trim length
limits, optional details and localized errors. Profanity policy remains in the domain. Shared domain
answer-target validation preserves lifecycle-error precedence before content decoding.

Poll/report creation and editing now retain their distinct title/body/description values too.
Shared domain decoding preserves normalization, Markdown bytes, profanity codes and lifecycle
precedence. Poll finishing requires `PollInstant`, with the application translating its clock
directly into the cutoff type; malformed input cannot change state or emit an event.

User email now uses immutable absent/unconfirmed/confirmed alternatives. Confirmation without an
address fails explicitly; rehydration rejects orphan confirmation timestamps rather than clearing
history. Valid stored and browser fields remain compatible. Poll creation requires a closed kind
and a nominal immutable period; date edits receive the whole validated period. Request decoding
preserves error precedence and Date-based storage/browser formats.

Attachment factories now require validated filenames and context-specific MIME types. Upload
decoders preserve existing size/signature checks, normalization, authorization and failure order.
Parsed seal records retain distinct order, byte/count and decimal-total units. Readonly signer
variants encode the existing no-phone-without-consent rule while allowing historical willing voters
without a phone. Canonical fixture bytes remain unchanged. NFC normalization returns JSON for
subsequent domain decoding rather than falsely claiming to preserve the input's branded/literal type.

Poll/organization Prisma queries now retain generated query/row types. Address providers decode
response fields before mapping. SMS.RU codecs validate recipient outcomes, status codes and ruble
quotes; malformed or negative quotes cannot pass a configured cap, and unknown quotes are explicit
nulls. Existing zero-cost, retry and uncapped-quote behavior remains covered. Notification snapshots
retain their validated content union and counts; raw JSON read/write casts are removed.

General email delivery retains `EmailAddress` through application orchestration and serializes it
inside adapters. CAPTCHA token/IP inputs are decoded at login, confirmation and reset boundaries;
the provider response must contain a boolean success flag. Regression tests reproduced the previous
truthy malformed-response acceptance. Authentication enforcement, rate limits and localized responses
remain unchanged for valid requests. Six ownership/asset authorization helpers now retain typed
identities without changing authorization order. The SMTP smoke script was typechecked only; no
live mail or SMS was sent.

Generated reset credentials now retain their validated type through the generation port and reset
result. Existing randomness, grouping and login password rules stay unchanged. Open-poll previews
retain organization-name types; named-protocol size-unit keys form a closed vocabulary. Signer
contacts retain `PhoneNumber` until the browser/PDF boundary.

The poll-results action previously returned unfiltered application data and relied on its page to
remove private voter fields. A direct-call regression reproduced the leak. It now returns only a
typed plain view, with separate voter-name and admin-contact gates; aggregate instances and viewer
facts never enter that output. The displayed component payload and tally/count arithmetic remain
unchanged. This is an intentional security correction to the previous raw action payload.

Intentional primitives reviewed in these slices:

| Boundary or operation                                            | Reason for retaining primitives                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Raw*`/`*Data` persistence inputs and request DTOs               | Untrusted fields are decoded before entering retained domain state.                                               |
| Seal `SealInput`, `SealedRecord`, `ReceiptData`, canonical bytes | Explicit snapshot/wire codecs preserve v1 field names, decimal strings and committed bytes.                       |
| Captured seal names, descriptions and phone labels               | Historical evidence text is preserved; current profile constraints must not rewrite evidence.                     |
| Defensive Date getters                                           | Construct fresh Dates from validated immutable instants; existing storage/browser payloads stay compatible.       |
| Hash/canonical text utilities, formatting and profanity input    | Operate on arbitrary text or serialization, with no stronger domain constraint.                                   |
| Private indices/arithmetic and independent booleans              | Algorithm-local quantities or independent facts; constrained public results carry their units.                    |
| `hasLegalRelevantChanges` editor snapshots                       | Compares incomplete unsaved text and temporary question/answer IDs; these are editor drafts, not domain entities. |
| Rendered email bodies and subjects; provider logging DTOs        | Presentation/wire text; validated recipient, status and monetary types remain inside the delivery flow.           |
| Results/protocol name fields with the `Unknown` fallback         | Display labels for an optionally missing profile, not values accepted by profile creation or editing.             |

Voting progress now enforces poll-content authorization before reading drafts or votes and returns
an explicitly mapped plain view. Organization outsiders are denied; members/admins and authenticated
open-poll link readers retain access independently of casting eligibility. Allowed/denied voting
reasons are closed alternatives. Removing `any` exposed and fixed the anonymous-poll notice's use of
a nonexistent aggregate property; it now calls `isAnonymous()` before serialization.

Poll/question/answer snapshots retain validated values through detail/search/list actions and UI
consumers, preserving the prior wire fields and detached Dates. Join-token creation likewise retains
its identity, constrained token and usage types. Web compile contracts run with the full source/test
typecheck; domain unit compiler tests no longer pull in the entire action dependency graph.

Poll form fields and JSON are decoded without unchecked assertions. Missing dates are rejected;
page/order inputs cannot silently truncate fractions or partial numeric text. Shared request schemas
retain validated position units and reject boolean/null/blank quantities with localized codes.
Malformed property JSON and file-valued optional details receive field-validation errors. Valid
answer trimming/order and poll payloads remain compatible. Obsolete copied-parser tests now exercise
the actual production decoder. These are intentional corrections to invalid-input acceptance.

Participant/history actions and organization details now retain typed plain DTOs through their
clients, including recursively typed hierarchy children. The weight editor retains supported choices,
validated identities and preview units; selection controls use the existing domain decoders. Superadmin
query filters use Prisma contracts without changing predicates. Negative action/component contracts
were observed failing before these changes; participant receipt credentials remain excluded.

Join-token forms no longer truncate partial/fractional usage limits or accept uploaded token fields.
Valid integer and unlimited cases retain their existing semantics and localized validation failures.
OTP composition uses one typed environment decoder; malformed lifetimes fail instead of becoming a
different integer. Email rendering preserves configured minutes and the ten-minute default.

The retained-state audit found and fixed a runtime gap in `User`: raw phone/address objects, raw
nickname replacements and string privacy flags could bypass its nominal input types. The common
constructor now validates these values for both rehydration and immutable updates. Four regressions
were observed failing first; existing valid behavior passes the full suite. The earlier PostgreSQL
checkpoint was not rerun for these boundary/domain-only slices.

Organization directory, join-link, report, board and pending-invitation responses now retain typed
IDs, constrained values and count units. Explicit serializers preserve existing privacy filters.
Home leave dialogs carry either no selection or a valid selected record. Older `PhoneNumber`,
`Nickname` and `Address` constructors now reject coerced object values and string boolean flags;
phone failures use the existing localized code.

Every string identity schema now owns its regex. Application/seal token acceptance and serialized
bytes are unchanged. Forty core identities have pairwise compiler checks and per-type runtime
acceptance/rejection coverage; SMS message IDs have separate transport checks. AI registry keys and
provider slugs, SMS numeric-pair references, and house/flat FIAS GUIDs keep their own formats.
FIAS validation reaches provider responses and address reconstruction. Invalid submitted references
return a localized domain code; malformed stored references fail validation without data repair.
Provider syntax follows the configured AI registry and the
[SMS.RU](https://sms.ru/docs/api/api_group_sms/send) and [DaData](https://dadata.ru/api/find-address/)
examples; it does not establish that a syntactically valid reference actually exists.

Hashing and verification ports now distinguish exact plaintext credentials from stored hashes.
Generated passwords remain a constrained subtype of plaintext. Login does not inherit signup/reset
strength rules, and no trimming or normalization changes password bytes. Boundary decoding preserves
the existing account-ownership check order; the full check includes the verification script without
executing that script against an application database.

Phone-search results, email retry intervals and administrator OTP/password resets also preserve
their domain identity/unit/credential types. Five negative action contracts failed before the fix;
the final source/test typecheck includes this type-only follow-up to the runtime checkpoint.

Property/claim/parent-request and system-setting projections and the final persisted-state/adapter
audit are complete. Explicit supported legacy states include finished polls without timestamps,
historical exhausted OTP attempts, and draft reports with previous publication timestamps; these
were not silently repaired. The archived plan records the separately scoped participant-removal/
history foreign-key issue; this migration has not changed its storage.

## Unresolved questions

None for this migration. The history-retention/storage decision belongs to separate lifecycle work.
