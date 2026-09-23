import { prisma } from '@/lib/prisma'
import {
  DEFAULT_ORDER_EMAIL_SETTINGS,
  OrderEmailSettingsSchema,
  type OrderEmailSettings,
} from './order-email-copy'

export async function getOrderEmailSettings(): Promise<OrderEmailSettings> {
  const row = await prisma.orderEmailSettings.findUnique({ where: { id: 1 } })
  if (row) return OrderEmailSettingsSchema.parse(row.templates)

  // Preserve existing bank details until the merchant saves the editor.
  return {
    uk: {
      ...DEFAULT_ORDER_EMAIL_SETTINGS.uk,
      bankTransferDetails: process.env.BANK_TRANSFER_DETAILS_UK?.trim() || '',
    },
    en: {
      ...DEFAULT_ORDER_EMAIL_SETTINGS.en,
      bankTransferDetails:
        process.env.BANK_TRANSFER_DETAILS_EN?.trim() ||
        process.env.BANK_TRANSFER_DETAILS_UK?.trim() ||
        '',
    },
  }
}
