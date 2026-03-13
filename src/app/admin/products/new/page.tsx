import ProductForm from '../ProductsForm'

export default function AdminProductCreatePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Новий товар</h1>
      <p className="text-sm text-gray-600 mb-4">
        Новий товар створюється як чернетка. Опублікуйте його, коли картка буде готова.
      </p>
      <ProductForm mode="create" />
    </div>
  )
}
