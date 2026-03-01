import ProductsContainer from '@/components/product/ProductsContainer'
import { getProducts } from '@/lib/db/products'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

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

export function generateStaticParams() {
  return [{ group: 'beads' }, { group: 'weaving' }]
}

export async function generateMetadata({
  params,
}: ShopGroupPageProps): Promise<Metadata> {
  const { group } = await params
  const dbGroup = normalizeGroupParam(group)

  if (!dbGroup) {
    notFound()
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

  if (!dbGroup) {
    notFound()
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
