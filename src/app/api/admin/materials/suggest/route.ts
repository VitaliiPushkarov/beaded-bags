import { MaterialCategory } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import type { MaterialNameSuggestion } from '@/lib/admin-materials'
import { prisma } from '@/lib/prisma'

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  category: z.nativeEnum(MaterialCategory).optional(),
})

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function scoreNameMatch(name: string, query: string): number {
  const normalizedName = normalizeText(name)
  const normalizedQuery = normalizeText(query)

  if (normalizedName === normalizedQuery) return 300
  if (normalizedName.startsWith(normalizedQuery)) return 200
  if (normalizedName.includes(normalizedQuery)) return 100
  return 0
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    category: url.searchParams.get('category') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ items: [] }, { status: 200 })
  }

  const rows = await prisma.material.findMany({
    where: {
      name: {
        contains: parsed.data.q,
        mode: 'insensitive',
      },
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
    },
    select: {
      name: true,
      category: true,
      color: true,
    },
    orderBy: [{ name: 'asc' }, { color: 'asc' }],
    take: 120,
  })

  const grouped = new Map<string, MaterialNameSuggestion>()

  for (const row of rows) {
    const key = `${normalizeText(row.name)}::${row.category}`
    const existing = grouped.get(key)
    const color = row.color.trim()

    if (!existing) {
      grouped.set(key, {
        name: row.name,
        category: row.category,
        variantsCount: 1,
        colors: color ? [color] : [],
      })
      continue
    }

    existing.variantsCount += 1
    if (color && !existing.colors.includes(color)) {
      existing.colors.push(color)
    }
  }

  const items = Array.from(grouped.values())
    .sort((left, right) => {
      const rightScore = scoreNameMatch(right.name, parsed.data.q)
      const leftScore = scoreNameMatch(left.name, parsed.data.q)
      if (rightScore !== leftScore) return rightScore - leftScore
      return left.name.localeCompare(right.name, 'uk')
    })
    .slice(0, 10)

  return NextResponse.json({ items }, { status: 200 })
}
