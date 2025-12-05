-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sortBestsellers" INTEGER,
ADD COLUMN     "sortCatalog" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sortSlider" INTEGER;
