-- Add localized EN fields and dedicated USD prices for storefront localization.
ALTER TABLE "Product"
ADD COLUMN "nameEn" TEXT,
ADD COLUMN "descriptionEn" TEXT,
ADD COLUMN "infoEn" TEXT,
ADD COLUMN "dimensionsEn" TEXT,
ADD COLUMN "offerNoteEn" TEXT,
ADD COLUMN "basePriceUSD" INTEGER;

ALTER TABLE "ProductVariant"
ADD COLUMN "colorEn" TEXT,
ADD COLUMN "priceUSD" INTEGER;
