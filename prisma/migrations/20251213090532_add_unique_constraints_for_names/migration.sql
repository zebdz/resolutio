/*
  Warnings:

  - A unique constraint covering the columns `[name,organization_id]` on the table `boards` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `organizations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "boards_name_organization_id_key" ON "boards"("name", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");
