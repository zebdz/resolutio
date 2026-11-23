# Import ТСН "КП Березка" from decision.community

All four phases rehearsed locally on 2026-11-22. Import scope and governance mappings approved. Production account identities will be resolved by the target dry run. The deliverable is a standalone production Yarn command with dry-run, apply and verify modes. The operator reviews the completed implementation and rehearsal once, then runs the production import.

## Verified source

MySQL 5.7 dump `u1037625_decision_community.sql` contains six companies. Company 1 matches both `berezka` and the requested title. Its 162 distinct membership links resolve to 162 users. One also belongs to another company. Every Berezka question agrees with its parent poll's company. All scoped votes resolve to a member, question and matching answer. Each voter selected at most one answer per question. The dump has no anonymous votes.

| Legacy parent type  | Parents | Questions | Public questions |   Answers |     Votes | Question files |
| ------------------- | ------: | --------: | ---------------: | --------: | --------: | -------------: |
| Members' meetings   |      14 |       145 |               46 |       442 |     5,541 |            337 |
| Governance meetings |      12 |        20 |                9 |        60 |        60 |              2 |
| Work reports        |      13 |       329 |               54 |     1,645 |       587 |            802 |
| Suggestions         |       2 |         2 |                0 |         6 |         2 |              0 |
| Information posts   |      10 |        10 |                8 |         0 |         0 |             13 |
| **Total**           |  **51** |   **506** |          **117** | **2,153** | **6,190** |      **1,154** |

The PHP public listing filters the question's public flag across all types. Question 588 is “Плов 14 июня”, item 39 in work-report collection 97. It has seven attachments and zero ratings. Collection 97 has no voting start or finish date despite having 13 public entries.

## File reconciliation

Read every non-directory ZIP entry and compared SHA-256 by path. Archive 18_10_38 has 1,296 files. Archive 18_12_15 has 1,294. Exactly 1,293 paths match byte-for-byte. The first has two additional database-referenced files, `storage/58/BlankNewWithAnswers.docx` and `storage/67/BlankNewWithAnswers.docx`. Neither is in the second. Both have `storage/67/ProtocolNew.docx` but their Word document bodies differ. Retain both versions with their source hashes. Use the uploaded PDF as the original protocol.

All 1,204 distinct relational file references resolve in the first archive, totaling 591,404,895 bytes. They comprise 1,154 captioned question files, 24 protocol files with PDF headers, 16 protocol DOCX files, two blank forms and eight forms with answers. The 24 original PDFs agree across archives. Meetings 69 and 85 have no uploaded protocol reference. Another 21 files under scoped poll directories lack a relational reference. Preserve their paths and hashes for review before assigning a public destination. The rich text also contains embedded images and links.

| Input        | SHA-256                                                            |
| ------------ | ------------------------------------------------------------------ |
| SQL          | `0682c7dba8a8eb30243ae10a7cd97e677a54a7d254d2ecc6e97b4b253bf60c39` |
| ZIP 18_10_38 | `9389c6a781a7ac85c2d7e55e3bc41608a35694b262c95c6611566983fb874b30` |
| ZIP 18_12_15 | `285d7cadd406fd5dd5e3df3ccac20241904826ad51b34d4bb8845663d8667566` |

## Import mapping

**Accounts and access.** Create 162 accepted memberships. Confirm the 161 users with ordinary phone numbers. Keep user 117 unconfirmed. Record the import time and the operator's legacy phone-confirmation attestation. Enable phone, name and address discovery and mark privacy setup complete. Email directory search is outside the requested scope. Preserve the 76 populated emails as unconfirmed. There are zero source email verifications. Preserve source account creation times, generate unique valid nicknames and use Russian as the initial language. Historical membership and consent timestamps are unavailable. Record unknown values explicitly. Check for an existing Berezka organization during dry run. Distinguish a prior run of this import from an unrelated name collision.

