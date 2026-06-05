ALTER TABLE "ProductVariant"
ADD COLUMN "liqpayGoodId" INTEGER;

ALTER TABLE "ProductVariantStrap"
ADD COLUMN "liqpayGoodId" INTEGER;

ALTER TABLE "ProductVariantPouch"
ADD COLUMN "liqpayGoodId" INTEGER;

ALTER TABLE "ProductVariantSize"
ADD COLUMN "liqpayGoodId" INTEGER;

ALTER TABLE "OrderItem"
ADD COLUMN "strapId" TEXT,
ADD COLUMN "sizeId" TEXT,
ADD COLUMN "pouchId" TEXT;
