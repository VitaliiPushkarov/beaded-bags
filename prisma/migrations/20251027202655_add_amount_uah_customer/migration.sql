/*
  Warnings:

  - You are about to drop the column `items` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentRef` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `ttn` on the `Order` table. All the data in the column will be lost.
  - Added the required column `customerName` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerPhone` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalUAH` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalUAH` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "priceUAH" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amountUAH" INTEGER NOT NULL,
    "customer" JSONB NOT NULL,
    "paymentProvider" TEXT,
    "paymentId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "deliveryMethod" TEXT NOT NULL DEFAULT 'NP_WAREHOUSE',
    "npCityRef" TEXT,
    "npCityName" TEXT,
    "npWarehouseRef" TEXT,
    "npWarehouseText" TEXT,
    "subtotalUAH" INTEGER NOT NULL,
    "shippingUAH" INTEGER NOT NULL DEFAULT 0,
    "totalUAH" INTEGER NOT NULL
);
INSERT INTO "new_Order" ("amountUAH", "createdAt", "customer", "id", "status") SELECT "amountUAH", "createdAt", "customer", "id", "status" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