**Existing accounts.** Write and test matching with synthetic local accounts. The operator runs the read-only preflight against the destination database. Check every legacy user, including the creator, before creating accounts or assigning roles. On reruns, validate the persisted legacy-to-Resolutio ID mapping first. Otherwise compare canonical phones and normalized full names (including patronymic where available), and check populated emails for collisions. Reuse a unique existing account when its confirmed phone and full name agree and other identifiers do not conflict. A matching name alone, an unconfirmed phone, an email-only match, conflicting identifiers, or two source users claiming the same target require review. User 117’s placeholder is never proof of identity. Generate available nicknames for new accounts. Classify every source user as reuse, create, or review. Print aggregate counts and keep per-user findings in a private local file. Require explicit ID resolutions for ambiguous cases. Preserve credentials and privacy choices on reused accounts. Recheck matches transactionally at apply time and stop on drift. Use the same resolved ID for membership, creator/admin/board roles, authorship and votes.

All 162 stored hashes use Laravel bcrypt ($2y$). Resolutio currently verifies Argon2 and its self-service reset requires confirmed email. Implement scoped bcrypt verification for newly created legacy accounts and an atomic Argon2 upgrade after successful login. Rehearse with a synthetic Laravel hash. The existing superadmin-assisted reset is an alternative for individual accounts.

161 phone numbers are unique ten-digit numbers starting with 9. One, on user 117 with 12 votes, is an ascending-digit placeholder. Keep the placeholder phone and all 12 votes on user 117. Preserve the source digits and leave confirmedAt null. Seven names include another name in parentheses (85, 94, 95, 96, 126, 127, 130). Preserve the exact legacy display name for historical votes. Proposed profile rule uses the name before parentheses for login-profile fields and keeps the parenthetical text with the source record. Preserve each supplied address line verbatim, including house numbers where present. The operator subsequently confirmed Россия, Ростов-на-Дону for all users. The structured Address requires country, city, street and building. Add support for a partial imported address in profile display and privacy-aware street search. Test a street-only entry through both paths. Keep the 69 additional profile records (68 ownership descriptions, one job) scoped to their intended audience.

**Membership and governance.** The source has 155 voters, three governance members and three admins (IDs 1, 155 and 283). Create a new Berezka organization. Assign the three approved organization admins. Assign Третьяков Сергей Владимирович (legacy user 1) as creator using his resolved destination account. Create the Berezka board with legacy users 5, 221 and 255. Preserve the seven nonvoters' eligibility distinction. Legacy global admin rights grant no platform privileges in the import. Scope the 161 right assignments through Berezka users. Each is an ownership right of effective weight one and every actual voter has one. Preserve ownership grounds and source identities. Retain the six positions, two linked entities, their links, 20 directory items, 138 quorum rows, 14 organizers and invitation/officer references in the crosswalk. Use a restricted historical record for fields lacking a native equivalent. Family/school tables contain 61 parent records and 76 child records with no company foreign key. Public question 283, “Попытка решения школьного вопроса”, links two forms: applications for a school bus to Leninavan and coordination of parent-organized school transport. Submissions include contact, child and school details. The tables link child rows to parent rows but have no account or company ID. Import the public post as a report. Exclude the individual school-transport submissions from the scoped package and the import.

**Polls and results.** Preserve all 26 meetings with question order, answer order, casting identities, attachments and original protocol downloads. Keep the two suggestions and their votes as historical proposals. Preserve original question authors, raw source and organizer details. Derive per-answer counts, percentages, weighted totals, distinct participants, stored potential-voter denominator and report scores independently using the PHP rules. Its weight calculation reads current rights, so identify those totals as reproduced from this snapshot. Keep imported results distinct from original PDFs. Resolve any difference against original protocols by reporting it, never adjusting ballots to force agreement.

Eleven finished meetings lack a start, 590 votes have neither creation nor update time, and all membership link timestamps are null. Retain original null dates in source evidence. Under the revised mapping, display the persisted import-run time for missing finishes and undated votes, labeled as such. Missing starts stay unknown. MySQL TIMESTAMPs were exported in UTC. The PHP poll controller writes start/finish DATETIMEs in Europe/Moscow. Poll 85 has a start, 324 votes and no finish. Import it read-only with its 324 votes and a finish supplied by the import. Reject further voting. Historical records need explicit provenance in voting, results, exports, automatic finish and seal recovery. Preserve the source denominator separately from current membership. Do not create historical receipts, signer consent, inferred eligibility rosters or native seals for these ballots.

