-- CreateEnum
CREATE TYPE "ProductGroup" AS ENUM ('BEADS', 'WEAVING');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "group" "ProductGroup";

-- CreateIndex
CREATE INDEX "Product_group_idx" ON "Product"("group");
