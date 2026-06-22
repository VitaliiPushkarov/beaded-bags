# Gerdan Beaded Bags

Next.js проєкт для магазину та внутрішньої адмінки Gerdan.

## Локальний запуск

1. Встановити залежності:

```bash
npm install
```

2. Запустити dev сервер:

```bash
npm run dev
```

3. Відкрити:

- `http://localhost:3000`

## Корисні скрипти

- `npm run dev` — локальна розробка
- `npm run build` — production build
- `npm run start` — запуск production build
- `npm run db:probe` — перевірка доступу до БД
- `npm run export:liqpay:catalog` — згенерувати каталог ПРРО/LiqPay з локальної БД
- `npm run import:liqpay:mapping -- --file=...` — імпортувати мапінг `externalCode -> goodId` з файлу каталогу LiqPay

## Синхронізація каталогу ПРРО

1. Згенерувати каталог з локальної БД:

```bash
npm run export:liqpay:catalog > liqpay-catalog.csv
```

2. Завантажити файл у LiqPay/ПРРО кабінет.

3. Експортувати каталог назад з LiqPay та імпортувати мапінг у проєкт:

```bash
npm run import:liqpay:mapping -- --file=./path/to/liqpay-export.xlsx
```

Після цього checkout зможе брати `goodId` автоматично через синхронізований мапінг. Поле `liqpayGoodId` у товарі лишається ручним override і потрібне лише для винятків.

## Примітка

Логіку `telegram production bot` та webhook `/api/telegram/production/webhook` видалено з цього проєкту.
