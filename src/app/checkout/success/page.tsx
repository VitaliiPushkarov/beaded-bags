export default function SuccessPage({
  searchParams,
}: {
  searchParams: { orderId?: string }
}) {
  return (
    <section className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-semibold">Дякуємо!</h1>
      <p className="mt-2">
        Якщо оплата пройшла успішно, замовлення буде підтверджено найближчим
        часом.
      </p>
      {searchParams.orderId && (
        <p className="mt-3 text-sm text-gray-600">
          Номер замовлення: <b>{searchParams.orderId}</b>
        </p>
      )}
    </section>
  )
}
