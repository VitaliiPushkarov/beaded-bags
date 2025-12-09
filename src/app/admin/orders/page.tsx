import { prisma } from '@/lib/prisma'
import OrdersTableClient from './OrdersTableClient'

export default async function AdminOrdersPage() {
  let orders: Awaited<ReturnType<typeof prisma.order.findMany>> = []

  try {
    orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  } catch (e) {
    console.error('Failed to load orders for admin page:', e)
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Замовлення</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-600">
          Поки немає замовлень або сталася помилка завантаження.
        </p>
      ) : (
        <OrdersTableClient orders={orders} />
      )}
    </div>
  )
}
