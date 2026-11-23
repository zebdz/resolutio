# Berezka import runbook

Run the production commands as the Resolutio deployment user. Use the release containing the organization poll and report routes, migrations, bcrypt adapter and `db:berezka`. The SQL and both original ZIP files stay on the trusted extraction machine. The private package contains credentials, named ballots, addresses and restricted documents. Keep it outside the application web root with directory mode 0700.

## Prepare the reviewed snapshot

```sh
umask 077
mkdir -p "$PRIVATE"
python3 scripts/berezka/extract.py u1037625_decision_community.sql \
  storage.2026-11-22_18_10_38.zip storage.2026-11-22_18_12_15.zip "$PRIVATE/package"
```

Set `PRIVATE` to a private absolute directory first. Extraction needs Python 3.11 or newer. The expected manifest SHA-256 is `c912d6821350259d9b51cf28595c18e8c9e457982e2759b95ea1fee91aba38e4`. Transfer the package over the operator's private channel. Freeze any remaining legacy writes before cutover. If a final snapshot differs, repeat scoped reconciliation, update the reviewed input and package digests, and rehearse the changed package before apply.

## Check the destination

Run from a privately staged copy of the new release if the running release predates the command. Export `DATABASE_URL` for the intended PostgreSQL database using the maintenance login. The importer uses the explicit environment variable. Use a new findings filename for each attempt. Run this before changing the destination.

```sh
umask 077
yarn db:berezka dry-run --package "$PRIVATE/package" --findings "$PRIVATE/preflight.json"
```

The private findings include `nativeMeetingPreview` for the 26 voting meetings. It lists each file’s owning question, protocol documents and proposed period, with the origin of each missing date. Once apply creates a checkpoint, later runs reuse that timestamp.

Expect 162 decisions in total. The destination determines the split. Exit status 1 with “Review required” calls for examining the private candidates or organization collision. Confirm ambiguous accounts with independent evidence. Copy the generated private `preflight.json.overrides.json` template, keyed by legacy ID, to `$PRIVATE/resolutions.json`. A value can be a specific destination user ID or the literal `"create"` for a distinct account with available phone and email. An empty object works when all matches are automatic. A conflicting organization requires investigation before proceeding. Preserve the private findings as the review record.

For a reviewed new account with a corrected phone and no email, use an object with `action: "create"`, `phone` (full +7 number) and `email: null`. The corrected number starts unconfirmed and must be available. For a reviewed existing account with independently confirmed phone ownership, use `action: "reuse"`, `targetId` and `confirmedPhone` (full +7 number). Preflight checks both the account and its confirmed phone. This permits resolving a legacy placeholder to its verified owner. Original source contacts stay in the restricted evidence.

```sh
yarn db:berezka dry-run --package "$PRIVATE/package" --overrides "$PRIVATE/resolutions.json" \
  --findings "$PRIVATE/approved.json"
```

Require zero reviews, no organization collision and exit status 0. Record the printed mapping digest. The creator, board members and admins use these same account mappings.

## Back up, apply and verify

Quiesce application writes for a recoverable cutover. Back up before deploying the schema changes. Verify the dump by restoring to a **new empty database** and comparing the pre-import account and organization counts. Protect the dump like the package. Preserve application and database versions together.

```sh
pg_dump --format=custom --no-owner --no-acl --file="$PRIVATE/before.dump" --dbname="$DATABASE_URL"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$EMPTY_RESTORE_DATABASE_URL" "$PRIVATE/before.dump"
# Deploy the native application migrations before applying the import.
yarn db:berezka apply --package "$PRIVATE/package" --overrides "$PRIVATE/resolutions.json" \
  --mapping-digest "$REVIEWED_MAPPING_DIGEST" --attestation "$OPERATOR_ATTESTATION"
yarn db:berezka verify --package "$PRIVATE/package"
```

Use the original pre-apply mapping digest for interruption recovery and the second apply. A dry run after publication classifies all 162 persisted identities as reused and prints a new digest.

Set `OPERATOR_ATTESTATION` to the operator identity and their confirmation of the legacy ordinary phone numbers. The import records it with the import timestamp. Reused accounts retain their credentials, existing contacts, confirmation and privacy settings. An available legacy email fills an empty email field as unconfirmed. Conflicting emails remain in the restricted source record. New accounts receive their source creation date and unverified email. The placeholder account stays unconfirmed. Native organization and membership creation metadata record import time where the source has no date. The importer fills missing meeting finishes and missing ballot timestamps from the persisted start of this import, including after interruption. Screens label those values as import dates. Exports include `finish_from_import` and `cast_from_import`. Original source records retain their nulls. The archive retains unknown starts. Native polls use the import time for a missing start when it precedes the finish. All eleven meetings with missing starts in this package finished before the import, so the importer uses the day before each recorded finish and labels it as inferred.

The importer stores each source address in `addresses`, with country Россия, city Ростов-на-Дону and the original address line. It records the street and any recognized building. Residence type remains unknown until the owner saves a complete address. An existing destination address takes precedence. The profile shows and prefills known fields. The normal save requires country, city, street, building, and either a private-house selection or an apartment.

The importer takes a connection-level organization lock, stages content-addressed blobs in committed batches of 20, then locks identity and organization rows against concurrent writes and rechecks the approved mapping. All native changes, historical crosswalks and publication commit together after verification. A failed final transaction leaves staged files private. After interruption, repeat the same apply command. Source, checkpoint or identity drift requires investigation. Reissue preflight after resolving a collision. If the approved mapping must change after staging, recover the quiesced pre-import database into a new database before restarting.

