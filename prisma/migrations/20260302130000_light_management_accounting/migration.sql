-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM (
  'ADS',
  'PACKAGING',
  'SHIPPING',
  'PAYMENT_FEES',
  'PAYROLL',
  'PHOTO',
  'SOFTWARE',
  'RENT',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM (
  'DRAFT',
  'ORDERED',
  'RECEIVED',
  'PAID',
  'CANCELLED'
);

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "grossProfitUAH" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "itemsCostUAH" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paymentFeeUAH" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem"
ADD COLUMN "discountUAH" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lineRevenueUAH" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalCostUAH" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "unitCostUAH" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductCostProfile" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "materialsCostUAH" INTEGER NOT NULL DEFAULT 0,
  "laborCostUAH" INTEGER NOT NULL DEFAULT 0,
  "packagingCostUAH" INTEGER NOT NULL DEFAULT 0,
  "shippingCostUAH" INTEGER NOT NULL DEFAULT 0,
  "otherCostUAH" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCostProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'UAH',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "invoiceNumber" TEXT,
  "subtotalUAH" INTEGER NOT NULL DEFAULT 0,
  "deliveryUAH" INTEGER NOT NULL DEFAULT 0,
  "totalUAH" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'pcs',
  "unitPriceUAH" INTEGER NOT NULL,
  "totalUAH" INTEGER NOT NULL,

  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "amountUAH" INTEGER NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCostProfile_productId_key" ON "ProductCostProfile"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_purchasedAt_idx" ON "Purchase"("supplierId", "purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_status_purchasedAt_idx" ON "Purchase"("status", "purchasedAt");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_category_idx" ON "Expense"("expenseDate", "category");

-- AddForeignKey
ALTER TABLE "ProductCostProfile"
ADD CONSTRAINT "ProductCostProfile_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase"
ADD CONSTRAINT "Purchase_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem"
ADD CONSTRAINT "PurchaseItem_purchaseId_fkey"
FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
