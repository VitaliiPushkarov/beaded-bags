import { z } from 'zod'
import type { OrderEmailKind, OrderEmailLocale } from './order-email-template'

export const ORDER_EMAIL_ADDRESS = 'gerdanstudio@gmail.com'

export const ORDER_EMAIL_VARIABLES = [
  'orderNumber',
  'customerName',
  'totalAmount',
] as const

const templateText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        [...value.matchAll(/\{\{(.*?)\}\}/g)].every(([, key]) =>
          ORDER_EMAIL_VARIABLES.some((allowed) => allowed === key.trim()),
        ),
      'Дозволені змінні: {{orderNumber}}, {{customerName}}, {{totalAmount}}',
    )

const copySchema = z.object({
  subject: templateText(200)
    .refine((value) => !/[\r\n]/.test(value), 'Тема має бути одним рядком')
    .refine(
      (value) => /\{\{\s*orderNumber\s*\}\}/.test(value),
      'Додайте {{orderNumber}} до теми',
    ),
  intro: templateText(3000),
  nextSteps: templateText(2000),
  footer: templateText(1000),
})

const localeSchema = z.object({
  PAID: copySchema,
  AWAITING_PAYMENT: copySchema,
  bankTransferDetails: z.string().trim().max(4000),
})

export const OrderEmailSettingsSchema = z.object({
  uk: localeSchema,
  en: localeSchema,
})
export type OrderEmailCopy = z.infer<typeof copySchema>
export type OrderEmailSettings = z.infer<typeof OrderEmailSettingsSchema>

export const DEFAULT_ORDER_EMAIL_SETTINGS: OrderEmailSettings = {
  uk: {
    PAID: {
      subject: 'Замовлення #{{orderNumber}} підтверджено · GERDAN',
      intro:
        'Дякуємо! Оплату отримано, замовлення #{{orderNumber}} підтверджено — ми вже беремо його в роботу.',
      nextSteps:
        'Щойно передамо посилку перевізнику — надішлемо номер накладної для відстеження.',
      footer:
        'Дякуємо, що обираєте GERDAN! Якщо маєте запитання, просто відповідайте на цей лист.',
    },
    AWAITING_PAYMENT: {
      subject: 'Замовлення #{{orderNumber}} — реквізити для оплати · GERDAN',
      intro:
        'Дякуємо за замовлення #{{orderNumber}}! Його успішно оформлено. Ми зберігаємо його за вами й чекаємо на оплату — реквізити нижче.',
      nextSteps:
        'Щойно кошти надійдуть, ми одразу візьмемо замовлення в роботу й повідомимо вас.',
      footer:
        'Дякуємо, що обираєте GERDAN! Якщо маєте запитання, просто відповідайте на цей лист.',
    },
    bankTransferDetails: '',
  },
  en: {
    PAID: {
      subject: 'Order #{{orderNumber}} confirmed · GERDAN',
      intro:
        'Thank you! Your payment was received and order #{{orderNumber}} is confirmed — we are getting to work on it.',
      nextSteps:
        'Once the parcel is handed to the carrier we will send you the tracking number.',
      footer:
        'Thank you for choosing GERDAN! If you have any questions, just reply to this email.',
    },
    AWAITING_PAYMENT: {
      subject: 'Order #{{orderNumber}} — payment details · GERDAN',
      intro:
        'Thank you for order #{{orderNumber}}! Your order has been placed. We are holding it for you and are waiting for payment — details are below.',
      nextSteps:
        'As soon as the payment arrives we will start working on your order and let you know.',
      footer:
        'Thank you for choosing GERDAN! If you have any questions, just reply to this email.',
    },
    bankTransferDetails: '',
  },
}

export function resolveOrderEmailCopy(
  locale: OrderEmailLocale,
  kind: OrderEmailKind,
  copy?: OrderEmailCopy,
) {
  return copy ?? DEFAULT_ORDER_EMAIL_SETTINGS[locale][kind]
}

export function interpolateOrderEmailText(
  template: string,
  values: Record<(typeof ORDER_EMAIL_VARIABLES)[number], string>,
): string {
  // One pass: customer values containing template syntax are never evaluated.
  return template.replace(
    /\{\{\s*(orderNumber|customerName|totalAmount)\s*\}\}/g,
    (_, key: keyof typeof values) => values[key],
  )
}
