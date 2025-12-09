# Testing Guide

## Test Types in Your Project

### 1. **Unit Tests** (Vitest)

These test individual functions, classes, and components in isolation. Located in `src/**/__tests__/` directories.

**Commands:**

```bash
yarn run test          # Run tests in watch mode (reruns on file changes)
yarn run test:ui       # Run tests with visual UI interface
yarn run test:run      # Run all tests once and exit
```

**Examples in your project:**

- `src/domain/user/__tests__/PhoneNumber.test.ts` - Tests PhoneNumber value object
- `src/domain/user/__tests__/User.test.ts` - Tests User entity
- `src/infrastructure/auth/__tests__/Argon2PasswordHasher.test.ts` - Tests password hashing
- `src/infrastructure/auth/__tests__/Argon2PasswordVerifier.test.ts` - Tests password verification

**Current status:** ✅ 33 tests passing

---

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
| **Unit**  | Vitest     | `src/**/__tests__/` | Test individual functions/classes | `yarn run test:run` |
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
yarn run test:run          # Quick unit test check
yarn run lint              # Code quality check

# Before deploying
yarn run test:e2e          # Full E2E test suite
yarn run build             # Includes prebuild (format + unit tests + lint)
```

The prebuild only runs **unit tests** (fast) to keep the build process quick. Run E2E tests separately before major deployments! 🚀
