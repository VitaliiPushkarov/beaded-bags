import { prisma } from '@/lib/prisma'
import { ACTIVE_PRODUCT_TYPES, TYPE_LABELS } from '@/lib/labels'
import Link from 'next/link'
import type { Prisma, ProductType } from '@prisma/client'
import ProductStatusSelect from '@/components/admin/ProductStatusSelect'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    type?: string
    status?: string
    stock?: string
    sort?: string
    dir?: string
  }>
}

type StockFilter = 'all' | 'in' | 'preorder' | 'out'
type StatusFilter = 'all' | 'draft' | 'published' | 'archived'
type ProductSortKey =
  | 'catalog'
  | 'name'
  | 'type'
  | 'price'
  | 'variants'
  | 'createdAt'
  | 'updatedAt'
type SortDirection = 'asc' | 'desc'

const STOCK_LABELS: Record<Exclude<StockFilter, 'all'>, string> = {
  in: 'В наявності',
  preorder: 'Доступно до передзамовлення',
  out: 'Немає в наявності',
}

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  draft: 'Чернетка',
  published: 'Опубліковано',
  archived: 'Архів',
}

const SORT_LABELS: Record<ProductSortKey, string> = {
  catalog: 'Позиція в каталозі',
  name: 'Назва',
  type: 'Тип',
  price: 'Базова ціна',
  variants: 'Кількість варіантів',
  createdAt: 'Дата створення',
  updatedAt: 'Дата оновлення',
}

const DIR_LABELS: Record<SortDirection, string> = {
  asc: 'За зростанням',
  desc: 'За спаданням',
}

function getValidProductType(value?: string): ProductType | undefined {
  const raw = value as ProductType | undefined
  const normalized = raw === 'ORNAMENTS' ? 'ACCESSORY' : raw
  return ACTIVE_PRODUCT_TYPES.includes(normalized as ProductType)
    ? (normalized as ProductType)
    : undefined
}

function getValidStockFilter(value?: string): StockFilter {
  return value === 'in' || value === 'preorder' || value === 'out'
    ? value
    : 'all'
}

function getValidStatusFilter(value?: string): StatusFilter {
  return value === 'draft' || value === 'published' || value === 'archived'
    ? value
    : 'all'
}

function getValidSortKey(value?: string): ProductSortKey {
  const allowed: ProductSortKey[] = [
    'catalog',
    'name',
    'type',
    'price',
    'variants',
    'createdAt',
    'updatedAt',
  ]
  return allowed.includes(value as ProductSortKey)
    ? (value as ProductSortKey)
    : 'catalog'
}

function getValidSortDirection(
  value: string | undefined,
  fallback: SortDirection,
): SortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback
}

function getStockWhereClause(stock: StockFilter): Prisma.ProductWhereInput {
  switch (stock) {
    case 'in':
      return { variants: { some: { availabilityStatus: 'IN_STOCK' } } }
    case 'preorder':
      return { variants: { some: { availabilityStatus: 'PREORDER' } } }
    case 'out':
      return {
        variants: {
          some: {},
          every: { availabilityStatus: 'OUT_OF_STOCK' },
        },
      }
    case 'all':
    default:
      return {}
  }
}

function getTypeWhereClause(type?: ProductType): Prisma.ProductWhereInput {
  if (!type) return {}
  if (type === 'ACCESSORY') {
    return { type: { in: ['ACCESSORY', 'ORNAMENTS'] } }
  }
  return { type }
}

function getStatusWhereClause(status: StatusFilter): Prisma.ProductWhereInput {
  switch (status) {
    case 'draft':
      return { status: 'DRAFT' }
    case 'published':
      return { status: 'PUBLISHED' }
    case 'archived':
      return { status: 'ARCHIVED' }
    case 'all':
    default:
      return {}
  }
}

