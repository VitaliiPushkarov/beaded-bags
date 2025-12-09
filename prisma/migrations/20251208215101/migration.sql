/*
  Warnings:

  - You are about to drop the `ProductAddonOnProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductAddonOnProduct" DROP CONSTRAINT "ProductAddonOnProduct_addonId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAddonOnProduct" DROP CONSTRAINT "ProductAddonOnProduct_productId_fkey";

-- DropTable
DROP TABLE "ProductAddonOnProduct";

-- CreateTable
CREATE TABLE "ProductVariantAddon" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantAddon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantAddon_variantId_addonId_key" ON "ProductVariantAddon"("variantId", "addonId");

-- AddForeignKey
ALTER TABLE "ProductVariantAddon" ADD CONSTRAINT "ProductVariantAddon_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantAddon" ADD CONSTRAINT "ProductVariantAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ProductAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
