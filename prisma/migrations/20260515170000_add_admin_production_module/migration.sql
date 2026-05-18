DO $$
BEGIN
  CREATE TYPE "AdminProductionItemType" AS ENUM ('CATALOG_VARIANT', 'CUSTOM_ITEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminProduction" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "itemType" "AdminProductionItemType" NOT NULL DEFAULT 'CATALOG_VARIANT',
    "productId" TEXT,
    "variantId" TEXT,
    "customItemName" TEXT,
    "qty" INTEGER NOT NULL,
    "ratePerUnitUAH" INTEGER NOT NULL,
    "totalLaborUAH" INTEGER NOT NULL,
    "settledAmountUAH" INTEGER NOT NULL DEFAULT 0,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ArtisanProductionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProduction_artisanId_producedAt_idx" ON "AdminProduction"("artisanId", "producedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProduction_itemType_producedAt_idx" ON "AdminProduction"("itemType", "producedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProduction_productId_producedAt_idx" ON "AdminProduction"("productId", "producedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProduction_variantId_producedAt_idx" ON "AdminProduction"("variantId", "producedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProduction_status_producedAt_idx" ON "AdminProduction"("status", "producedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProduction_paidExpenseId_idx" ON "AdminProduction"("paidExpenseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProductionSettlement_productionId_settledAt_idx" ON "AdminProductionSettlement"("productionId", "settledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminProductionSettlement_expenseId_idx" ON "AdminProductionSettlement"("expenseId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminProduction_artisanId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_artisanId_fkey"
      FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminProduction_productId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminProduction_variantId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminProduction_paidExpenseId_fkey'
  ) THEN
    ALTER TABLE "AdminProduction"
      ADD CONSTRAINT "AdminProduction_paidExpenseId_fkey"
      FOREIGN KEY ("paidExpenseId") REFERENCES "Expense"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminProductionSettlement_productionId_fkey'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ADD CONSTRAINT "AdminProductionSettlement_productionId_fkey"
      FOREIGN KEY ("productionId") REFERENCES "AdminProduction"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdminProductionSettlement_expenseId_fkey'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ADD CONSTRAINT "AdminProductionSettlement_expenseId_fkey"
      FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
