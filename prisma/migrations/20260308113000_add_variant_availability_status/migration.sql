-- Create enum for tri-state variant availability
CREATE TYPE "AvailabilityStatus" AS ENUM ('IN_STOCK', 'PREORDER', 'OUT_OF_STOCK');

-- Add new status column with a safe default
ALTER TABLE "ProductVariant"
ADD COLUMN "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'IN_STOCK';

-- Backfill from legacy boolean logic:
-- false used to mean "available for preorder"
UPDATE "ProductVariant"
SET "availabilityStatus" = CASE
  WHEN "inStock" = true THEN 'IN_STOCK'::"AvailabilityStatus"
  ELSE 'PREORDER'::"AvailabilityStatus"
END;
