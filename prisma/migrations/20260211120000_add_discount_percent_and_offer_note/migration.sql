ALTER TABLE "Product"
ADD COLUMN "offerNote" TEXT;

ALTER TABLE "ProductVariant"
ADD COLUMN "discountPercent" INTEGER DEFAULT 0;
