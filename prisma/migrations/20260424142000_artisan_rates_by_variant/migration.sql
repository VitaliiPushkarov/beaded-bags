-- Drop old foreign key/indexes for product-level artisan rates
ALTER TABLE "ArtisanRate" DROP CONSTRAINT IF EXISTS "ArtisanRate_productId_fkey";
DROP INDEX IF EXISTS "ArtisanRate_artisanId_productId_key";
DROP INDEX IF EXISTS "ArtisanRate_productId_isActive_idx";

-- Add variant references (temporarily nullable for data backfill)
ALTER TABLE "ArtisanRate" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "ArtisanProduction" ADD COLUMN IF NOT EXISTS "variantId" TEXT;

-- Backfill existing rates: map each product-level rate to the first variant of that product
UPDATE "ArtisanRate" ar
SET "variantId" = (
  SELECT pv."id"
  FROM "ProductVariant" pv
  WHERE pv."productId" = ar."productId"
  ORDER BY COALESCE(pv."sortCatalog", 0) ASC, pv."id" ASC
  LIMIT 1
)
WHERE ar."variantId" IS NULL;

-- Expand legacy product-level rates to all variants of the product
INSERT INTO "ArtisanRate" (
  "id",
  "artisanId",
  "variantId",
  "ratePerUnitUAH",
  "isActive",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT(ar."id", ':', pv."id") AS "id",
  ar."artisanId",
  pv."id" AS "variantId",
  ar."ratePerUnitUAH",
  ar."isActive",
  ar."notes",
  ar."createdAt",
  ar."updatedAt"
FROM "ArtisanRate" ar
JOIN "ProductVariant" pv ON pv."productId" = ar."productId"
WHERE ar."variantId" IS NOT NULL
  AND pv."id" <> ar."variantId"
ON CONFLICT ("id") DO NOTHING;

-- Ensure uniqueness by artisan+variant for expanded legacy rows
DELETE FROM "ArtisanRate" a
USING "ArtisanRate" b
WHERE a."id" > b."id"
  AND a."artisanId" = b."artisanId"
  AND a."variantId" = b."variantId";

-- Backfill production records from linked rate first
UPDATE "ArtisanProduction" ap
SET "variantId" = ar."variantId"
FROM "ArtisanRate" ar
WHERE ap."variantId" IS NULL
  AND ap."rateId" IS NOT NULL
  AND ap."rateId" = ar."id";

-- Fallback: map production to the first variant of its product
UPDATE "ArtisanProduction" ap
SET "variantId" = (
  SELECT pv."id"
  FROM "ProductVariant" pv
  WHERE pv."productId" = ap."productId"
  ORDER BY COALESCE(pv."sortCatalog", 0) ASC, pv."id" ASC
  LIMIT 1
)
WHERE ap."variantId" IS NULL;

-- Safety checks before NOT NULL constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ArtisanRate" WHERE "variantId" IS NULL) THEN
    RAISE EXCEPTION 'ArtisanRate.variantId backfill failed for some rows';
  END IF;

  IF EXISTS (SELECT 1 FROM "ArtisanProduction" WHERE "variantId" IS NULL) THEN
    RAISE EXCEPTION 'ArtisanProduction.variantId backfill failed for some rows';
  END IF;
END $$;

-- Make variant links required
ALTER TABLE "ArtisanRate" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "ArtisanProduction" ALTER COLUMN "variantId" SET NOT NULL;

-- Remove old product-level field from rates
ALTER TABLE "ArtisanRate" DROP COLUMN IF EXISTS "productId";

-- New indexes/constraints for variant-level model
CREATE INDEX IF NOT EXISTS "ArtisanProduction_variantId_producedAt_idx"
  ON "ArtisanProduction"("variantId", "producedAt");

CREATE INDEX IF NOT EXISTS "ArtisanRate_variantId_isActive_idx"
  ON "ArtisanRate"("variantId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "ArtisanRate_artisanId_variantId_key"
  ON "ArtisanRate"("artisanId", "variantId");

-- New foreign keys
ALTER TABLE "ArtisanRate"
  ADD CONSTRAINT "ArtisanRate_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArtisanProduction"
  ADD CONSTRAINT "ArtisanProduction_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
