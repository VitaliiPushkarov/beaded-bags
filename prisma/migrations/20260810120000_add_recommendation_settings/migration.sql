-- Singleton config for the "You may also like" block on product pages: which
-- categories may appear for a product of a given category. Seeded to recommend
-- within the same category, which is narrower than the rule it replaces ("same
-- type OR same group"): products sharing BEADS or WEAVING no longer cross
-- categories automatically. Check more boxes in /admin/configuration to mix
-- categories deliberately.
CREATE TABLE "RecommendationSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "matrix" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "RecommendationSettings" ("id", "matrix", "updatedAt")
VALUES (
    1,
    '{"BAG":["BAG"],"BELT_BAG":["BELT_BAG"],"SHOPPER":["SHOPPER"],"CASE":["CASE"],"ACCESSORY":["ACCESSORY"]}'::jsonb,
    CURRENT_TIMESTAMP
);
