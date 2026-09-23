CREATE TYPE "OrderEmailKind" AS ENUM ('PAID', 'AWAITING_PAYMENT');

CREATE TABLE "OrderEmailSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "templates" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderEmailSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderEmailDelivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OrderEmailKind" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lockToken" TEXT,
    "sentAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderEmailDelivery_orderId_kind_key" ON "OrderEmailDelivery"("orderId", "kind");
CREATE INDEX "OrderEmailDelivery_sentAt_skippedAt_nextAttemptAt_idx" ON "OrderEmailDelivery"("sentAt", "skippedAt", "nextAttemptAt");
ALTER TABLE "OrderEmailDelivery" ADD CONSTRAINT "OrderEmailDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
