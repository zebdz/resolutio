# Resolutio

A civic platform that empowers people to unite in organizations, make collective decisions through structured voting, and produce legally meaningful documents they can bring to courts, government offices, or other institutions.

## What It Does

Resolutio gives communities the tools to self-organize and make formal decisions:

- **Organizations** — Create and manage organizations with member and admin roles. Organizations can form hierarchies through parent-child relationships.
- **Boards** — Define specialized boards within organizations for focused governance.
- **Polls & Voting** — Run structured polls with single or multiple-choice questions, weighted voting, multi-page layouts, and a full lifecycle (Draft → Ready → Active → Finished).
- **Legal Documents** — Generate PDF protocols of voting results for official use.
- **Invitations & Join Requests** — Invite members, admins, or board members. Handle join requests with approval workflows.
- **Notifications** — Keep members informed about organization activity.
- **Privacy Controls** — Users control whether they can be found by name or phone number, with audit logging.
- **Superadmin Panel** — Monitor suspicious activity, manage rate limits, block abusive users or IPs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, Tailwind Catalyst |
| Database | PostgreSQL, Prisma 7 |
| Auth | Session-based, Argon2 password hashing, OTP phone verification |
| i18n | next-intl (Russian, English) |
| Validation | Zod |
| Bot Protection | Cloudflare Turnstile |
| PDF | pdfmake |
| Testing | Vitest (unit), Playwright (e2e) |
| Architecture | Domain-Driven Design |

## Project Structure

```
src/
  domain/          # Core business logic (models, rules, value objects)
  application/     # Use cases and application services
  infrastructure/  # Database repos, external service adapters
  web/             # Server actions, API routes, middleware
  app/             # Next.js pages and components
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Yarn

### Setup

```bash
# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env

# Run database migrations
yarn db:migrate

# Seed the database (optional)
yarn db:seed

# Enable git hooks (lint, typecheck, tests on commit)
git config core.hooksPath scripts/hooks
```

### Development

```bash
yarn dev
```

Open [http://localhost:8080](http://localhost:8080) to see the app.

### Testing

```bash
yarn test           # Run unit tests
yarn test:watch     # Watch mode
yarn test:e2e       # Run end-to-end tests
```

### Other Commands

```bash
yarn lint           # ESLint
yarn format         # Prettier
yarn typecheck      # TypeScript check
yarn build          # Production build
```

## Localization

The app supports Russian (default) and English. Language is set during registration and can be changed in account settings. All UI text is localized — no hardcoded strings.

Translation files: `messages/ru.json`, `messages/en.json`

## License

[AGPL-3.0](LICENSE)
