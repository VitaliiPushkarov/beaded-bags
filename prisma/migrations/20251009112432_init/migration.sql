-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "items" JSONB NOT NULL,
    "amountUAH" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customer" JSONB NOT NULL,
    "paymentRef" TEXT,
    "ttn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
