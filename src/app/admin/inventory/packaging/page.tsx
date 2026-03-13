import InventoryPageView from '../InventoryPageView'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    productId?: string
    packagingOpen?: string
    editPackagingId?: string
  }>
}

export default async function AdminInventoryPackagingPage({ searchParams }: PageProps) {
  return <InventoryPageView searchParams={searchParams} view="packaging" />
}
