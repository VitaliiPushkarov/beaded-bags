-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill existing products as published to avoid visibility regressions
UPDATE "Product"
SET "status" = 'PUBLISHED';

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");
