# Server-to-Client Component Serialization & Security - Fix Summary

## Problems

### 1. Serialization Issue

React Server Components in Next.js cannot pass objects with `toJSON` methods or other class methods to Client Components. Domain objects from our DDD architecture have these methods, causing runtime errors:

```
Error: Only plain objects can be passed to Client Components from Server Components.
Objects with toJSON methods are not supported.
```

### 2. Security Vulnerability ⚠️

**CRITICAL**: Server components were sending sensitive voter data (names, weights, individual votes) to ALL clients, regardless of permissions. While the UI hid this data, anyone could access it through the browser console using `React DevTools` or `window` object inspection.

**Impact**: Non-creator users could see who voted for what, violating vote privacy.

## Root Causes

1. **Serialization**: Our domain objects (Poll, Question, Answer, etc.) are classes with methods. When passed directly from Server Components to Client Components, React rejects them.

2. **Security**: The results page was serializing ALL data including voter details and sending it to the client, only hiding it in the UI. The `canViewVoters` permission check was client-side only.

## Solution Pattern

Always serialize domain objects to plain objects before passing to Client Components:

```tsx
// ❌ BAD - Passing domain object directly
export default async function ServerPage() {
  const poll = await getPollByIdAction(pollId);
  return <ClientComponent poll={poll.data} />;
}

// ✅ GOOD - Serialize to plain object first
export default async function ServerPage() {
  const poll = await getPollByIdAction(pollId);

  const serializedPoll = {
    id: poll.data.id,
    title: poll.data.title,
    questions: poll.data.questions.map((q) => ({
      id: q.id,
      text: q.text,
      answers: q.answers.map((a) => ({
        id: a.id,
        text: a.text,
      })),
    })),
  };

  return <ClientComponent poll={serializedPoll} />;
}
```

## Issues Found and Fixed

### 1. Vote Page - `src/app/[locale]/polls/[pollId]/vote/page.tsx`

**Issue**: Passed `Poll` domain object and `VoteDraft[]` directly to `VotingInterface`

**Fix**: Created `serializedPoll` and `serializedDrafts` by manually mapping all nested structures:

- Poll → plain object with all properties
- Questions → array of plain objects
- Answers → array of plain objects
- VoteDrafts → array of plain objects with answerId

**Lines Changed**: 50-110

### 2. Results Page - `src/app/[locale]/polls/[pollId]/results/page.tsx`

**Issue**: Passed `GetPollResultsResult` containing `Poll` domain object to `PollResults`

**Fix**: Created `serializedResults` by mapping:

- Poll domain object → plain object with pollId, title, description, etc.
- Questions with nested answers → plain objects
- Voters with User objects → plain objects with id, name, weight
- Prisma Decimal types → numbers using `Number()` conversion

**Lines Changed**: 60-120

### 3. **SECURITY FIX** - Results Page Voter Data Leak ⚠️

**Issue**: Server was sending ALL voter data (names, weights, votes) to every client, regardless of `canViewVoters` permission. The UI only hid the data, but it was accessible via browser console.

**Security Risk**:

- Non-creator users could inspect client-side data structures
- Voter anonymity was compromised
- Individual voting patterns were exposed

**Fix**: Added server-side filtering in `src/app/[locale]/polls/[pollId]/results/page.tsx`:

```tsx
// SECURITY: Only include voter details if user has permission
voters: canViewVoters
  ? a.voters.map((v: any) => ({
      userId: v.userId,
      userName: `${v.userName.firstName} ${v.userName.lastName}`,
      weight: typeof v.weight === 'object' ? Number(v.weight) : v.weight,
    }))
  : [], // Empty array if user doesn't have permission
```

**Result**: Voter data is now filtered on the server BEFORE sending to client. Non-authorized users receive empty voter arrays and cannot access sensitive voting information.

**Lines Changed**: 68-106

### 4. Voting Interface - `src/web/components/voting/VotingInterface.tsx`

**Issue**: Crashed when `initialDrafts` was `undefined`

**Fix**: Added defensive check before forEach:

```tsx
if (initialDrafts && Array.isArray(initialDrafts)) {
  initialDrafts.forEach(draft => { ... });
}
```

**Lines Changed**: 65-70

## Files Verified as Correct

These files already properly serialize data or don't pass complex objects:

### ✅ Participants Page - `src/app/[locale]/polls/[pollId]/participants/page.tsx`

- Already serializes `ParticipantWithUser[]` to plain objects
- Maps user properties manually: `userName`, `userWeight`
- No changes needed

### ✅ Account Page - `src/app/[locale]/account/page.tsx`

- Already serializes `User` domain object to plain object
- Manual property mapping for id, firstName, lastName, etc.
- No changes needed

### ✅ Organizations Page - `src/app/[locale]/organizations/page.tsx`

- Calls `listOrganizationsAction` which returns already-serialized data
- Action properly maps organization objects to plain structure
- No changes needed

### ✅ Authentication Pages (Login, Register)

- `LoginForm` and `RegisterForm` receive only primitives (locale string)
- No complex objects passed
- No changes needed

### ✅ Client Components Used in Client Pages

- `PollControls`, `PollSidebar`, `QuestionForm` used in edit/create pages
- Edit and create pages are Client Components (`'use client'`)
- No Server-to-Client boundary involved
- No changes needed

