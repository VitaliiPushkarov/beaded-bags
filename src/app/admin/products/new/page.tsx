import ProductForm from '../ProductsForm'

export default function AdminProductCreatePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Новий товар</h1>
      <ProductForm mode="create" />
    </div>
  )
}
