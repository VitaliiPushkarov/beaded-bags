-- Straps offered per pouch, for variants running the pouch+strap configurator.
-- No price and no fiscal ID by design: this customisation never changes the
-- total, so it produces no ПРРО component.
CREATE TABLE "ProductVariantPouchStrap" (
    "id" TEXT NOT NULL,
    "pouchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "mainImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariantPouchStrap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantPouchStrap_pouchId_sort_idx"
ON "ProductVariantPouchStrap"("pouchId", "sort");

ALTER TABLE "ProductVariantPouchStrap"
ADD CONSTRAINT "ProductVariantPouchStrap_pouchId_fkey"
FOREIGN KEY ("pouchId") REFERENCES "ProductVariantPouch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProductVariantPouchStrapImage" (
    "id" TEXT NOT NULL,
    "pouchStrapId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariantPouchStrapImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductVariantPouchStrapImage_pouchStrapId_sort_idx"
ON "ProductVariantPouchStrapImage"("pouchStrapId", "sort");

ALTER TABLE "ProductVariantPouchStrapImage"
ADD CONSTRAINT "ProductVariantPouchStrapImage_pouchStrapId_fkey"
FOREIGN KEY ("pouchStrapId") REFERENCES "ProductVariantPouchStrap"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Opt-in flag: which variants run the new configurator.
ALTER TABLE "ProductVariant"
ADD COLUMN "pouchStrapCustomization" BOOLEAN NOT NULL DEFAULT false;

-- Records which pouch-strap an order line was configured with. Separate from
-- strapId, which points at ProductVariantStrap.
ALTER TABLE "OrderItem" ADD COLUMN "pouchStrapId" TEXT;
