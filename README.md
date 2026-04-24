# Gerdan Beaded Bags

## Telegram Bot For Artisan Production

Цей модуль додає облік виробітку майстрів через Telegram-бота без використання адмін-панелі.

### Що реалізовано

- Реєстрація майстра в боті через код (`/register CODE`)
- Фіксація виробітку майстром (`/record`)
- Автопідтягування ставки за 1 шт (ставка прив'язана до `майстер + виріб`)
- Підтвердження/відхилення запису власником через inline-кнопки
- Фіксація виплати власником з автозаписом у `Expense` (`PAYROLL`)
- Базові звіти для майстра (`/my`) і власника (`/report`)

## Database Changes

Додано нові моделі:

- `Artisan`
- `ArtisanRate`
- `ArtisanProduction`
- `TelegramBotSession`

Міграція:

- `prisma/migrations/20260424104727_add_telegram_artisan_production_bot/migration.sql`

## Environment Variables

Обов'язкові:

- `TELEGRAM_PRODUCTION_BOT_TOKEN` - токен Telegram-бота для виробництва (рекомендовано окремий бот)
- `TELEGRAM_BOT_TOKEN` - fallback токен, якщо `TELEGRAM_PRODUCTION_BOT_TOKEN` не задано
- `TELEGRAM_OWNER_USER_IDS` - Telegram user id власників, через кому (приклад: `12345,67890`)

Рекомендовані:

- `TELEGRAM_WEBHOOK_SECRET` - секрет для перевірки webhook header `x-telegram-bot-api-secret-token`
- `TELEGRAM_PRODUCTION_OWNER_CHAT_IDS` - (optional) chat ids, куди надсилати заявки на підтвердження (через кому)

Для скрипта установки webhook:

- `TELEGRAM_WEBHOOK_BASE_URL` - публічна https адреса проєкту (приклад: `https://example.com`)
- `TELEGRAM_WEBHOOK_PATH` (optional) - дефолт: `/api/telegram/production/webhook`

Примітка: якщо `TELEGRAM_PRODUCTION_OWNER_CHAT_IDS` не задано, бот також використовує чати, де owner (з `TELEGRAM_OWNER_USER_IDS`) вже запускав команди (`/pending`, `/report`, `/help`).
Як fallback додатково використовується `TELEGRAM_CHAT_ID`.

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

## Owner Commands

- `/new_master Ім'я Прізвище` - створити майстра та отримати CODE
- `/masters` - список майстрів
- `/set_rate CODE PRODUCT_SLUG RATE` - встановити ставку
- `/disable_rate CODE PRODUCT_SLUG` - вимкнути ставку
- `/rates CODE` - показати ставки майстра
- `/products [query]` - список товарів і slug
- `/pending` - записи у статусі `SUBMITTED`
- `/report` - зведення за поточний місяць

## Artisan Commands

- `/register CODE` - прив'язати Telegram до майстра
- `/record` - фіксація виробітку (виріб -> кількість -> підтвердження)
- `/my` - мій звіт за поточний місяць
- `/help` - підказка

## Webhook Route

- `POST /api/telegram/production/webhook`
- `GET /api/telegram/production/webhook`

## Important Notes

- Оплата запису (`PAID`) автоматично створює `Expense` категорії `PAYROLL`.
- Для безпечної роботи в production обов'язково використовуйте `TELEGRAM_WEBHOOK_SECRET`.
- Власники визначаються тільки через `TELEGRAM_OWNER_USER_IDS`.
- Якщо не задавати `TELEGRAM_PRODUCTION_BOT_TOKEN`, production-бот працюватиме на `TELEGRAM_BOT_TOKEN`.
