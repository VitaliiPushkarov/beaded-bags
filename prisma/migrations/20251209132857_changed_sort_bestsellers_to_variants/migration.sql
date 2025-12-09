/*
  Warnings:

  - You are about to drop the column `sortBestsellers` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "sortBestsellers";

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "sortBestsellers" INTEGER DEFAULT 0;
