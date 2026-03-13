import { redirect } from 'next/navigation'

export default function AdminProductionPageRedirect() {
  redirect('/admin/inventory')
}
