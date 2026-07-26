// Shared helper for admin server actions: build a redirect target carrying a
// success/error message in the query string. <AdminToaster /> reads these
// `success` / `error` params, shows a toast, and strips them from the URL.
export function withAdminMessage(
  path: string,
  message: { success?: string; error?: string },
): string {
  const [base, existing] = path.split('?')
  const params = new URLSearchParams(existing ?? '')
  params.delete('success')
  params.delete('error')

  if (message.success) {
    params.set('success', message.success)
  } else if (message.error) {
    params.set('error', message.error)
  }

  const queryString = params.toString()
  return queryString ? `${base}?${queryString}` : base
}