**Reports and visibility.** Import 394 report entries covering all 329 work items, ten information posts and 55 public meeting questions. The last group keeps its original voting question and links to one report projection. Keep the 13 work-report collections and chronological order navigable. Public flags grant anonymous access to the corresponding content and attachments. Limit other work items and information posts to the original eligible audience and preserve any unpublished state established by the source. Link privately to canonical voting records where authorized. Preserve all five rating choices for all 329 work items, individual ratings, counts and the original rounded score. A public report must not expose sibling questions, private voter identities or the parent poll's restricted documents.

488 questions contain Draft.js JSON and 18 contain other text. Convert blocks, lists, formatting, external links and media into supported report/poll content. Extract the 30 inline data images, rewrite legacy question/result/file links using the crosswalk, and list external embeds and unresolved link targets. Treat archived text as untrusted. Keep original text and each of the 1,154 captions with its question. The current attachment models lack question ownership, and normal uploads have type, count and size restrictions. Three MP4s, one MP3, a JPEG above 5 MiB, Office files and meetings exceeding the 20-file limit require a read-only historical attachment path with per-parent access checks. Provide original PDF download from the meeting results screen.

## Delivery phases and final review

- [x] **Discovery.** Verify scope, classify the records, compare archive payloads and identify target gaps. The inventory above records the findings.
- [x] **1. Read-only preflight.** Implement deterministic offline extraction and source-ID crosswalk, fixture-first via TDD. Prepare a scoped package on a trusted machine. Ship only that package to production. Emit counts, relationship checks, per-file SHA-256, role/address/profile exceptions, source/destination collisions and a private override file keyed by legacy ID. A dry run makes zero database writes. Verify the manifest and mappings against the source inventory.
- [x] **2. Historical data support.** Implement only the agreed gaps for historical polls, nullable evidence, reports, scoped assets, result denominators, legacy login and directory access. Test public, member, board and admin views, unknown dates, downloaded PDF equality and exclusion from native poll jobs.
- [x] **3. Import command.** Ship the standalone seeder and operator runbook. Pin package and mapping digests, lock per organization, transact each import unit and record durable source keys and checkpoints. Resume safely after interruption and reject source drift. Stage data until fully verified, then make it visible. Suppress historical notifications, invitations and background voting workflows. Run and verify a local rehearsal.
- [x] **4. Production rehearsal and handoff.** Rehearse with representative existing accounts and the full package on a production-like copy. Compare all source totals by question, file bytes, attendance, scores and access. Test account login, interrupted resume, zero-change second run and recovery from backup. Deliver exact dry-run/apply/verify commands, backup/restore steps and expected outputs. If the legacy site still accepts changes, freeze writes and repeat preflight on a final dump before cutover. Operator runs production apply.

For this import, mark each completed phase in this plan, record its verification evidence and proceed directly to the next phase. Submit the implementation, rehearsal evidence, exceptions and runbook together for one user review after phase 4.

## Rehearsal evidence

1. Trusted-machine extraction verified the three input hashes and produced manifest SHA-256
   `c912d6821350259d9b51cf28595c18e8c9e457982e2759b95ea1fee91aba38e4`. The extractor and matching tests passed.
   PostgreSQL 17 with all application migrations classified 162 creates on an empty destination.
   With a confirmed creator and a name-only board candidate, the read-only transaction classified 160 creates,
   one reuse and one review, then exited nonzero. Each run verified 1,256 attachment records, including inline and restricted files.
   The restricted organizer record for missing source poll 66 has no destination meeting.

2. Historical records use a separate PostgreSQL schema and read-only application routes. The transactional
   SQL fixture checked staging invisibility, anonymous public-question access, denial of sibling and board documents,
   board/admin download access, unknown dates and isolation from native polls. Nine credential tests passed,
   including a synthetic PHP bcrypt hash and compare-and-swap upgrade. Eight address repository tests passed
   including the imported street-only profile and opted-out directory projection. Application typecheck passed.
   Full-data HTTP, original-file and recovery results appear in phase 4.

