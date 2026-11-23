# Testing Guide

## Test Types in Your Project

### 1. **Unit Tests** (Vitest)

These test individual functions, classes, and components in isolation. Located in `src/**/__tests__/` directories.

**Commands:**

```bash
systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- env VITEST_MAX_WORKERS=4 yarn test
yarn test:watch        # Watch focused tests
yarn test:ui           # Visual test interface
```

**Examples in your project:**

- `src/domain/user/__tests__/PhoneNumber.test.ts` - Tests PhoneNumber value object
- `src/domain/user/__tests__/User.test.ts` - Tests User entity
- `src/infrastructure/auth/__tests__/Argon2PasswordHasher.test.ts` - Tests password hashing
- `src/infrastructure/auth/__tests__/Argon2PasswordVerifier.test.ts` - Tests password verification

Use the current test report for counts. Database suites run separately below.

---

### Disposable PostgreSQL tests

`yarn test:poll-db` requires `POLL_TEST_DATABASE_URL`. The harness refuses missing URLs,
non-local hosts and database names without `_test`; it never falls back to `DATABASE_URL`.
Each suite creates a random schema, applies every checked-in migration in order, and drops only
that schema on completion. Ordinary `yarn test` excludes database suites. The existing property
constraint tests also use this harness, so they no longer modify an application's database.

Example disposable instance (512 MiB, loopback only):

```bash
docker run --rm -d --name resolutio-seal-test --memory=512m --cpus=2 \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=resolutio_seal_test \
  -p 127.0.0.1:55439:5432 postgres:17-bookworm

systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- \
  env VITEST_MAX_WORKERS=4 \
  POLL_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/resolutio_seal_test \
  yarn test:poll-db

docker stop resolutio-seal-test
```

The ballot suite proves both vote/finish orderings using `pg_stat_activity` lock barriers,
whole-ballot rollback, stable receipt replay, revision guards, immutable votes/credentials,
transaction-local bypass and restartable legacy backfill. No timing sleeps establish ordering.
The snapshot-discard suite exercises the application use case with real repositories: atomic
transition/removal, rollback on a failed write or callback result, and fresh domain decisions after
competing activation or votes commit. These races use the same observed database lock barriers.
The membership store suite verifies that renewal clears rejection metadata without replacing the
membership row or creation time, and invitation acceptance preserves prior rejection history.
Run `yarn prisma:generate` after schema changes before running these tests.

### Poll seal browser rehearsal

Use the disposable PostgreSQL instance above. Apply migrations to its public schema and install
the Playwright Chromium browser once. Install Poppler's `pdftotext` for PDF assertions.
The rehearsal starts a loopback server on port 55441 with simulated timestamps and SMTP disabled.
It checks a saved ballot in Chromium and the standalone CLI, then compares the rendered results
and English/Russian PDF downloads with the sealed record after live metadata changes. The protocol
tests cover member and administrator access, revoked access, raw HTML, Flight and JSON.

```bash
export POLL_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/resolutio_seal_test
DATABASE_URL="$POLL_TEST_DATABASE_URL" yarn prisma migrate deploy
yarn playwright install chromium
systemd-run --user --scope -p MemoryMax=12G -p MemorySwapMax=1G -- \
  taskset -c 0-3 yarn test:seal-browser
```

To exercise the same frozen protocol tests against a local production build, build the app first
with the test database and an explicit provider. The browser configuration keeps calendar traffic
on loopback and SMTP disabled. No external keys are required.

```bash
systemd-run --user --scope -p MemoryMax=20G -p MemorySwapMax=2G -- \
  taskset -c 0-3 env CIRCLE_NODE_TOTAL=4 DATABASE_URL="$POLL_TEST_DATABASE_URL" \
  ANCHOR_PROVIDER=opentimestamps ANCHOR_POLLER_SECRET=seal-browser-test yarn build
systemd-run --user --scope -p MemoryMax=8G -p MemorySwapMax=1G -- \
  taskset -c 0-3 env SEAL_BROWSER_SERVER=production yarn test:seal-browser
```

