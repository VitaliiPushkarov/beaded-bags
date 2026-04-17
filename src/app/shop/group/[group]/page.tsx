import ProductsContainer from '@/components/product/ProductsContainer'
import { getProductsLite } from '@/lib/db/products'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  hasFacetedQueryParams,
  pickFirstQueryValue,
  type QueryParamValue,
} from '@/lib/seo/faceted'
import { getRequestLocale } from '@/lib/server-locale'

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

function titleForGroup(g: DbGroup, locale: 'uk' | 'en' = 'uk'): string {
  if (g === 'BEADS') return locale === 'en' ? 'Beads' : 'Бісер'
  if (g === 'WEAVING') return locale === 'en' ? 'Weaving' : 'Плетіння'

  return locale === 'en' ? 'Group' : 'Група'
}

function groupCanonicalSlug(g: DbGroup): string {
  if (g === 'BEADS') return 'beads'
  if (g === 'WEAVING') return 'weaving'
  return ''
}

type ShopGroupPageProps = {
  params: Promise<{ group: string }>
  searchParams: Promise<
    Record<string, QueryParamValue> & {
      q?: QueryParamValue
      color?: QueryParamValue
      inStock?: QueryParamValue
      onSale?: QueryParamValue
      min?: QueryParamValue
      max?: QueryParamValue
      sortBase?: QueryParamValue
      sortPrice?: QueryParamValue
      subcategory?: QueryParamValue
      type?: QueryParamValue
      group?: QueryParamValue
    }
  >
}

export function generateStaticParams() {
  return [{ group: 'beads' }, { group: 'weaving' }]
}

export async function generateMetadata({
  params,
  searchParams,
}: ShopGroupPageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { group } = await params
  const sp = await searchParams
  const dbGroup = normalizeGroupParam(group)

  if (!dbGroup) {
    notFound()
  }

  const shouldNoindex = hasFacetedQueryParams(sp)

  return {
    title:
      dbGroup === 'BEADS'
        ? locale === 'en'
          ? 'Beaded Bags and Accessories'
          : 'Сумки та аксесуари з бісеру'
        : locale === 'en'
          ? 'Woven Bags and Accessories'
          : 'Плетені сумки та аксесуари',
    description:
      dbGroup === 'BEADS'
        ? locale === 'en'
          ? 'GERDAN beads group catalog: beaded bags, beaded cases and statement accessories.'
          : 'Каталог GERDAN групи "Бісер": сумки з бісеру, чохли з бісеру та акцентні аксесуари.'
        : locale === 'en'
          ? 'GERDAN weaving group catalog: woven bags, shoppers and handmade accessories.'
          : 'Каталог GERDAN групи "Плетіння": плетені сумки, шопери та аксесуари ручної роботи.',
    alternates: {
      canonical: `/shop/group/${groupCanonicalSlug(dbGroup)}`,
    },
    robots: shouldNoindex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  }
}

export default async function ShopGroupPage({
  params,
  searchParams,
}: ShopGroupPageProps) {
  const locale = await getRequestLocale()
  const { group } = await params
  const sp = await searchParams

  const dbGroup = normalizeGroupParam(group)

  if (!dbGroup) {
    notFound()
  }
  const products = await getProductsLite({
    search: pickFirstQueryValue(sp.q),
    color: pickFirstQueryValue(sp.color),
    group: dbGroup,
  })
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: titleForGroup(dbGroup, locale),
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
        title={titleForGroup(dbGroup, locale)}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }}
      />
    </>
  )
}
