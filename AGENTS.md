## Project description

A service (web app) that would allow people to unite in organizations, vote, and based on those votes have a legal decision/document which they could use in a number of ways:

- bring to court
- bring to the governmental offices/officials
- etc

## Documentation

- Start with [readmes/README.md](readmes/README.md), then read only the specs, active plan sections and reference docs relevant to the task. Do not load entire documentation directories.
- Active plans live in `plans/`; historical plans live in `plans/archive/`. Exclude the archive from routine content searches. Consult it only for relevant historical reasoning or when requested.
- Archived plans are historical proposals, not current requirements or proof of completed work. Check implementation claims against code and tests; surface conflicts with approved designs before changing behavior.
- Keep the index, relevant design docs and active plan status updated as work progresses. On completion, record deviations and remaining limitations, then archive the plan and update its index entry.

## Git

- git add is allowed
- NEVER commit on master branch

## Security

- **Never send sensitive data to the client if the user shouldn't see it.** UI hiding is NOT security — anyone with browser DevTools can access client-side data.
- Always check permissions on the SERVER and filter sensitive fields BEFORE serializing data for Client Components.
- Domain objects (classes with methods) cannot cross the Server/Client boundary — always serialize to plain objects first.
- Manually map all nested structures (questions → answers → voters, etc.) — no auto-serialization in Next.js 15+.
- Convert Prisma `Decimal` types to numbers using `Number()`.
- Pattern:
  ```tsx
  const result = await useCaseAction();
  const canViewSensitive = checkPermissions(user, result.data);
  const serializedData = {
    id: result.data.id,
    sensitiveInfo: canViewSensitive ? result.data.sensitiveInfo : null,
  };
  return <ClientComponent data={serializedData} />;
  ```
- Checklist for Server→Client data passing:
  - Is domain data serialized to plain objects (including nested)?
  - Is sensitive data filtered server-side based on permissions?
  - Are Prisma Decimal types converted to numbers?

## Testing

- use tdd skill
- prefer unit tests over integration

## Database

- DB: PostgreSQL
- ORM: Prisma
- Tables use `@@map` (e.g. `organizations`, not `"Organization"`) and columns use `@map` (e.g. `archived_at`, not `"archivedAt"`). Always check `prisma/schema.prisma` for actual DB names when writing raw SQL.
- `Prisma.empty` is broken in `$queryRaw` tagged templates (Prisma v7) — it corrupts parameter numbering. Use separate query branches instead of conditional SQL fragments.
- `Prisma.join` works fine for `NOT IN` clauses inside `$queryRaw` tagged templates.
- **No raw SQL in `web/actions/`** — use Prisma query builder (`findMany`, `findFirst`, etc.) or call repository methods. Raw SQL (`$queryRaw`) belongs in `infrastructure/` repositories only.

## UI

- Tailwind Catalyst components: src/web/components/catalyst
- Tailwind for styling
- UI should be responsive: it should look good on widescreens, regular screens, tablets and especially on mobile phones
- All clickable native `<button>` and `<a>` elements that don't already get pointer styling from a Catalyst component MUST include `cursor-pointer`. Pair with `disabled:cursor-not-allowed` whenever the element supports a disabled state. (Tailwind v4 sets default cursor to `default`, so this isn't automatic.)
- use design-an-interface skill when planning UI

## Tooling

- package manager: yarn

## Coding

- Use Domain Driven Development (DDD)
- DDD structure:
  /src
  /domain
  /application
  /infrastructure
  /web

## Coding style

- look at eslint.config.js for rules
- use Prettier for code formatting: .prettierrc

## Rate limiting

- `<Link>` from `@/src/i18n/routing` defaults to `prefetch={false}` — do NOT override with `prefetch={true}` unless you have a specific reason. Each prefetch triggers a middleware request; navbar/sidebar links alone add ~16 MW hits per page load, quickly exhausting the 120/min MW session limit.
- Every server action must include a rate limit check at the top:
  ```typescript
  import { checkRateLimit } from '@/web/actions/rateLimit';
  // ...
  const rateLimited = await checkRateLimit();
  if (rateLimited) return rateLimited;
  ```
- See `readmes/Rate-Limiting.md` for full architecture docs

## Rules

- We never delete any entities, we only archive them. Because we need all info saved: who, when, and being a part of what organization voted and in what manner. The only rows on the database that we can delete - are the ones that have to do with linking a user to an organization, to an admin, to a board, to a superadmin (but not the user itself!).
- vote drafts can also be deleted
- notifications can also be deleted

## Error codes and localization

- the app should support different languages, English and Russian for starters
- Default language is chosen based on the language used when a user was registering
- Once logged in, an app should respect user's default language setting
- Default language is Russian
- all messages (success/error) should be localized - we should not hardcode any messages shown in the UI
- our models and use cases should return codes instead of messages; they will be mapped to localized messages. See PollErrors.ts and PollDomainCodes.ts as examples.
- localization messages are in messages/en.json and ru.json
- so, when a code is created, it should be added to messages (if not already there)
- **Translating error codes in server actions**: use the shared `translateErrorCode` utility from `@/web/actions/utils/translateErrorCode`. It automatically resolves any dotted error code (e.g. `organization.errors.notFound`, `domain.organization.organizationNameEmpty`) to the correct translation. Usage:
  ```typescript
  import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
  // ...
  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }
  ```
  Do NOT write inline `.startsWith()` / `.split('.')` translation logic or local `translateErrorCode` helpers in action files.
