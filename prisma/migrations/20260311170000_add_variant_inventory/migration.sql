-- CreateTable
CREATE TABLE "ProductVariantInventory" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "finishedGoodsQty" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantInventory_variantId_key" ON "ProductVariantInventory"("variantId");

-- AddForeignKey
ALTER TABLE "ProductVariantInventory"
ADD CONSTRAINT "ProductVariantInventory_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from product-level inventory:
-- for each product inventory row, move qty to the first variant (catalog order).
INSERT INTO "ProductVariantInventory" (
  "id",
  "variantId",
  "finishedGoodsQty",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy-', v."id") AS "id",
  v."id" AS "variantId",
  pi."finishedGoodsQty",
  pi."notes",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductInventory" pi
JOIN LATERAL (
  SELECT pv."id"
  FROM "ProductVariant" pv
  WHERE pv."productId" = pi."productId"
  ORDER BY COALESCE(pv."sortCatalog", 0) ASC, pv."id" ASC
  LIMIT 1
) v ON TRUE
ON CONFLICT ("variantId") DO NOTHING;
