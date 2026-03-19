-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM (
  'BEADS',
  'THREADS',
  'STRAPS',
  'FABRIC',
  'HARDWARE',
  'CORDS'
);

-- AlterTable
ALTER TABLE "Material"
ADD COLUMN "category" "MaterialCategory" NOT NULL DEFAULT 'HARDWARE',
ADD COLUMN "color" TEXT NOT NULL DEFAULT '';

-- Replace old uniqueness by name with composite uniqueness for material variants
DROP INDEX IF EXISTS "Material_name_key";
CREATE UNIQUE INDEX "Material_name_category_color_key" ON "Material"("name", "category", "color");
CREATE INDEX "Material_category_idx" ON "Material"("category");
CREATE INDEX "Material_name_idx" ON "Material"("name");

-- AlterTable
ALTER TABLE "ProductMaterial"
ADD COLUMN "variantColor" TEXT NOT NULL DEFAULT '';

-- Replace old unique key with scoped key (product + material + variant color)
DROP INDEX IF EXISTS "ProductMaterial_productId_materialId_key";
CREATE UNIQUE INDEX "ProductMaterial_productId_materialId_variantColor_key"
ON "ProductMaterial"("productId", "materialId", "variantColor");
CREATE INDEX "ProductMaterial_productId_variantColor_idx"
ON "ProductMaterial"("productId", "variantColor");
