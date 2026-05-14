-- Create enum for admin production item classification
CREATE TYPE "AdminProductionItemType" AS ENUM ('CATALOG_VARIANT', 'CUSTOM_ITEM');

-- Create table for admin-entered production ledger
CREATE TABLE "AdminProduction" (
  "id" TEXT NOT NULL,
  "artisanId" TEXT NOT NULL,
  "itemType" "AdminProductionItemType" NOT NULL DEFAULT 'CUSTOM_ITEM',
  "itemLabel" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "ratePerUnitUAH" INTEGER NOT NULL,
  "totalLaborUAH" INTEGER NOT NULL,
  "settledAmountUAH" INTEGER NOT NULL DEFAULT 0,
  "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdByTelegramUserId" TEXT NOT NULL,
  "createdByTelegramChatId" TEXT NOT NULL,
  "paidExpenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminProduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminProduction_artisanId_producedAt_idx"
  ON "AdminProduction"("artisanId", "producedAt");

CREATE INDEX "AdminProduction_producedAt_idx"
  ON "AdminProduction"("producedAt");

CREATE INDEX "AdminProduction_paidExpenseId_idx"
  ON "AdminProduction"("paidExpenseId");

ALTER TABLE "AdminProduction"
  ADD CONSTRAINT "AdminProduction_artisanId_fkey"
  FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminProduction"
  ADD CONSTRAINT "AdminProduction_paidExpenseId_fkey"
  FOREIGN KEY ("paidExpenseId") REFERENCES "Expense"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create settlements table to support multiple partial debt reimbursements
CREATE TABLE "AdminProductionSettlement" (
  "id" TEXT NOT NULL,
  "adminProductionId" TEXT NOT NULL,
  "amountUAH" INTEGER NOT NULL,
  "notes" TEXT,
  "createdByTelegramUserId" TEXT NOT NULL,
  "createdByTelegramChatId" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminProductionSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminProductionSettlement_adminProductionId_createdAt_idx"
  ON "AdminProductionSettlement"("adminProductionId", "createdAt");

CREATE INDEX "AdminProductionSettlement_expenseId_idx"
  ON "AdminProductionSettlement"("expenseId");

ALTER TABLE "AdminProductionSettlement"
  ADD CONSTRAINT "AdminProductionSettlement_adminProductionId_fkey"
  FOREIGN KEY ("adminProductionId") REFERENCES "AdminProduction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminProductionSettlement"
  ADD CONSTRAINT "AdminProductionSettlement_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
