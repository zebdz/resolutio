/*
  Warnings:

  - The primary key for the `board_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `board_users` table. All the data in the column will be lost.
  - The primary key for the `organization_admin_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `organization_admin_users` table. All the data in the column will be lost.
  - The primary key for the `superadmins` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `superadmins` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "board_users_board_id_user_id_key";

-- DropIndex
DROP INDEX "organization_admin_users_organization_id_user_id_key";

-- DropIndex
DROP INDEX "superadmins_user_id_key";

-- AlterTable
ALTER TABLE "board_users" DROP CONSTRAINT "board_users_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "board_users_pkey" PRIMARY KEY ("board_id", "user_id");

-- AlterTable
ALTER TABLE "organization_admin_users" DROP CONSTRAINT "organization_admin_users_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "organization_admin_users_pkey" PRIMARY KEY ("organization_id", "user_id");

-- AlterTable
ALTER TABLE "superadmins" DROP CONSTRAINT "superadmins_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "superadmins_pkey" PRIMARY KEY ("user_id");
