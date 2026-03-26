-- Add variant attributes for step-by-step product configuration.
ALTER TABLE "ProductVariant"
ADD COLUMN "modelSize" TEXT,
ADD COLUMN "pouchColor" TEXT;

-- Persist variant attributes in order item snapshots.
ALTER TABLE "OrderItem"
ADD COLUMN "modelSize" TEXT,
ADD COLUMN "pouchColor" TEXT;

-- Speed up PDP filtering by color/size/pouch for a product.
CREATE INDEX "ProductVariant_productId_color_modelSize_pouchColor_idx"
ON "ProductVariant"("productId", "color", "modelSize", "pouchColor");
