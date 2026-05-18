-- Compatibility patch for legacy AdminProductionSettlement shape.
-- In some DBs this table still has old required columns from telegram flow.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdminProductionSettlement'
      AND column_name = 'adminProductionId'
  ) THEN
    UPDATE "AdminProductionSettlement"
    SET "adminProductionId" = "productionId"
    WHERE "adminProductionId" IS NULL
      AND "productionId" IS NOT NULL;

    ALTER TABLE "AdminProductionSettlement"
      ALTER COLUMN "adminProductionId" DROP NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdminProductionSettlement'
      AND column_name = 'createdByTelegramUserId'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ALTER COLUMN "createdByTelegramUserId" SET DEFAULT 'admin-panel';

    UPDATE "AdminProductionSettlement"
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
      AND table_name = 'AdminProductionSettlement'
      AND column_name = 'createdByTelegramChatId'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ALTER COLUMN "createdByTelegramChatId" SET DEFAULT 'admin-panel';

    UPDATE "AdminProductionSettlement"
    SET "createdByTelegramChatId" = 'admin-panel'
    WHERE "createdByTelegramChatId" IS NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AdminProductionSettlement'
      AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "AdminProductionSettlement"
      ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

    UPDATE "AdminProductionSettlement"
    SET "updatedAt" = CURRENT_TIMESTAMP
    WHERE "updatedAt" IS NULL;
  END IF;
END
$$;
