ALTER TABLE "Order"
ADD COLUMN "checkoutSessionKey" TEXT;

CREATE UNIQUE INDEX "Order_checkoutSessionKey_key"
ON "Order"("checkoutSessionKey");
