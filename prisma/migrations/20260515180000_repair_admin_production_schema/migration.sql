DO $$
BEGIN
  CREATE TYPE "AdminProductionItemType" AS ENUM ('CATALOG_VARIANT', 'CUSTOM_ITEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "AdminProduction" (
  "id" TEXT NOT NULL,
  "artisanId" TEXT NOT NULL,
  "itemType" "AdminProductionItemType" NOT NULL DEFAULT 'CATALOG_VARIANT',
  "productId" TEXT,
  "variantId" TEXT,
  "customItemName" TEXT,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "ratePerUnitUAH" INTEGER NOT NULL DEFAULT 0,
  "totalLaborUAH" INTEGER NOT NULL DEFAULT 0,
  "settledAmountUAH" INTEGER NOT NULL DEFAULT 0,
  "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "ArtisanProductionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "notes" TEXT,
  "paidAt" TIMESTAMP(3),
  "paidExpenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminProduction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "itemType" "AdminProductionItemType" NOT NULL DEFAULT 'CATALOG_VARIANT';
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "customItemName" TEXT;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "qty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "ratePerUnitUAH" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "totalLaborUAH" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "settledAmountUAH" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "status" "ArtisanProductionStatus" NOT NULL DEFAULT 'SUBMITTED';
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "paidExpenseId" TEXT;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AdminProduction" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AdminProduction" SET "qty" = 1 WHERE "qty" IS NULL;
UPDATE "AdminProduction" SET "ratePerUnitUAH" = 0 WHERE "ratePerUnitUAH" IS NULL;
UPDATE "AdminProduction" SET "totalLaborUAH" = 0 WHERE "totalLaborUAH" IS NULL;
UPDATE "AdminProduction" SET "settledAmountUAH" = 0 WHERE "settledAmountUAH" IS NULL;
UPDATE "AdminProduction" SET "producedAt" = CURRENT_TIMESTAMP WHERE "producedAt" IS NULL;
UPDATE "AdminProduction" SET "status" = 'SUBMITTED' WHERE "status" IS NULL;
UPDATE "AdminProduction" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "AdminProduction" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

ALTER TABLE "AdminProduction" ALTER COLUMN "qty" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "ratePerUnitUAH" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "totalLaborUAH" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "settledAmountUAH" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "producedAt" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "AdminProduction" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "AdminProductionSettlement" (
  "id" TEXT NOT NULL,
  "productionId" TEXT NOT NULL,
  "amountUAH" INTEGER NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "expenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminProductionSettlement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminProductionSettlement" ADD COLUMN IF NOT EXISTS "productionId" TEXT;
ALTER TABLE "AdminProductionSettlement" ADD COLUMN IF NOT EXISTS "amountUAH" INTEGER;
ALTER TABLE "AdminProductionSettlement" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AdminProductionSettlement" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "AdminProductionSettlement" ADD COLUMN IF NOT EXISTS "expenseId" TEXT;
ALTER TABLE "AdminProductionSettlement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "AdminProductionSettlement" SET "amountUAH" = 0 WHERE "amountUAH" IS NULL;
UPDATE "AdminProductionSettlement" SET "settledAt" = CURRENT_TIMESTAMP WHERE "settledAt" IS NULL;
UPDATE "AdminProductionSettlement" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;

ALTER TABLE "AdminProductionSettlement" ALTER COLUMN "amountUAH" SET NOT NULL;
ALTER TABLE "AdminProductionSettlement" ALTER COLUMN "settledAt" SET NOT NULL;
ALTER TABLE "AdminProductionSettlement" ALTER COLUMN "createdAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AdminProduction_artisanId_producedAt_idx" ON "AdminProduction"("artisanId", "producedAt");
CREATE INDEX IF NOT EXISTS "AdminProduction_itemType_producedAt_idx" ON "AdminProduction"("itemType", "producedAt");
CREATE INDEX IF NOT EXISTS "AdminProduction_productId_producedAt_idx" ON "AdminProduction"("productId", "producedAt");
CREATE INDEX IF NOT EXISTS "AdminProduction_variantId_producedAt_idx" ON "AdminProduction"("variantId", "producedAt");
CREATE INDEX IF NOT EXISTS "AdminProduction_status_producedAt_idx" ON "AdminProduction"("status", "producedAt");
CREATE INDEX IF NOT EXISTS "AdminProduction_paidExpenseId_idx" ON "AdminProduction"("paidExpenseId");

CREATE INDEX IF NOT EXISTS "AdminProductionSettlement_productionId_settledAt_idx" ON "AdminProductionSettlement"("productionId", "settledAt");
CREATE INDEX IF NOT EXISTS "AdminProductionSettlement_expenseId_idx" ON "AdminProductionSettlement"("expenseId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminProduction_artisanId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_artisanId_fkey"
      FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminProduction_productId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminProduction_variantId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminProduction_paidExpenseId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_paidExpenseId_fkey"
      FOREIGN KEY ("paidExpenseId") REFERENCES "Expense"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminProductionSettlement_productionId_fkey'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ADD CONSTRAINT "AdminProductionSettlement_productionId_fkey"
      FOREIGN KEY ("productionId") REFERENCES "AdminProduction"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminProductionSettlement_expenseId_fkey'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ADD CONSTRAINT "AdminProductionSettlement_expenseId_fkey"
      FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