3. The operator command resumed after SIGTERM with 20 blobs durably staged, two original destination accounts,
   zero new organizations and zero published records. It verified all 10,962 scoped records, 2,153 answer tallies,
   attendance for 51 parents, 329 scores and 1,256 asset hashes before commit. A second apply verified the same
   data and returned `changed: 0`. See the [operator runbook](../../readmes/Berezka-Import.md).

4. Restored the pre-import backup to a fresh PostgreSQL 17 database, applied the release migration and
   repeated the complete cutover with the original confirmed creator and an unrelated name-only board
   candidate. Explicitly resolving the latter to create yielded 161 creates, one reuse and zero reviews.
   A stale mapping digest was rejected. Final preflight recognized all 162 persisted identities.
   The reused creator retained the fixture credential and privacy choices. Their previously empty
   email was filled from the source. All 76 populated emails were unconfirmed, 161 phones were
   confirmed, and the placeholder retained its 12 votes. All 162 memberships were accepted, with
   155 eligible for future native poll snapshots, three organization admins and three board members.

   Verification compared every one of the 506 questions, 2,153 answers, 6,190 votes, 51 attendance
   totals, 329 scores and 394 report projections. All 1,256 attachment records matched their
   expected bytes and ownership across 1,232 distinct blobs. PostgreSQL user-table counters before
   and after the second apply and verification were identical (14,513 inserts, 4 updates, 0 deletes).
   A real browser logged in with a synthetic PHP bcrypt credential, opened the account page with
   a street-only address and verified the stored credential upgraded to Argon2id.

   The production Next.js build ran against a restricted local web login. HTTP checks covered
   anonymous, original member, board and admin sessions. All 24 original PDFs downloaded with
   matching SHA-256 as admin and returned 404 anonymously. The board meeting showed its original
   download. Public report 588, its attachment, private collection 97 items, the restricted
   profile page, the member archive listing and the authorized 324-vote JSON export passed.
   Supplemental profile queries returned 69 records to an admin, one to a record owner and zero
   to an outsider. The runtime role lacked SELECT on the raw source table. The restored database
   began with two users and zero organizations. After import, native polls, seals, notifications
   and invitations all remained at zero.

   The full suite passed 4,482 unit tests and 63 PostgreSQL tests. Two opt-in live OpenTimestamps
   checks were skipped. Four extractor/protocol tests passed. Type checking and the optimized
   production build passed. All 92 build dependency traces excluded the private inputs.
   Production account resolution and execution remain with the operator.

### Exceptions retained for review

- All 24 original protocol PDFs matched the source hashes. Meetings 69 and 85 have no original PDF.
  Poll 85 retains 324 votes; the original source omits its finish and both timestamps on 590 votes. The revised display and export rules below supply the import time.
- Twelve PDFs had extractable tables. Of 171 aligned answer rows, 20 differed in counts or percentages.
  The six count discrepancies are listed below. Meeting 70 differed on percentages only.
  Meetings 4–15 have image-only originals. Their printed results remain open for human reconciliation.
  The ballot totals and the PDFs are both preserved. The [comparison script](../../scripts/berezka/protocols.py)
  emits the per-answer percentage and count differences.

  | Meeting | Question | Answer | Printed count | Snapshot count |
  | ------: | -------: | -----: | ------------: | -------------: |
  |      27 |      207 |    687 |             6 |              7 |
  |      44 |      280 |   1016 |            61 |             64 |
  |      44 |      280 |   1018 |             4 |              5 |
  |      58 |      297 |   1047 |            11 |             12 |
  |      73 |      410 |   1571 |            15 |             16 |
  |      73 |      410 |   1574 |             8 |              9 |

- The alternate poll 67 DOCX and 21 unassigned file paths are restricted. Five unresolved link
  occurrences across two questions remain in the conversion findings. Another 51 occurrences
  across 21 questions refer to external media. Playback depends on the original hosts.
- The restricted crosswalk retains one missing poll reference (66) and three out-of-scope officer references.
  Historical weights reproduce the source snapshot. Dates, consent and roster history absent from
  the source remain unknown.

## Post-review revision

