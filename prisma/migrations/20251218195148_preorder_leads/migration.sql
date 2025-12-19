-- CreateTable
CREATE TABLE "PreorderLead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "productSlug" TEXT,
    "productName" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "variantColor" TEXT,
    "strapId" TEXT,
    "contactName" TEXT,
    "contact" TEXT NOT NULL,
    "comment" TEXT,
    "source" TEXT,

    CONSTRAINT "PreorderLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreorderLead_createdAt_idx" ON "PreorderLead"("createdAt");

-- CreateIndex
CREATE INDEX "PreorderLead_productId_idx" ON "PreorderLead"("productId");

-- CreateIndex
CREATE INDEX "PreorderLead_variantId_idx" ON "PreorderLead"("variantId");
