/*
  Warnings:

  - A unique constraint covering the columns `[ownerId]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - Made the column `ownerId` on table `Tenant` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_ownerId_fkey";

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "ownerId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_ownerId_key" ON "Tenant"("ownerId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
