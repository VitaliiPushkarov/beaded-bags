ALTER TABLE "ProductVariant"
ADD COLUMN "showInNewArrivals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortNewArrivals" INTEGER NOT NULL DEFAULT 0;

WITH per_product AS (
  SELECT
    p.id AS product_id,
    p."createdAt" AS product_created_at,
    pv.id AS variant_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.id
      ORDER BY
        CASE WHEN COALESCE(pv."sortBestsellers", 0) > 0 THEN 0 ELSE 1 END,
        CASE
          WHEN COALESCE(pv."sortBestsellers", 0) > 0
            THEN COALESCE(pv."sortBestsellers", 2147483647)
          ELSE 2147483647
        END,
        COALESCE(pv."sortCatalog", 0),
        pv.id
    ) AS variant_rank
  FROM "Product" p
  JOIN "ProductVariant" pv ON pv."productId" = p.id
  WHERE p."showInNewArrivals" = true
),
selected AS (
  SELECT
    product_id,
    product_created_at,
    variant_id
  FROM per_product
  WHERE variant_rank = 1
),
ordered AS (
  SELECT
    variant_id,
    ROW_NUMBER() OVER (ORDER BY product_created_at DESC, variant_id ASC) AS new_pos
  FROM selected
)
UPDATE "ProductVariant" pv
SET
  "showInNewArrivals" = true,
  "sortNewArrivals" = ordered.new_pos
FROM ordered
WHERE pv.id = ordered.variant_id;

ALTER TABLE "Product"
DROP COLUMN "showInNewArrivals";

CREATE INDEX "ProductVariant_showInNewArrivals_sortNewArrivals_idx"
ON "ProductVariant"("showInNewArrivals", "sortNewArrivals");
