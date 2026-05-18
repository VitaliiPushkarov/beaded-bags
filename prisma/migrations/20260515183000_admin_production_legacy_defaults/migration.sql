-- Compatibility patch for legacy AdminProduction schema in production DB.
-- Older deployments may still have required columns from the previous bot-based shape.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdminProduction'
      AND column_name = 'itemLabel'
  ) THEN
    ALTER TABLE "AdminProduction"
      ALTER COLUMN "itemLabel" SET DEFAULT '';

    UPDATE "AdminProduction"
    SET "itemLabel" = ''
    WHERE "itemLabel" IS NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdminProduction'
      AND column_name = 'createdByTelegramUserId'
  ) THEN
    ALTER TABLE "AdminProduction"
      ALTER COLUMN "createdByTelegramUserId" SET DEFAULT 'admin-panel';

    UPDATE "AdminProduction"
    SET "createdByTelegramUserId" = 'admin-panel'
    WHERE "createdByTelegramUserId" IS NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdminProduction'
      AND column_name = 'createdByTelegramChatId'
  ) THEN
    ALTER TABLE "AdminProduction"
      ALTER COLUMN "createdByTelegramChatId" SET DEFAULT 'admin-panel';

    UPDATE "AdminProduction"
    SET "createdByTelegramChatId" = 'admin-panel'
    WHERE "createdByTelegramChatId" IS NULL;
  END IF;
END
$$;