### 2. **E2E Tests** (End-to-End with Playwright)

These test your entire application from a user's perspective, running in a real browser. They simulate real user interactions like clicking buttons, filling forms, and navigating pages.

**Commands:**

```bash
yarn run test:e2e        # Run all e2e tests headlessly
yarn run test:e2e:ui     # Run with Playwright UI (interactive)
yarn run test:e2e:debug  # Run in debug mode (step through tests)
```

**Examples in your project:**

- `e2e/hydration.spec.ts` - Tests for React hydration errors
- `e2e/locale-switching.spec.ts` - Tests language switching functionality
- `e2e/locale-bugs.spec.ts` - Tests locale routing
- `e2e/navigation.spec.ts` - Tests page navigation

**What E2E means:**

- **E**nd-**t**o-**E**nd testing
- Tests the full user journey through your app
- Runs in actual browsers (Chrome, Firefox, Safari)
- Tests integration of all layers: UI, API, database

---

## Quick Reference

| Test Type | Tool       | Location            | Purpose                           | Command             |
| --------- | ---------- | ------------------- | --------------------------------- | ------------------- |
| **Unit**  | Vitest     | `src/**/__tests__/` | Test individual functions/classes | `yarn test`         |
| **E2E**   | Playwright | `e2e/`              | Test complete user flows          | `yarn run test:e2e` |

## When to Use Each:

**Unit Tests:**

- ✅ Fast (runs in milliseconds)
- ✅ Test business logic, validation, transformations
- ✅ Run before every build
- ❌ Don't test browser interactions or UI

**E2E Tests:**

- ✅ Test real user scenarios
- ✅ Catch integration issues
- ✅ Test across different browsers
- ❌ Slower (runs in seconds)
- ❌ More fragile (can break with UI changes)

## Your Current Setup:

```bash
# Development workflow
yarn run test              # Unit tests in watch mode while coding

# Before committing
yarn test          # Quick unit test check
yarn run lint              # Code quality check

# Before deploying
yarn run test:e2e          # Full E2E test suite
yarn run build             # Includes prebuild (format + unit tests + lint)
```

The prebuild only runs **unit tests** (fast) to keep the build process quick. Run E2E tests separately before major deployments! 🚀

### Timestamp provider checks

The ordinary suite exercises the real OTS codec with retained pending and Bitcoin proofs,
loopback calendars and a loopback Esplora server. The database suite exercises recovery
using fresh worker instances against the same disposable PostgreSQL state.

This command also submits a fresh random digest, requests its first upgrade and verifies the
historical `hello-world.txt.ots` proof against a public Bitcoin explorer.

```bash
OTS_LIVE_TEST=1 yarn vitest run --maxWorkers=1 src/infrastructure/anchor
```

The fresh submission and historical confirmation are independent. The live test prints the
fresh digest and its observed upgrade status. Calendar and explorer endpoints can be set through
`OTS_CALENDAR_URLS` and `OTS_ESPLORA_URL`.

The export suite casts a weighted ballot, saves the receipt, finishes and seals the poll, downloads
the four HTTP responses and runs the standalone CLI in a temporary directory with an empty
environment. It also covers anonymous and named disclosures across poll types and viewer roles.
To exercise a fresh real calendar submission in the same test, use the disposable database above.

```sh
OTS_LIVE_TEST=1 yarn test:poll-db --maxWorkers=1 SealDownloads.database
```

The [standalone verifier guide](Poll-Seal-Verifier.md) includes the exported fixture and exact
Python OpenTimestamps commands.

The same disposable suite exercises first-bundle recovery, simultaneous workers, changed confirmed
addresses, revoked label access and interrupted SMTP handoffs. It captures mail in process.
The receipt tests check the exact cast-time attachment and both language templates. Run them with
SMTP disabled.

```sh
SMTP_HOST= yarn vitest run --maxWorkers=1 EvidenceMail FinishVotingReceipt NodemailerEmailSender
SMTP_HOST= yarn test:poll-db --maxWorkers=1 SealDownloads.database
```
