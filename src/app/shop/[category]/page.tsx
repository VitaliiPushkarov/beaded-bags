import { redirect } from 'next/navigation'

const MAP: Record<string, string> = {
  sumky: 'BAG',
  bananky: 'BELT_BAG',
  rjukzachky: 'BACKPACK',
  shopery: 'SHOPPER',
  chohly: 'CASE',
}

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const type = MAP[category]

  if (!type) {
    redirect('/shop')
  }

  redirect(`/shop?type=${type}`)
}
