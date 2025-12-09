/*
  Warnings:

  - Added the required column `type` to the `ProductAddon` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProductAddon` table without a default value. This is not possible if the table is not empty.
  - Made the column `slug` on table `ProductAddon` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'ACCESSORY';

-- AlterTable
ALTER TABLE "ProductAddon" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "inStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" "ProductType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "slug" SET NOT NULL;
