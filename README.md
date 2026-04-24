# Gerdan Beaded Bags

## Telegram Bot For Artisan Production

Цей модуль додає облік виробітку майстрів через Telegram-бота без використання адмін-панелі.

### Що реалізовано

- Реєстрація майстра в боті через код (`/register CODE`)
- Фіксація виробітку майстром (`/record` -> `/qty N` -> підтвердження)
- Автопідтягування ставки за 1 шт (ставка прив'язана до `майстер + варіант товару`)
- Підтвердження/відхилення запису власником через inline-кнопки
- Фіксація виплати власником з автозаписом у `Expense` (`PAYROLL`)
- Базові звіти для майстра (`/my`) і власника (`/report`)
- Підтримка роботи в одній Telegram-групі для майстрів і власників
- Вбудоване кнопкове меню (reply keyboard) для швидкого доступу без ручного вводу команд

## Database Changes

Додано нові моделі:

- `Artisan`
- `ArtisanRate`
- `ArtisanProduction`
- `TelegramBotSession`

Міграція:

- `prisma/migrations/20260424104727_add_telegram_artisan_production_bot/migration.sql`
- `prisma/migrations/20260424142000_artisan_rates_by_variant/migration.sql`

## Environment Variables

Обов'язкові:

- `TELEGRAM_PRODUCTION_BOT_TOKEN` - токен Telegram-бота для виробництва
- `TELEGRAM_OWNER_USER_IDS` - Telegram user id власників, через кому (приклад: `12345,67890`)

Рекомендовані:

- `TELEGRAM_WEBHOOK_SECRET` - секрет для перевірки webhook header `x-telegram-bot-api-secret-token`

Для скрипта установки webhook:

- `TELEGRAM_WEBHOOK_BASE_URL` - публічна https адреса проєкту (приклад: `https://example.com`)
- `TELEGRAM_WEBHOOK_PATH` (optional) - дефолт: `/api/telegram/production/webhook`

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
- `/set_rate CODE VARIANT_ID RATE` - встановити ставку на конкретний варіант
- `/set_rate_bulk CODE RATE id1,id2,...` - масово встановити ставку на список VARIANT_ID
- `/disable_rate CODE VARIANT_ID` - вимкнути ставку для варіанту
- `/rates CODE` - показати ставки майстра
- `/rates_menu` - керування ставками через кнопки (вибір майстра/варіанту без ручного вводу довгих команд)
- `/products [query]` - список товарів і slug
- `/variants [query]` - список варіантів з `VARIANT_ID` для команд ставок
- `/pending` - записи у статусі `SUBMITTED`
- `/report` - зведення за поточний місяць

## Artisan Commands

- `/register CODE` - прив'язати Telegram до майстра
- `/record` - вибір варіанту
- `/qty N` - ввести кількість (наприклад, `/qty 6`)
- `/my` - мій звіт за поточний місяць
- `/help` - підказка

## Webhook Route

- `POST /api/telegram/production/webhook`
- `GET /api/telegram/production/webhook`

## Important Notes

- Оплата запису (`PAID`) автоматично створює `Expense` категорії `PAYROLL`.
- Для безпечної роботи в production обов'язково використовуйте `TELEGRAM_WEBHOOK_SECRET`.
- Власники визначаються тільки через `TELEGRAM_OWNER_USER_IDS`.
- Бот по виробництву працює тільки на `TELEGRAM_PRODUCTION_BOT_TOKEN` (без fallback на інший токен).
