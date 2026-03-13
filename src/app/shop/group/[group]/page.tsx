import ProductsContainer from '@/components/product/ProductsContainer'
import { getProductsLite } from '@/lib/db/products'
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
    title:
      dbGroup === 'BEADS'
        ? 'Сумки та аксесуари з бісеру'
        : 'Плетені сумки та аксесуари',
    description:
      dbGroup === 'BEADS'
        ? 'Каталог GERDAN групи "Бісер": сумки з бісеру, чохли з бісеру та акцентні аксесуари.'
        : 'Каталог GERDAN групи "Плетіння": плетені сумки, шопери та аксесуари ручної роботи.',
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
  const products = await getProductsLite({
    search: sp.q,
    color: sp.color,
    group: dbGroup,
  })
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: titleForGroup(dbGroup),
    itemListElement: products.slice(0, 24).map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://gerdan.online/products/${product.slug}`,
    })),
  }
  return (
    <>
      <ProductsContainer
        initialProducts={products}
        lockedGroup={dbGroup}
        title={titleForGroup(dbGroup)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }}
      />
    </>
  )
}
