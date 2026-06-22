CREATE TABLE "LiqPayCatalogMapping" (
    "id" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "liqpayGoodId" INTEGER NOT NULL,
    "itemName" TEXT,
    "priceUAH" INTEGER,
    "rawRow" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiqPayCatalogMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiqPayCatalogMapping_externalCode_key"
ON "LiqPayCatalogMapping"("externalCode");

CREATE INDEX "LiqPayCatalogMapping_liqpayGoodId_idx"
ON "LiqPayCatalogMapping"("liqpayGoodId");

CREATE INDEX "LiqPayCatalogMapping_syncedAt_idx"
ON "LiqPayCatalogMapping"("syncedAt");
