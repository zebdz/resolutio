# Prisma Migration Workflow

## `prisma migrate dev` (production workflow)

1. Edit `schema.prisma`
2. `prisma migrate dev --name description`
3. Prisma generates a migration SQL file in `prisma/migrations/`
4. Applies it to local DB
5. Commit the migration file to git
6. On deploy, `prisma migrate deploy` applies pending migrations to production

Version-controlled, sequential, reviewable DB changes. **This is what the deploy pipeline uses.**

## `prisma db push` (prototyping only)

1. Edit `schema.prisma`
2. `prisma db push`
3. Prisma syncs DB to match schema directly — **no migration file generated**
4. Nothing to commit, nothing for production to apply

Shortcut for rapid prototyping. **Not for production.**

## The flow

```
schema edit → prisma migrate dev → commit migration → push to master → deploy runs prisma migrate deploy
```

## Commands reference

| Yarn script            | Prisma command                     | What it does                                                                    | When to use                                                               |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `prisma migrate dev`   | `prisma migrate dev --name <desc>` | Creates migration SQL from schema diff, applies to local DB, regenerates client | **Local dev** — after editing `schema.prisma`                             |
| `yarn db:migrate`      | `prisma migrate deploy`            | Applies pending migration files. No new files created                           | **Production + CI** — deploy pipeline runs this                           |
| `yarn prisma:generate` | `prisma generate`                  | Regenerates TypeScript client from schema. Does NOT touch the DB                | After pulling someone else's migration, or when generated client is stale |
| `yarn prisma:db:push`  | `prisma db push`                   | Pushes schema directly to DB. **No migration file.** No history                 | **Never in this project.** Only for throwaway prototyping                 |
| `yarn db:status`       | `prisma migrate status`            | Shows which migrations are pending vs applied                                   | Debugging migration state                                                 |

## Gotchas

### `db push` skips migration history

If you use `db push`, the schema will have the model but there will be no migration file — production won't get the table. The build will succeed because `prisma generate` only reads the schema file, it doesn't check the DB.

### Dev server caches the generated client

After running `prisma generate` (or `prisma migrate dev`), the running Next.js dev server still has the **old** Prisma client in memory. New/renamed columns will throw `Unknown argument` errors until you **restart the dev server** (`Ctrl+C` → `yarn dev`).

### `prisma migrate dev` already regenerates the client

You don't need to run `prisma generate` separately after `prisma migrate dev` — it does both (migrate + generate). You only need a standalone `prisma generate` when pulling migrations from git without running `migrate dev`.
