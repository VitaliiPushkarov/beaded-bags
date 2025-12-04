/*
  Warnings:

  - A unique constraint covering the columns `[shortNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shortNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_shortNumber_key" ON "Order"("shortNumber");