### ✅ Simple Components

- `LocaleSwitcher`: No props
- `CreateOrganizationDialog`: Only receives locale string
- No changes needed

## Testing

### New Test Suite: `src/web/__tests__/serialization.test.ts`

Created comprehensive test suite with 13 tests covering:

1. **Serialization Validator Tests** (8 tests)
   - Accepts primitives (strings, numbers, booleans, null, undefined)
   - Accepts plain objects and arrays
   - Accepts Date objects
   - Rejects objects with methods (like domain objects)
   - Rejects functions
   - Detects nested domain objects
   - Detects circular references

2. **Common Pattern Tests** (4 tests)
   - Validates serialized poll data structure
   - Validates serialized results data structure
   - Validates serialized participant data
   - Validates serialized user preferences

3. **Documentation Test** (1 test)
   - Documents all verified files and the serialization pattern

### Test Results

- **Total Tests**: 315 (was 302, added 13)
- **Status**: ✅ All passing
- **Coverage**: Validates all common serialization patterns

## Build Verification

- ✅ TypeScript compilation successful
- ✅ Next.js build successful
- ✅ All routes generated without errors

## Prevention Strategy

1. **Test Suite**: Use `isJSONSerializable()` helper from serialization tests to validate new data structures

2. **Security & Code Review Checklist**:
   - [ ] Does this Server Component pass data to a Client Component?
   - [ ] Is the data from a use case or repository (domain objects)?
   - [ ] Has the data been serialized to plain objects?
   - [ ] Are all nested objects (questions, answers, etc.) also serialized?
   - [ ] Are Prisma Decimal types converted to numbers?
   - [ ] **Does the data contain sensitive information?**
   - [ ] **Is sensitive data filtered on the SERVER before serialization?**
   - [ ] **Never rely on client-side hiding for security - always filter on server**

3. **Development Pattern**:

   ```tsx
   // Always create a serialized* variable when passing domain data
   const result = await useCaseAction();

   // SECURITY: Check permissions BEFORE serializing sensitive data
   const canViewSensitiveData = checkPermissions(user, result.data);

   const serializedData = {
     // Manually map all properties
     id: result.data.id,
     name: result.data.name,
     // Filter sensitive fields based on permissions
     sensitiveInfo: canViewSensitiveData ? result.data.sensitiveInfo : null,
   };

   return <ClientComponent data={serializedData} />;
   ```

4. **Security Principle**:
   > **Never send sensitive data to the client if the user shouldn't see it**
   >
   > Hiding data in the UI is NOT security. Anyone with browser DevTools can access client-side data. Always filter on the server.

## Related Files

### Modified Files

1. [src/app/[locale]/polls/[pollId]/vote/page.tsx](src/app/[locale]/polls/[pollId]/vote/page.tsx) - Serializes poll and drafts
2. [src/app/[locale]/polls/[pollId]/results/page.tsx](src/app/[locale]/polls/[pollId]/results/page.tsx) - **Serializes results + SECURITY FIX: filters voter data**
3. [src/web/components/voting/VotingInterface.tsx](src/web/components/voting/VotingInterface.tsx) - Added defensive check

### New Files

1. [src/web/**tests**/serialization.test.ts](src/web/__tests__/serialization.test.ts) - Comprehensive serialization tests

### Verified Files (No Changes Needed)

1. [src/app/[locale]/polls/[pollId]/participants/page.tsx](src/app/[locale]/polls/[pollId]/participants/page.tsx)
2. [src/app/[locale]/account/page.tsx](src/app/[locale]/account/page.tsx)
3. [src/app/[locale]/organizations/page.tsx](src/app/[locale]/organizations/page.tsx)
4. All authentication pages (login, register)
5. All simple components (LocaleSwitcher, CreateOrganizationDialog)

## Key Takeaways

1. **Domain objects cannot cross the Server/Client boundary** - Always serialize them first
2. **Manual mapping is required** - No automatic serialization in Next.js 15+
3. **Nested structures need attention** - Map all levels (questions → answers → voters)
4. **Prisma Decimal types need conversion** - Use `Number()` for numeric values
5. **Defensive programming** - Always check for undefined before array operations
6. **Tests are essential** - Catch these issues before runtime with serialization tests
7. **⚠️ SECURITY CRITICAL**: Never send sensitive data to unauthorized clients
   - UI hiding is NOT security
   - Always filter sensitive data on the SERVER before serialization
   - Assume all client-side data is accessible via browser DevTools
   - Check permissions BEFORE including data in serialized objects

## Status

✅ **All serialization issues resolved**
✅ **Security vulnerability fixed** - Voter data now filtered server-side
✅ **All tests passing** (315/315)
✅ **Build successful**
✅ **Prevention tests in place** 3. **Nested structures need attention** - Map all levels (questions → answers → voters) 4. **Prisma Decimal types need conversion** - Use `Number()` for numeric values 5. **Defensive programming** - Always check for undefined before array operations 6. **Tests are essential** - Catch these issues before runtime with serialization tests

## Status

✅ **All serialization issues resolved**
✅ **All tests passing** (315/315)
✅ **Build successful**
✅ **Prevention tests in place**