The operator confirmed all 162 addresses belong to Russia, Rostov-on-Don. The native `addresses` table now carries the original line, city, country, street and recognized building. All 162 supplied address lines contained a building. The rehearsal retained each value, including a spaced letter suffix and a structure number. A separate street-only fixture was viewable and searchable. Residence type is unknown. Address editing retains full validation, and saving a completed address updates the same row. Existing destination addresses take precedence. The user table has no import-specific address columns.

Historical records now appear on the ordinary organization, poll, results and report pages. Only the importer interprets the source schema and maps original IDs. Product pages and download handlers use generic destination IDs, stored results and current viewer permissions. The source package and original protocols retain their recorded values. The displayed finish on 14 of 51 parents and the cast time on 590 of 6,190 votes came from the same persisted import time. The UI and JSON exports identify these dates. Missing starts remain unknown. Poll 85 has a read-only 324-vote register.

The revised PostgreSQL 17 rehearsal started from the pre-import backup with two existing users. Preflight found 160 creates, one reuse and one review. After explicit resolution and interruption at 20 staged blobs, resume verified the full package. The second apply reported `changed: 0`; insert/update/delete counters remained 25,065 / 8 / 0. A separate copy of the earlier published rehearsal upgraded through the forward migrations and passed the same reconciliation. Printed-protocol discrepancies, the two missing originals and the private conversion exceptions listed above still apply.

The optimized production server served all 24 original PDF hashes and enforced four viewer roles through the ordinary routes. Chromium verified the country, city, street and building prefills on an actual mapped profile. Clearing the building and submitting displayed the validation error and preserved the stored address. The database test completed a partial address in the same row. The revised suite passed 4,484 unit tests, 63 PostgreSQL tests and four extraction/protocol tests. Two opt-in live timestamp-provider tests were skipped. The production build passed, with zero private source references in 93 dependency traces. Prisma’s migration diff produced zero changes for the SQL-managed historical tables.

## Native poll mapping review

The requested destination for the 26 meetings is an ordinary finished Resolutio poll using the pre-sealing convention: `state=FINISHED` and `finished_at IS NULL`. The native voting period stores the end separately. All 5,601 meeting votes have effective weight one, as do all 6,190 votes across the package. The package preflight now checks each recorded voter before opening the destination connection. `EQUAL` preserves the answer totals. The legacy potential-voter count remains separate evidence because individual nonvoter rosters are unavailable.

For the eleven meetings with a missing start and a recorded finish in 2021–2024, use the day before that finish and mark the start as inferred. Otherwise a missing start uses the persisted import time when it precedes the finish. Meeting 85 uses the persisted import time for its missing end. The native meeting preview records the origin of each date. A fresh dry run uses its transaction time pending the first apply checkpoint.

The operator approved ordinary native board poll results access and retiring the old public-questions listing. The legacy controller calls the company's public-question scope; the export contains 46 member-meeting questions, nine board-meeting questions, 54 work reports and eight information posts with the public flag. The first 55 questions belong to 19 meetings. The flag creates no additional polls, reports, file copies or anonymous access grants.

The importer publishes all 26 meetings, 165 questions, 502 answers and 5,601 ballots through the native schema. It records only known voters as participants and keeps the original potential-voter denominator in the meeting description. Protocols form 25 native reports with 47 files, including 24 original PDFs. The 339 meeting-question files and four inline images belong directly to their 103 original questions. The importer preserves all files on 35 questions exceeding the native three-file upload limit (maximum 15). Both a fresh import and an upgrade from poll-level ownership passed byte and owner reconciliation on PostgreSQL. Repeat apply reported zero changes. All 329 work reports and ten information posts have organization-only visibility. Seven contain eligible references producing 15 formal links. Two others contain references to board meetings, preserved in their text. A date or shared organization alone establishes no link.

Apply upgrades the published archive in a transaction, writes the same representation on a fresh destination, and reconciles ballots, attachment hashes, report links and audiences. Full texts above the native question-detail limit, original voter names, report scores, and media outside the native upload rules remain accessible via authenticated archive links. The rehearsal exercised native access to all 26 poll results and all 364 reports and denied anonymous access to every report. The earlier public-page counts and HTTP evidence above describe the superseded implementation.

## Unresolved questions

Production account collisions depend on the operator's target dry run. The missing original PDFs for meetings 69 and 85 can be supplied separately if found.
