# Poll seal rollout

The first release keeps voting and poll lifecycle writes on hold until an operator confirms that every writer is running the new release. Reads continue. The hold lives in PostgreSQL and survives process restarts. Budget a maintenance window and tell voters when to retry.

## Before the window

- Inventory all instances, scheduled jobs and other database writers for the target site. Take a protected PostgreSQL backup and verify its restore on a separate database. Retain the previous complete application artifact. The deployment script's local code backup covers only part of the application.
- Configure the site's restricted runtime login in `DATABASE_URL` and its schema owner in `MIGRATION_DATABASE_URL`. Use the corresponding `_BETA` secrets for beta. The workflow passes the migration connection over SSH stdin to the migration process. Use a trusted deployment host. Protect access to its operating-system account, release archives, database and backups.
- Generate a separate random bearer per site, for example with `openssl rand -hex 32`. Store it in `ANCHOR_POLLER_SECRET` or `ANCHOR_POLLER_SECRET_BETA`. The workflow sets `ANCHOR_PROVIDER=opentimestamps` and the site's HTTPS `NEXT_PUBLIC_API_URL` at build and runtime. Optional Actions variables are `OTS_CALENDAR_URLS`, `OTS_ESPLORA_URL` and `OTS_TIMEOUT_MS`. Public OTS calendars and the default Bitcoin explorer require no key.
- Install the matching tracked nginx vhost, run `nginx -t`, then reload it. Both sites block the public `/api/internal/` prefix. The app binds to loopback. Verify the HTTPS worker path returns 403 even with a valid bearer. Use the loopback worker for authorized requests.
- Arrange durable PostgreSQL audit logging for **operator** transactions, including `SET LOCAL`, trigger/role/grant changes and any actual privileged mutation. For example enable `log_statement=all` for the named maintenance login and reconnect. Set `log_parameter_max_length=0` and `log_parameter_max_length_on_error=0`. Use parameters and keep secrets and private payloads out of SQL literals. Restrict and retain audit logs independently of the app host. Test retrieval against the maintenance login and timestamp before release.
- Use a non-owner runtime login with no superuser/role-management rights or paths to assume a schema/table owner. Remove inherited or public mutation rights too. Grant SELECT and INSERT on `votes` and `poll_seals`, revoke UPDATE (including column grants), DELETE, TRIGGER and TRUNCATE. Deny schema DDL and cascading deletion of protected parent data. The app needs SELECT/INSERT/UPDATE on `seal_work_claims`, `seal_anchors` and `seal_bundle_deliveries`. Preserve existing ordinary application grants. Arrange these grants when the new tables are created or while the first hold is active. Use separate grants for migrations. Example for an existing runtime role:

```sql
GRANT SELECT, INSERT ON votes, poll_seals TO resolutio_runtime;
REVOKE UPDATE, DELETE, TRIGGER, TRUNCATE ON votes, poll_seals FROM resolutio_runtime;
GRANT SELECT, INSERT, UPDATE ON seal_work_claims, seal_anchors, seal_bundle_deliveries TO resolutio_runtime;
```

## First cutover

1. On the legacy database, the release runs `node scripts/seal-ops/rollout.mjs prepare` as the migration role. Wait for `{"writes":"held"}`. Installing the three triggers drains existing writes and prevents old and new processes from casting, changing participants or finishing polls. A lock timeout aborts preparation. Resolve the blocker and repeat before migrating. On a brand-new database, provision the schema with `prisma migrate deploy` while every app and job is offline, then enter this procedure before allowing traffic.
2. The packaged `./migrate-production.sh` runs preparation, Prisma migrations, the compiled backfill, then coverage. It fails on the first unsuccessful step. For manual execution, provide the migration role's `DATABASE_URL` in the operator process. Existing ACTIVE and paused READY ballots receive a secret only if needed. Check `missing: 0`. A vote missing its participant row requires investigation. Existing FINISHED polls retain a null finish time. Migrated voters can verify current inclusion and have no original cast-time snapshot.
3. Start every updated writer, then run `node scripts/seal-ops/rollout.mjs check-runtime` using the site's ordinary runtime environment. The deployment script runs this check before restarting its server. Verify application health and release identity on each instance. Take obsolete processes and jobs out of service. Account for every writer.
4. From the release directory, as its service account, run `bash scripts/seal-ops/cron-entry.sh`. Install the generated line in a site-specific root-owned mode-0644 file under `/etc/cron.d/`, using a name such as `resolutio-seal-beta`. Enable cron. This is a system crontab line with a username. Keep one schedule per site. It runs every 15 minutes with a local lock, reads the private site environment, and writes aggregate counts to `seal-worker.log`. Rotate the log and monitor missed runs and nonzero exits. Invoke the same worker manually with `node scripts/seal-ops/worker.mjs` to check service access. It performs real recovery, including configured email deliveries.
5. After verifying the complete fleet, run the following as the migration role. Release checks the three holds, required tables and ballot coverage inside the transaction that reopens writes. Routine deployments recognize a previously released database.

```sh
node scripts/seal-ops/rollout.mjs coverage
node scripts/seal-ops/rollout.mjs release --all-writers-updated
```

## Failures and rollback

A failed migration, backfill, grant, startup or health check leaves the initial hold in place. Resume with the same release after resolving the cause. If a rollout fails **after** opening writes, run `node scripts/seal-ops/rollout.mjs freeze` as the migration role before changing binaries. Pause schedulers, verify the hold, and keep it while incompatible writers exist. Preserve the database, existing receipt secrets, sealed records, anchor history and delivery state. Roll forward to compatible writers and repeat coverage and release. An old binary can serve compatible reads under maintenance. Database restore is a separate incident procedure with reconciliation of all ballots cast since the backup.

To exercise the operator bypass, open a dedicated audited maintenance transaction, use `SET LOCAL app.allow_immutable_mutation = 'on'`, and finish that transaction explicitly. Use `ROLLBACK` for a rehearsal. Verify the setting has ended on the same connection and confirm the operator audit entry. Runtime privileges still govern SQL access even when a session sets that variable.

## Operations and verification

```sh
node scripts/seal-ops/rollout.mjs status
```

Watch `pending_seals`, `missing_anchors`, `failed_anchors`, `due_anchors`, and `reclaimable` across multiple 15-minute runs. A released lease can also be reclaimable when work becomes due. Pending Bitcoin publication can take hours. Check calendar and explorer reachability for persistent failures. The delivery counters include PENDING, SENDING, SENT, FAILED and UNKNOWN when present. A SENDING handoff older than ten minutes expires to UNKNOWN on recovery. Investigate terminal failures and ambiguous SMTP outcomes before contacting the voter. The worker never automatically resends those handoffs. Original receipts and exports stay available according to current access rights.

Use the standalone CLI for the exported receipt, sections and inclusion paths. An upgraded Bitcoin attestation also needs a separate chain check. [Verifier commands and confirmed fixtures](Poll-Seal-Verifier.md)