Expect `verified: true`, 26 finished native polls, 5,601 native ballots, 339 work reports and information posts, 25 linked protocol reports and 15 formal links from reports or posts to meetings. The source reconciliation covers 6,190 votes including ratings and proposals. Repeat apply to confirm `changed: 0`. Check board results as an ordinary member, a board protocol as a board member and a previously public item signed out.

## Voting eligibility

The legacy voter permission initializes each imported member’s organization-wide voting eligibility. In any organization, members can see their own status on the organization page. Organization administrators and superadmins can change it under **Members** with a reason. **Voting eligibility history** shows both states, who made the change, the time and the reason, including for former members. Changes apply when a new voter list is prepared. Repeat import verification checks the imported flags together with subsequent audited changes.

## Recovery

Keep the failed database and private evidence. While writes remain quiesced, restore the pre-import dump into a fresh database, verify the pre-import counts, and switch the application back to its matching release and database. If writes have resumed, reconcile those writes before switching databases. The restore commands above omit ownership and ACLs. Provision application roles and grants separately when the database uses distinct owner/runtime roles, including read access to the published historical records for the server. Restrict database access to trusted server and operator roles.

## Historical access and exceptions

The 26 voting meetings use ordinary finished organization polls, equal weights and pre-sealing finish semantics. Organization members can read board votes. Board attachments and protocol reports use the native board audience. All 117 source-public flags are ignored for access. The 55 meeting questions carrying this flag stay with their 19 parent polls. The other flagged items are 54 work reports and eight information posts.

The importer assigns 339 documents and four inline images to 103 original meeting questions. The 35 questions with more than three files keep all their files, up to 15. New uploads allow three files per question. The question editor, voting screen and results show image thumbnails and the first page of each PDF. The browser builds these previews from the original attachment bytes. The poll seal covers those original bytes. Upgrading a previously rehearsed import preserves the native file IDs and checks each stored digest before assigning its question.

The 329 work reports retain their source ratings, and the ten information posts retain their own files. Their legacy parents are collections or posts. Seven records explicitly cite organization-wide meetings and receive 15 native report–poll links. Two further records cite board meetings in the text. These text links remain readable subject to the destination's access checks. The native org-only report linking rule accepts organization-wide polls. Protocols have explicit meeting owners and link directly. Saved archive URLs resolve to the corresponding native record. The archive retains original voter names, denominator, date provenance, complete question bodies, ratings and private proposals. Native question details have a 500-character limit. A poll includes links to the full text of longer questions. Unsupported media and oversized report images remain available through scoped archive downloads.

Keep both versions of the poll 67 DOCX and all 21 unassigned paths in restricted evidence. Original PDFs are missing for meetings 69 and 85. Poll 85 retains all 324 votes. Its displayed finish is the recorded import time. The archive profile view shows owners their own supplemental record and current Berezka admins the 69 records. The school-transport applications and legacy session tokens are excluded. Third-party media are recorded by URL. Unresolved links remain in the restricted conversion findings rather than directing visitors to a guessed target.

The printed protocols and voting snapshot are separate evidence. Twelve of the 24 PDFs contain extractable result tables. Of 171 aligned answer rows, 20 differ in percentage or count. Six printed counts differ across meetings 27, 44, 58 and 73. Meeting 70 has percentage differences only. The other 12 originals are scans. Their numerical reconciliation requires human review. The import preserves every ballot and the original PDF bytes. Reproduce the machine-readable comparison on the trusted extraction host with Poppler installed.

```sh
python3 scripts/berezka/protocols.py "$PRIVATE/package" > "$PRIVATE/protocol-comparison.json"
```

Ordinary application migrations create only native fields for voting eligibility, partial addresses and question attachments. On first apply the operator installs a private checkpoint and the source evidence in `berezka`. Meetings, questions, answers, votes and reports go directly into the existing native tables. Supplemental archive URLs use read-only SQL views over the evidence. Fresh imports create no `historical_*` tables. For databases using the earlier development migration chain, rehearse on a fresh database restored from the pre-import backup and retain the old database for comparison.

Apply these grants to the actual non-owner web login after the first successful import, before starting the new release. The runtime also needs its ordinary native application permissions. When upgrading an earlier rehearsal, remove its previous archive grants. [Production rollout](Poll-Seal-Rollout.md)

```sql
REVOKE USAGE ON SCHEMA berezka FROM resolutio_runtime;
REVOKE ALL ON historical_imports, historical_members, historical_polls, historical_questions,
  historical_answers, historical_votes, historical_assets, historical_blobs, historical_profiles FROM resolutio_runtime;
GRANT SELECT ON historical_imports, historical_members, historical_polls, historical_questions,
  historical_answers, historical_votes, historical_assets, historical_blobs TO resolutio_runtime;
GRANT EXECUTE ON FUNCTION historical_can_poll(text,text), historical_can_question(text,text),
  historical_can_asset(text,text), historical_profiles_for(text,text) TO resolutio_runtime;
```

The [completed rehearsal](../plans/archive/2026-11-22-berezka-import.md) records the verified counts, HTTP checks, second-run write counters and printed-protocol discrepancies.
