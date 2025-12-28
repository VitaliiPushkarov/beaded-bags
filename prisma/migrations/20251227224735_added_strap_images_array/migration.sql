-- CreateTable
CREATE TABLE "ProductVariantStrapImage" (
    "id" TEXT NOT NULL,
    "strapId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantStrapImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductVariantStrapImage" ADD CONSTRAINT "ProductVariantStrapImage_strapId_fkey" FOREIGN KEY ("strapId") REFERENCES "ProductVariantStrap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