function buildProductWhere(input: {
  query: string
  type?: ProductType
  status: StatusFilter
  stock: StockFilter
}): Prisma.ProductWhereInput {
  return {
    ...(input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { slug: { contains: input.query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...getTypeWhereClause(input.type),
    ...getStatusWhereClause(input.status),
    ...getStockWhereClause(input.stock),
  }
}

function getProductImageChips(product: {
  variants: Array<{
    image: string | null
    images: Array<{ url: string }>
  }>
}): string[] {
  const unique = new Set<string>()

  for (const variant of product.variants) {
    if (variant.image) unique.add(variant.image)
    for (const image of variant.images) {
      if (image.url) unique.add(image.url)
      if (unique.size >= 1) break
    }
    if (unique.size >= 1) break
  }

  return Array.from(unique).slice(0, 1)
}

function compareNullableNumbers(
  a: number | null,
  b: number | null,
  direction: number,
) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction * (a - b)
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const type = getValidProductType(params.type)
  const status = getValidStatusFilter(params.status)
  const stock = getValidStockFilter(params.stock)
  const sort = getValidSortKey(params.sort)
  const dir = getValidSortDirection(
    params.dir,
    sort === 'catalog' ||
      sort === 'name' ||
      sort === 'type' ||
      sort === 'variants'
      ? 'asc'
      : 'desc',
  )

  const [products, typesForCurrentFilters, productsForStockFilter] =
    await Promise.all([
      prisma.product.findMany({
        where: buildProductWhere({ query, type, status, stock }),
        include: {
          variants: {
            orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              availabilityStatus: true,
              image: true,
              images: {
                orderBy: { sort: 'asc' },
                select: { url: true },
              },
            },
          },
        },
        orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.product.findMany({
        where: buildProductWhere({ query, status, stock }),
        distinct: ['type'],
        select: { type: true },
      }),
      prisma.product.findMany({
        where: buildProductWhere({ query, type, status, stock: 'all' }),
        select: {
          variants: {
            select: {
              availabilityStatus: true,
            },
          },
        },
      }),
    ])

  const availableTypeSet = new Set<ProductType>(
    typesForCurrentFilters.map((item) =>
      item.type === 'ORNAMENTS' ? 'ACCESSORY' : item.type,
    ),
  )
  const typeOptions = ACTIVE_PRODUCT_TYPES.filter(
    (value) => availableTypeSet.has(value) || value === type,
  )

  const availableStockSet = new Set<Exclude<StockFilter, 'all'>>()
  for (const product of productsForStockFilter) {
    if (
      product.variants.some(
        (variant) => variant.availabilityStatus === 'IN_STOCK',
      )
    ) {
      availableStockSet.add('in')
    }
    if (
      product.variants.some(
        (variant) => variant.availabilityStatus === 'PREORDER',
      )
    ) {
      availableStockSet.add('preorder')
    }
    if (
      product.variants.length > 0 &&
      product.variants.every(
        (variant) => variant.availabilityStatus === 'OUT_OF_STOCK',
      )
    ) {
      availableStockSet.add('out')
    }
  }

  const formKey = `${query}|${type ?? ''}|${status}|${stock}|${sort}|${dir}`
  const appliedFilters: Array<{ key: string; label: string; value: string }> =
    []

  if (query) {
    appliedFilters.push({
      key: 'q',
      label: 'Пошук',
      value: query,
    })
  }
  if (type) {
    appliedFilters.push({
      key: 'type',
      label: 'Тип',
      value: TYPE_LABELS[type],
    })
  }
  if (status !== 'all') {
    appliedFilters.push({
      key: 'status',
      label: 'Статус',
      value: STATUS_LABELS[status],
    })
  }
  if (stock !== 'all') {
    appliedFilters.push({
      key: 'stock',
      label: 'Наявність',
      value: STOCK_LABELS[stock],
    })
  }
  if (sort !== 'catalog' || dir !== 'asc') {
    appliedFilters.push({
      key: 'sort',
      label: 'Сортування',
      value: `${SORT_LABELS[sort]} · ${DIR_LABELS[dir]}`,
    })
  }

  const rows = products.sort((a, b) => {
    const direction = dir === 'asc' ? 1 : -1

    switch (sort) {
      case 'name':
        return direction * a.name.localeCompare(b.name, 'uk')
      case 'type':
        return (
          direction *
          TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type], 'uk')
        )
      case 'price':
        return compareNullableNumbers(a.basePriceUAH, b.basePriceUAH, direction)
      case 'variants':
        return direction * (a.variants.length - b.variants.length)
      case 'createdAt':
        return direction * (a.createdAt.getTime() - b.createdAt.getTime())
      case 'updatedAt':
        return direction * (a.updatedAt.getTime() - b.updatedAt.getTime())
      case 'catalog':
      default:
        return (
          direction * (a.sortCatalog - b.sortCatalog) ||
          b.createdAt.getTime() - a.createdAt.getTime()
        )
    }
  })

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Товари</h1>
          <p className="mt-1 text-sm text-gray-600">
            Знайдено товарів:{' '}
            <span className="font-medium text-gray-900">{rows.length}</span>
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-[#FF3D8C] inline-flex items-center justify-center"
        >
          + Додати товар
        </Link>
      </div>

      <form
        key={formKey}
        method="get"
        className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      >
        <label className="text-sm font-medium xl:col-span-2">
          Пошук
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Назва або slug"
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-medium">
          Тип
          <select
            name="type"
            defaultValue={type ?? ''}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Усі</option>
            {typeOptions.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Статус
          <select
            name="status"
            defaultValue={status}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Усі</option>
            <option value="draft">Чернетка</option>
            <option value="published">Опубліковано</option>
            <option value="archived">Архів</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          Наявність
          <select
            name="stock"
            defaultValue={stock}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Усі</option>
            {availableStockSet.has('in') || stock === 'in' ? (
              <option value="in">В наявності</option>
            ) : null}
            {availableStockSet.has('preorder') || stock === 'preorder' ? (
              <option value="preorder">Доступно до передзамовлення</option>
            ) : null}
            {availableStockSet.has('out') || stock === 'out' ? (
              <option value="out">Немає в наявності</option>
            ) : null}
          </select>
        </label>

        <label className="text-sm font-medium">
          Сортувати
          <select
            name="sort"
            defaultValue={sort}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="catalog">Позиція в каталозі</option>
            <option value="name">Назва</option>
            <option value="type">Тип</option>
            <option value="price">Базова ціна</option>
            <option value="variants">Кількість варіантів</option>
            <option value="createdAt">Дата створення</option>
            <option value="updatedAt">Дата оновлення</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          Напрям
          <select
            name="dir"
            defaultValue={dir}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="asc">За зростанням</option>
            <option value="desc">За спаданням</option>
          </select>
        </label>

        <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-6">
          <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C] cursor-pointer">
            Застосувати
          </button>
          <a
            href="/admin/products"
            className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
          >
            Скинути
          </a>
        </div>
      </form>

      {appliedFilters.length > 0 ? (
        <div className="mb-4 text-xs text-gray-600">
          {appliedFilters
            .map((item) => `${item.label}: ${item.value}`)
            .join(' / ')}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="border rounded bg-white p-4">
          <p className="text-sm text-gray-600">
            За поточними фільтрами товари не знайдені.
          </p>
        </div>
      ) : (
        <div className="border rounded bg-white">
          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {rows.map((p) => {
              const chips = getProductImageChips(p)

              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {chips.length > 0 ? (
                        <div className="mb-2 flex items-center">
                          <div className="flex -space-x-2">
                            {chips.map((imageUrl, index) => (
                              <div
                                key={`${p.id}-chip-mobile-${index}`}
                                className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-gray-100 shadow-sm"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {p.status === 'PUBLISHED' ? (
                        <Link
                          href={`/products/${p.slug}`}
                          className="font-medium hover:underline wrap-break-word"
                          target="_blank"
                        >
                          {p.name}
                        </Link>
                      ) : (
                        <div className="font-medium wrap-break-word">
                          {p.name}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-gray-600 wrap-break-word">
                        <span className="text-gray-500">Тип:</span>{' '}
                        {TYPE_LABELS[p.type]}
                      </div>
                      <div className="mt-2">
                        <ProductStatusSelect
                          productId={p.id}
                          initialStatus={p.status}
                        />
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        <span className="text-gray-500">Базова ціна:</span>{' '}
                        {p.basePriceUAH != null ? `${p.basePriceUAH} ₴` : '—'}
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="text-gray-500">Позиція:</span>{' '}
                        {p.sortCatalog}
                        <span className="mx-2 text-gray-300">•</span>
                        <span className="text-gray-500">Варіантів:</span>{' '}
                        {p.variants.length}
                      </div>
                    </div>

                    <Link
                      href={`/admin/products/${p.id}`}
                      className="shrink-0 text-xs underline"
                    >
                      Редагувати
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Назва</th>
                  <th className="p-2 text-left">Тип</th>
                  <th className="p-2 text-left">Статус</th>
                  <th className="p-2 text-center">Позиція</th>
                  <th className="p-2 text-right">Базова ціна</th>
                  <th className="p-2 text-center">Варіантів</th>
                  <th className="p-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const chips = getProductImageChips(p)

                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">
                        <div className="flex items-center gap-3">
                          {chips.length > 0 ? (
                            <div className="flex -space-x-2 shrink-0">
                              {chips.map((imageUrl, index) => (
                                <div
                                  key={`${p.id}-chip-desktop-${index}`}
                                  className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-gray-100 shadow-sm"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageUrl}
                                    alt={p.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            {p.status === 'PUBLISHED' ? (
                              <Link
                                href={`/products/${p.slug}`}
                                className="text-blue-600 hover:underline"
                                target="_blank"
                              >
                                {p.name}
                              </Link>
                            ) : (
                              <span>{p.name}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2">{TYPE_LABELS[p.type]}</td>
                      <td className="p-2">
                        <ProductStatusSelect
                          productId={p.id}
                          initialStatus={p.status}
                        />
                      </td>
                      <td className="p-2 text-center">{p.sortCatalog}</td>
                      <td className="p-2 text-right">
                        {p.basePriceUAH != null ? `${p.basePriceUAH} ₴` : '—'}
                      </td>
                      <td className="p-2 text-center">{p.variants.length}</td>
                      <td className="p-2 text-right">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Редагувати
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
