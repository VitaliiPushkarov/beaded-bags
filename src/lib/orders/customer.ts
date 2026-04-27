import { z } from 'zod'

export const LegacyPatronymicSchema = z.string().optional().nullable()

export function buildOrderCustomerSchema(minLength: number) {
  return z.object({
    name: z.string().min(minLength),
    surname: z.string().min(minLength),
    // Legacy-compatible: accept optional patronymic from old clients.
    patronymic: LegacyPatronymicSchema,
    phone: z.string().min(5),
    email: z.string().email().optional().nullable(),
  })
}

type CustomerNameInput = {
  name: string
  surname: string
  patronymic?: string | null
}

export function formatCustomerFullName(input: CustomerNameInput) {
  return [input.name, input.surname, input.patronymic]
    .map((part) => String(part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ')
}
