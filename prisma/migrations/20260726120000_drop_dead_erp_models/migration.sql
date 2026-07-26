-- Drop unused ERP models/columns.
--
-- ProductionBatch / ProductionBatchMaterial were never referenced by any
-- application code (production is tracked via AdminProduction). The child
-- table is dropped first to satisfy its foreign key to ProductionBatch.
DROP TABLE "ProductionBatchMaterial";
DROP TABLE "ProductionBatch";

-- ProductCostProfile.materialsCostUAH / packagingCostUAH were only ever
-- written by the legacy importer and ignored by the COGS calculation, which
-- derives materials cost live from ProductMaterial usages and packaging cost
-- from the PackagingTemplate. Existing values were backed up to
-- prisma/backups/dead-erp-data-*.json before this migration.
ALTER TABLE "ProductCostProfile" DROP COLUMN "materialsCostUAH",
DROP COLUMN "packagingCostUAH";
