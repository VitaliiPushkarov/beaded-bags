import Image from 'next/image'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import HomeHeroForm from '../home-hero/HomeHeroForm'
import { getHomeHeroBannerSettings } from '@/lib/home-hero-banner'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    selected?: string
    saved?: string
  }>
}

function sanitizeSortPosition(input: unknown): number {
  const raw = Number(input)
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.round(raw))
}

export default async function AdminConfigurationPage({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const query = (params.q || '').trim()
  const selectedOnly = params.selected === '1'
  const saved = params.saved === '1'
  const heroInitial = await getHomeHeroBannerSettings()

  function buildConfigurationHref(input?: {
    saved?: boolean
    query?: string
    selectedOnly?: boolean
  }) {
    const q = input?.query ?? query
    const onlySelected = input?.selectedOnly ?? selectedOnly

    const qs = new URLSearchParams()
    if (q) qs.set('q', q)
    if (onlySelected) qs.set('selected', '1')
    if (input?.saved) qs.set('saved', '1')

    const search = qs.toString()
    return search ? `/admin/configuration?${search}` : '/admin/configuration'
  }

  async function saveNewArrivals(formData: FormData) {
    'use server'

    const variantIds = Array.from(
      new Set(
        formData
          .getAll('variantIds')
          .map((item) => String(item || '').trim())
          .filter((item) => item.length > 0),
      ),
    )

    if (variantIds.length > 0) {
      await prisma.$transaction(
        variantIds.map((variantId) => {
          const enabled = formData.get(`enabled_${variantId}`) === 'on'
          const sortNewArrivals = sanitizeSortPosition(
            formData.get(`position_${variantId}`),
          )

          return prisma.productVariant.update({
            where: { id: variantId },
            data: {
              showInNewArrivals: enabled,
              sortNewArrivals,
            },
          })
        }),
      )
    }

    revalidatePath('/')
    revalidatePath('/admin/configuration')

    const returnToRaw = String(formData.get('returnTo') || '').trim()
    const returnTo = returnToRaw.startsWith('/admin/configuration')
      ? returnToRaw
      : '/admin/configuration'

    const nextUrl = new URL(returnTo, 'http://localhost')
    nextUrl.searchParams.set('saved', '1')

    redirect(
      `${nextUrl.pathname}${
        nextUrl.searchParams.toString()
          ? `?${nextUrl.searchParams.toString()}`
          : ''
      }`,
    )
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      ...(selectedOnly ? { showInNewArrivals: true } : {}),
      ...(query
        ? {
            OR: [
              { color: { contains: query, mode: 'insensitive' } },
              { colorEn: { contains: query, mode: 'insensitive' } },
              { sku: { contains: query, mode: 'insensitive' } },
              {
                product: {
                  is: {
                    OR: [
                      { name: { contains: query, mode: 'insensitive' } },
                      { nameEn: { contains: query, mode: 'insensitive' } },
                      { slug: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [
      { showInNewArrivals: 'desc' },
      { sortNewArrivals: 'asc' },
      { product: { sortCatalog: 'asc' } },
      { sortCatalog: 'asc' },
      { id: 'asc' },
    ],
    take: 500,
    select: {
      id: true,
      color: true,
      colorEn: true,
      sku: true,
      image: true,
      sortCatalog: true,
      availabilityStatus: true,
      showInNewArrivals: true,
      sortNewArrivals: true,
      images: {
        take: 1,
        orderBy: { sort: 'asc' },
        select: { url: true },
      },
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    },
  })

  const selectedCount = variants.filter((item) => item.showInNewArrivals).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Конфігурація</h1>
      </div>

      <HomeHeroForm initial={heroInitial} />

      <form
        action="/admin/configuration"
        method="get"
        className="rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="block text-sm font-medium text-slate-800">
            Пошук по товару / варіанту / SKU
            <input
              name="q"
              defaultValue={query}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Наприклад: сумка, jeans, SKU-001"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="selected"
              value="1"
              defaultChecked={selectedOnly}
              className="h-4 w-4"
            />
            Тільки вибрані у «Новинки»
          </label>

          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Застосувати
          </button>
        </div>
      </form>

      {saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Налаштування NewArrivals збережено.
        </div>
      ) : null}

      <form action={saveNewArrivals} className="space-y-4">
        <input type="hidden" name="returnTo" value={buildConfigurationHref()} />

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Поточно вибрано:{' '}
          <span className="font-semibold text-slate-900">{selectedCount}</span>{' '}
          варіант(ів). У вітрині показуються перші 12 позицій з найменшим
          значенням поля «Позиція».
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">У новинки</th>
                <th className="px-4 py-3">Позиція</th>
                <th className="px-4 py-3">Варіант</th>
                <th className="px-4 py-3">Зображення</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Дія</th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Нічого не знайдено за поточними фільтрами.
                  </td>
                </tr>
              ) : (
                variants.map((variant) => {
                  const imageUrl =
                    variant.images[0]?.url ||
                    variant.image ||
                    '/img/placeholder.png'
                  const variantLabel =
                    variant.color?.trim() ||
                    variant.colorEn?.trim() ||
                    (variant.sku?.trim()
                      ? `SKU: ${variant.sku.trim()}`
                      : `ID: ${variant.id.slice(-8)}`)

                  return (
                    <tr
                      key={variant.id}
                      className="border-t border-slate-200 align-top"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="hidden"
                          name="variantIds"
                          value={variant.id}
                        />
                        <input
                          type="checkbox"
                          name={`enabled_${variant.id}`}
                          defaultChecked={variant.showInNewArrivals}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          name={`position_${variant.id}`}
                          defaultValue={variant.sortNewArrivals}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {variant.product.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {variant.product.slug}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {variantLabel}
                        </div>
                        {variant.sku?.trim() ? (
                          <div className="mt-1 text-xs text-slate-500">
                            SKU: {variant.sku.trim()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Image
                          src={imageUrl}
                          alt={variant.product.name}
                          width={76}
                          height={96}
                          className="h-20 w-16 rounded border border-slate-200 object-cover"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div
                          className={`inline-flex rounded-full border px-2 py-1 ${
                            variant.product.status === 'PUBLISHED'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : variant.product.status === 'DRAFT'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                        >
                          {variant.product.status}
                        </div>
                        <div className="mt-2 text-slate-500">
                          {variant.availabilityStatus}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${variant.product.id}`}
                          className="text-slate-900 underline"
                        >
                          Редагувати товар
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Зберегти конфігурацію
          </button>
        </div>
      </form>
    </div>
  )
}
