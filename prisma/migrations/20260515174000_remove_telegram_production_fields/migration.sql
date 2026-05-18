ALTER TABLE "Artisan"
DROP COLUMN IF EXISTS "telegramUserId",
DROP COLUMN IF EXISTS "telegramChatId",
DROP COLUMN IF EXISTS "telegramUsername",
DROP COLUMN IF EXISTS "accessCode";

ALTER TABLE "ArtisanProduction"
DROP COLUMN IF EXISTS "source",
DROP COLUMN IF EXISTS "telegramUpdateId",
DROP COLUMN IF EXISTS "approvedByTelegramUserId";

DROP TYPE IF EXISTS "ArtisanProductionSource";
