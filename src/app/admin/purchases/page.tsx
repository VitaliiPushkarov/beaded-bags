import { redirect } from 'next/navigation'

export default function AdminPurchasesPageRedirect() {
  redirect('/admin/inventory')
}
