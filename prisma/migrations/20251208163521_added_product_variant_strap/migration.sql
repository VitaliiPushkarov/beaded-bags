-- CreateTable
CREATE TABLE "ProductVariantStrap" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "imageUrl" TEXT,
    "mainImageUrl" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantStrap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariantStrap_variantId_sort_idx" ON "ProductVariantStrap"("variantId", "sort");

-- AddForeignKey
ALTER TABLE "ProductVariantStrap" ADD CONSTRAINT "ProductVariantStrap_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
