# Gerdan Beaded Bags

## Telegram Bot For Artisan Production

Цей модуль додає облік виробітку майстрів через Telegram-бота без використання адмін-панелі.

### Що реалізовано

- Реєстрація майстра в боті через код (`/reyestraciya CODE`)
- Швидка приватна реєстрація майстра через deep-link (`/start CODE`)
- Фіксація виробітку майстром у flow: товар -> варіант -> кількість
- Мультипозиційна чернетка: `Зберегти і продовжити` / `Завершити і відправити`
- UX-контроль: `⬅️ Назад` на кроках, `✏️ Змінити кількість` у підсумку, антидубль відправки (10 секунд)
- Автопідтягування ставки за 1 шт (ставка прив'язана до `майстер + варіант товару`)
- Після фінальної відправки бот одразу створює `Expense` категорії `PAYROLL`
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

## Artisan Commands

- `/reyestraciya CODE` - прив'язати Telegram до майстра
- `/start CODE` - прив'язка з приватного лінка
- `/zapys` - запуск flow товар -> варіант -> кількість
- `/dopomoha` - підказка
- Після введення кількості є вибір: `Зберегти і продовжити` або `Завершити і відправити`

## Webhook Route

- `POST /api/telegram/production/webhook`
- `GET /api/telegram/production/webhook`

## Important Notes

- Фінальна відправка майстра автоматично створює `Expense` категорії `PAYROLL`.
- Для безпечної роботи в production обов'язково використовуйте `TELEGRAM_WEBHOOK_SECRET`.
- Бот по виробництву працює тільки на `TELEGRAM_PRODUCTION_BOT_TOKEN` (без fallback на інший токен).
