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
