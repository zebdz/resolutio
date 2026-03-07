-- AlterTable: add privacy fields with defaults
ALTER TABLE "users" ADD COLUMN "allow_find_by_name" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "allow_find_by_phone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "privacy_setup_completed" BOOLEAN NOT NULL DEFAULT false;

-- Add nickname column: first add as nullable, populate existing rows, then make NOT NULL
ALTER TABLE "users" ADD COLUMN "nickname" TEXT;

-- Generate unique nicknames for existing users
UPDATE "users" SET "nickname" = 'user_' || substr(md5(random()::text || id), 1, 8) WHERE "nickname" IS NULL;

-- Ensure uniqueness by appending extra chars if needed (handle any collisions)
UPDATE "users" u1 SET "nickname" = "nickname" || substr(md5(random()::text), 1, 4)
WHERE (SELECT count(*) FROM "users" u2 WHERE u2."nickname" = u1."nickname" AND u2."id" < u1."id") > 0;

-- Now make it NOT NULL and add unique constraint
ALTER TABLE "users" ALTER COLUMN "nickname" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateTable: privacy audit log
CREATE TABLE "user_privacy_audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "allow_find_by_name" BOOLEAN NOT NULL,
    "allow_find_by_phone" BOOLEAN NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_privacy_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_privacy_audit_log_user_id_idx" ON "user_privacy_audit_log"("user_id");

-- AddForeignKey
ALTER TABLE "user_privacy_audit_log" ADD CONSTRAINT "user_privacy_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
