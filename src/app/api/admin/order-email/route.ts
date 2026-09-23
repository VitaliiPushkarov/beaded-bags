import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { OrderEmailSettingsSchema } from '@/lib/order-email-copy'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized
  const json: unknown = await req.json().catch(() => null)
  const parsed = OrderEmailSettingsSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Перевірте шаблон листа.' },
      { status: 400 },
    )
  }
  try {
    await prisma.orderEmailSettings.upsert({
      where: { id: 1 },
      create: { id: 1, templates: parsed.data },
      update: { templates: parsed.data },
    })
    revalidatePath('/admin/order-emails')
    return NextResponse.json({ settings: parsed.data })
  } catch {
    return NextResponse.json(
      { error: 'Не вдалося зберегти шаблон. Спробуйте ще раз.' },
      { status: 500 },
    )
  }
}
