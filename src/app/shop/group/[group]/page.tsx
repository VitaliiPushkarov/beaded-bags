import ProductsContainer from '@/components/product/ProductsContainer'
import { getProducts } from '@/lib/db/products'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 300

type DbGroup = '' | 'BEADS' | 'WEAVING'
type UiGroup = '' | 'Бісер' | 'Плетіння'

function normalizeGroupParam(raw: string): DbGroup {
  const v = raw.trim()

  //allow enum in URL
  if (v === 'BEADS' || v === 'WEAVING') return v

  const s = v.toLowerCase()

  //allow slugs
  if (s === 'beads' || s === 'bead') return 'BEADS'
  if (s === 'weaving' || s === 'weave') return 'WEAVING'

  //allow legacy UA labels
  if (s === 'бісер') return 'BEADS'
  if (s === 'плетіння') return 'WEAVING'

  return ''
}
function toUiGroup(g: DbGroup): UiGroup {
  if (g === 'BEADS') return 'Бісер'
  if (g === 'WEAVING') return 'Плетіння'
  return ''
}

function titleForGroup(g: DbGroup): string {
  if (g === 'BEADS') return 'Бісер'
  if (g === 'WEAVING') return 'Плетіння'

  return 'Група'
}

function groupCanonicalSlug(g: DbGroup): string {
  if (g === 'BEADS') return 'beads'
  if (g === 'WEAVING') return 'weaving'
  return ''
}

type ShopGroupPageProps = {
  params: Promise<{ group: string }>
  searchParams: Promise<{ q?: string; color?: string }>
}

export async function generateMetadata({
  params,
}: ShopGroupPageProps): Promise<Metadata> {
  const { group } = await params
  const dbGroup = normalizeGroupParam(group)

  if (!dbGroup) {
    return {
      title: 'Групу не знайдено',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  return {
    title: titleForGroup(dbGroup),
    description: `Каталог товарів групи "${titleForGroup(dbGroup)}" від GERDAN.`,
    alternates: {
      canonical: `/shop/group/${groupCanonicalSlug(dbGroup)}`,
    },
  }
}

export default async function ShopGroupPage({
  params,
  searchParams,
}: ShopGroupPageProps) {
  const { group } = await params
  const sp = await searchParams

  const dbGroup = normalizeGroupParam(group)

  //fallback
  if (!dbGroup) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4">
          Група скоро буде доступна
        </h1>
        <p className="text-gray-600 mb-6">
          Ми ще не встигли додати товари в цю групу. Спробуйте інші розділи
          каталогу.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center rounded bg-black text-white px-4 py-2 text-sm hover:bg-neutral-800"
        >
          Усі товари
        </Link>
      </div>
    )
  }
  const products = await getProducts({
    search: sp.q,
    color: sp.color,
    group: dbGroup,
  })
  return (
    <ProductsContainer
      initialProducts={products}
      lockedGroup={dbGroup}
      title={titleForGroup(dbGroup)}
    />
  )
}
