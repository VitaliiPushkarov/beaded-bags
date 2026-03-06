-- AlterTable
ALTER TABLE "Material"
ADD COLUMN "unitCostUAH" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "packagingTemplateId" TEXT;

-- CreateTable
CREATE TABLE "PackagingTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "costUAH" INTEGER NOT NULL DEFAULT 0,
  "boxLabel" TEXT,
  "tissuePaperQty" INTEGER NOT NULL DEFAULT 1,
  "tagCardQty" INTEGER NOT NULL DEFAULT 1,
  "tagThreadQty" INTEGER NOT NULL DEFAULT 1,
  "roundStickerQty" INTEGER NOT NULL DEFAULT 1,
  "squareStickerQty" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PackagingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "producedAt" TIMESTAMP(3) NOT NULL,
  "qty" INTEGER NOT NULL,
  "laborTotalUAH" INTEGER NOT NULL DEFAULT 0,
  "laborPerUnitUAH" INTEGER NOT NULL DEFAULT 0,
  "materialsTotalUAH" INTEGER NOT NULL DEFAULT 0,
  "packagingTotalUAH" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatchMaterial" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "qtyUsed" DOUBLE PRECISION NOT NULL,
  "unitCostUAH" INTEGER NOT NULL DEFAULT 0,
  "totalCostUAH" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionBatchMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackagingTemplate_name_key" ON "PackagingTemplate"("name");

-- CreateIndex
CREATE INDEX "Product_packagingTemplateId_idx" ON "Product"("packagingTemplateId");

-- CreateIndex
CREATE INDEX "ProductionBatch_producedAt_idx" ON "ProductionBatch"("producedAt");

-- CreateIndex
CREATE INDEX "ProductionBatch_productId_producedAt_idx" ON "ProductionBatch"("productId", "producedAt");

-- CreateIndex
CREATE INDEX "ProductionBatchMaterial_batchId_idx" ON "ProductionBatchMaterial"("batchId");

-- CreateIndex
CREATE INDEX "ProductionBatchMaterial_materialId_idx" ON "ProductionBatchMaterial"("materialId");

-- AddForeignKey
ALTER TABLE "Product"
ADD CONSTRAINT "Product_packagingTemplateId_fkey"
FOREIGN KEY ("packagingTemplateId") REFERENCES "PackagingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch"
ADD CONSTRAINT "ProductionBatch_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchMaterial"
ADD CONSTRAINT "ProductionBatchMaterial_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchMaterial"
ADD CONSTRAINT "ProductionBatchMaterial_materialId_fkey"
FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
