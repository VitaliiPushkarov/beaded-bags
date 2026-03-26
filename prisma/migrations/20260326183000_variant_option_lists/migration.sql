-- Variant-level pouch options (color + upcharge + media)
CREATE TABLE "ProductVariantPouch" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "extraPriceUAH" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "mainImageUrl" TEXT,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariantPouch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantPouchImage" (
  "id" TEXT NOT NULL,
  "pouchId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariantPouchImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantPouch_variantId_sort_idx"
ON "ProductVariantPouch"("variantId", "sort");

ALTER TABLE "ProductVariantPouch"
ADD CONSTRAINT "ProductVariantPouch_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantPouchImage"
ADD CONSTRAINT "ProductVariantPouchImage_pouchId_fkey"
FOREIGN KEY ("pouchId") REFERENCES "ProductVariantPouch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Variant-level size options (size + upcharge + media)
CREATE TABLE "ProductVariantSize" (
  "id" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "extraPriceUAH" INTEGER NOT NULL DEFAULT 0,
  "imageUrl" TEXT,
  "mainImageUrl" TEXT,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariantSize_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantSizeImage" (
  "id" TEXT NOT NULL,
  "sizeId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductVariantSizeImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantSize_variantId_sort_idx"
ON "ProductVariantSize"("variantId", "sort");

ALTER TABLE "ProductVariantSize"
ADD CONSTRAINT "ProductVariantSize_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantSizeImage"
ADD CONSTRAINT "ProductVariantSizeImage_sizeId_fkey"
FOREIGN KEY ("sizeId") REFERENCES "ProductVariantSize"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
