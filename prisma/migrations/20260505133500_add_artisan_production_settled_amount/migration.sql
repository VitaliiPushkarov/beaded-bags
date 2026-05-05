ALTER TABLE "ArtisanProduction"
ADD COLUMN "settledAmountUAH" INTEGER NOT NULL DEFAULT 0;

UPDATE "ArtisanProduction"
SET "settledAmountUAH" = "totalLaborUAH"
WHERE "status" = 'PAID';
