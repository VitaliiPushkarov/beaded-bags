# Gerdan Beaded Bags

## Telegram Bot For Artisan Production

Цей модуль додає облік виробітку майстрів через Telegram-бота без використання адмін-панелі.

### Що реалізовано

- Реєстрація майстра в боті через код (`/reyestraciya CODE`)
- Фіксація виробітку майстром (`/zapys` -> надіслати кількість числом -> підтвердження)
- Автопідтягування ставки за 1 шт (ставка прив'язана до `майстер + варіант товару`)
- Підтвердження/відхилення запису власником через inline-кнопки
- Фіксація виплати власником з автозаписом у `Expense` (`PAYROLL`)
- Базові звіти для майстра (`/miy_zvit`) і власника (`/zvit`)
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

- `/novyy_maister Ім'я Прізвище` - створити майстра та отримати CODE
- `/maistry` - список майстрів
- `/vstanovyty_stavku CODE VARIANT_ID RATE` - встановити ставку на конкретний варіант
- `/masovo_stavky CODE RATE id1,id2,...` - масово встановити ставку на список VARIANT_ID
- `/vymknuty_stavku CODE VARIANT_ID` - вимкнути ставку для варіанту
- `/stavky CODE` - показати ставки майстра
- `/menu_stavok` - керування ставками через кнопки (вибір майстра/варіанту без ручного вводу довгих команд)
- `/tovary [query]` - список товарів і slug
- `/varianty [query]` - список варіантів з `VARIANT_ID` для команд ставок
- `/ochikuyut` - записи у статусі `SUBMITTED`
- `/zvit` - зведення за поточний місяць
- `/hto_ya` - технічна інформація про Telegram user/chat id

## Artisan Commands

- `/reyestraciya CODE` - прив'язати Telegram до майстра
- `/zapys` - вибір варіанту
- `/miy_zvit` - мій звіт за поточний місяць
- `/dopomoha` - підказка
- Після вибору варіанту достатньо надіслати число кількості одним повідомленням

## Webhook Route

- `POST /api/telegram/production/webhook`
- `GET /api/telegram/production/webhook`

## Important Notes

- Оплата запису (`PAID`) автоматично створює `Expense` категорії `PAYROLL`.
- Для безпечної роботи в production обов'язково використовуйте `TELEGRAM_WEBHOOK_SECRET`.
- Власники визначаються тільки через `TELEGRAM_OWNER_USER_IDS`.
- Бот по виробництву працює тільки на `TELEGRAM_PRODUCTION_BOT_TOKEN` (без fallback на інший токен).
