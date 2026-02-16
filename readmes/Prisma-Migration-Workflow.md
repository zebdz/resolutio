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

## Gotcha

If you use `db push`, the schema will have the model but there will be no migration file — production won't get the table. The build will succeed because `prisma generate` only reads the schema file, it doesn't check the DB.
