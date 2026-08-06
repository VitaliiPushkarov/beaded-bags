CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "minOrderUAH" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "showAfterOrder" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

CREATE INDEX "PromoCode_isActive_endsAt_idx" ON "PromoCode"("isActive", "endsAt");

CREATE INDEX "PromoCode_showAfterOrder_isActive_idx"
ON "PromoCode"("showAfterOrder", "isActive");

ALTER TABLE "Order" ADD COLUMN "promoCode" TEXT;

-- Carry over the two codes that were hardcoded in src/lib/promo.ts so existing
-- links and printed cards keep working after the switch to database-backed
-- validation. SPECIAL is the one shown after a successful order.
INSERT INTO "PromoCode" ("id", "code", "discountPercent", "isActive", "showAfterOrder", "note", "createdAt", "updatedAt")
VALUES
    ('promo_seed_special', 'SPECIAL', 10, true, true, 'Перенесено з коду (src/lib/promo.ts)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('promo_seed_gerdan10', 'GERDAN10', 10, true, false, 'Перенесено з коду (src/lib/promo.ts)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
