/*
  Warnings:

  - You are about to drop the column `addonId` on the `ProductVariantAddon` table. All the data in the column will be lost.
  - You are about to drop the `ProductAddon` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[variantId,addonVariantId]` on the table `ProductVariantAddon` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `addonVariantId` to the `ProductVariantAddon` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ProductVariantAddon" DROP CONSTRAINT "ProductVariantAddon_addonId_fkey";

-- DropIndex
DROP INDEX "ProductVariantAddon_variantId_addonId_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isAddon" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductVariantAddon" DROP COLUMN "addonId",
ADD COLUMN     "addonVariantId" TEXT NOT NULL,
ADD COLUMN     "sort" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ProductAddon";

-- CreateIndex
CREATE INDEX "ProductVariantAddon_variantId_sort_idx" ON "ProductVariantAddon"("variantId", "sort");

-- CreateIndex
CREATE INDEX "ProductVariantAddon_addonVariantId_idx" ON "ProductVariantAddon"("addonVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantAddon_variantId_addonVariantId_key" ON "ProductVariantAddon"("variantId", "addonVariantId");

-- AddForeignKey
ALTER TABLE "ProductVariantAddon" ADD CONSTRAINT "ProductVariantAddon_addonVariantId_fkey" FOREIGN KEY ("addonVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
