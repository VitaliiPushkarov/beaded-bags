-- CreateEnum
CREATE TYPE "ArtisanProductionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "ArtisanProductionSource" AS ENUM ('TELEGRAM_BOT', 'IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "TelegramBotSessionStep" AS ENUM ('IDLE', 'AWAITING_QTY', 'AWAITING_CONFIRM');

-- CreateTable
CREATE TABLE "Artisan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "telegramUserId" TEXT,
    "telegramChatId" TEXT,
    "telegramUsername" TEXT,
    "accessCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artisan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtisanRate" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ratePerUnitUAH" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtisanRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtisanProduction" (
    "id" TEXT NOT NULL,
    "artisanId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rateId" TEXT,
    "qty" INTEGER NOT NULL,
    "ratePerUnitSnapshotUAH" INTEGER NOT NULL,
    "totalLaborUAH" INTEGER NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ArtisanProductionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "source" "ArtisanProductionSource" NOT NULL DEFAULT 'TELEGRAM_BOT',
    "notes" TEXT,
    "telegramUpdateId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "approvedByTelegramUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtisanProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramBotSession" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "artisanId" TEXT,
    "step" "TelegramBotSessionStep" NOT NULL DEFAULT 'IDLE',
    "draftPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramBotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artisan_telegramUserId_key" ON "Artisan"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Artisan_telegramChatId_key" ON "Artisan"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "Artisan_accessCode_key" ON "Artisan"("accessCode");

-- CreateIndex
CREATE INDEX "Artisan_name_idx" ON "Artisan"("name");

-- CreateIndex
CREATE INDEX "Artisan_isActive_idx" ON "Artisan"("isActive");

-- CreateIndex
CREATE INDEX "ArtisanRate_artisanId_isActive_idx" ON "ArtisanRate"("artisanId", "isActive");

-- CreateIndex
CREATE INDEX "ArtisanRate_productId_isActive_idx" ON "ArtisanRate"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ArtisanRate_artisanId_productId_key" ON "ArtisanRate"("artisanId", "productId");

-- CreateIndex
CREATE INDEX "ArtisanProduction_artisanId_producedAt_idx" ON "ArtisanProduction"("artisanId", "producedAt");

-- CreateIndex
CREATE INDEX "ArtisanProduction_productId_producedAt_idx" ON "ArtisanProduction"("productId", "producedAt");

-- CreateIndex
CREATE INDEX "ArtisanProduction_status_producedAt_idx" ON "ArtisanProduction"("status", "producedAt");

-- CreateIndex
CREATE INDEX "ArtisanProduction_rateId_idx" ON "ArtisanProduction"("rateId");

-- CreateIndex
CREATE INDEX "ArtisanProduction_paidExpenseId_idx" ON "ArtisanProduction"("paidExpenseId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBotSession_chatId_key" ON "TelegramBotSession"("chatId");

-- CreateIndex
CREATE INDEX "TelegramBotSession_userId_idx" ON "TelegramBotSession"("userId");

-- CreateIndex
CREATE INDEX "TelegramBotSession_artisanId_idx" ON "TelegramBotSession"("artisanId");

-- AddForeignKey
ALTER TABLE "ArtisanRate" ADD CONSTRAINT "ArtisanRate_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanRate" ADD CONSTRAINT "ArtisanRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanProduction" ADD CONSTRAINT "ArtisanProduction_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanProduction" ADD CONSTRAINT "ArtisanProduction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanProduction" ADD CONSTRAINT "ArtisanProduction_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "ArtisanRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtisanProduction" ADD CONSTRAINT "ArtisanProduction_paidExpenseId_fkey" FOREIGN KEY ("paidExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramBotSession" ADD CONSTRAINT "TelegramBotSession_artisanId_fkey" FOREIGN KEY ("artisanId") REFERENCES "Artisan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
