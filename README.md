# Gerdan Beaded Bags

## Telegram Bot For Artisan Production

Цей модуль додає облік виробітку через Telegram-бота в режимі `admin-only`.

### Що реалізовано

- Доступ до бота лише для user id з `TELEGRAM_PRODUCTION_ADMIN_USER_IDS`
- Покрокове внесення запису: майстер -> тип товару -> назва -> к-сть -> ставка -> відшкодовано
- Підтримка унікальних товарів, що не потрапляють у публічний каталог
- Збереження нараховано / відшкодовано / борг по кожному запису
- Часткове або повне відшкодування боргу через окрему команду
- Автоматичне створення `Expense` категорії `PAYROLL`, якщо відшкодовано > 0
- Кнопка/команда `Звіт` з агрегуванням по майстрах (відшкодовано, борг)

## Database Changes

Додано нові моделі:

- `Artisan`
- `AdminProduction`
- `AdminProductionSettlement`
- `TelegramBotSession`

Міграція:

- `prisma/migrations/20260424104727_add_telegram_artisan_production_bot/migration.sql`
- `prisma/migrations/20260514110000_add_admin_production_bot_ledger/migration.sql`

## Environment Variables

Обов'язкові:

- `TELEGRAM_PRODUCTION_BOT_TOKEN` - токен Telegram-бота для виробництва
- `TELEGRAM_PRODUCTION_ADMIN_USER_IDS` - список Telegram user id адмінів через кому (приклад: `12345678,98765432`)
- `TELEGRAM_BOT_TOKEN` - токен Telegram-бота для нотифікацій замовлень/передзамовлень
- `TELEGRAM_CHAT_ID` - chat id для нотифікацій замовлень/передзамовлень

Рекомендовані:

- `TELEGRAM_WEBHOOK_SECRET` - секрет для перевірки webhook header `x-telegram-bot-api-secret-token`

Для скрипта установки webhook:

- `TELEGRAM_WEBHOOK_BASE_URL` - публічна https адреса проєкту (приклад: `https://example.com`)
- `TELEGRAM_WEBHOOK_PATH` (optional) - дефолт: `/api/telegram/production/webhook`
- `TELEGRAM_PREORDER_CHAT_ID` (optional) - окремий chat id тільки для нотифікацій передзамовлень (fallback: `TELEGRAM_CHAT_ID`)

## Setup

1. Застосувати Prisma-міграції:

```bash
npx prisma migrate dev
```

2. Оновити Prisma client:

```bash
npx prisma generate
```

3. Встановити webhook:

```bash
npm run telegram:webhook:set
```

4. Перевірити endpoint:

```bash
GET /api/telegram/production/webhook
```

## Admin Commands

- `/start` або `/help` - підказка та меню
- `/new` - новий запис виробітку
- `/settle` - відшкодувати борг по конкретному запису
- `/report` - звіт по майстрах (нараховано / відшкодовано / борг)
- `/cancel` - скасувати поточний ввід

## Webhook Route

- `POST /api/telegram/production/webhook`
- `GET /api/telegram/production/webhook`

## Important Notes

- Якщо у записі вказано відшкодовану суму > 0, бот автоматично створює `Expense` категорії `PAYROLL`.
- Команда `/settle` створює окремий `Expense` і запис у `AdminProductionSettlement`.
- Для безпечної роботи в production обов'язково використовуйте `TELEGRAM_WEBHOOK_SECRET`.
- Бот по виробництву працює тільки на `TELEGRAM_PRODUCTION_BOT_TOKEN` (без fallback на інший токен).
