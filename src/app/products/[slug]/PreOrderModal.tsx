import { useT } from '@/lib/i18n'

export function PreorderModal(props: {
  open: boolean
  status: 'idle' | 'submitting' | 'success' | 'error'
  productName: string
  variantLabel?: string
  leadName: string
  setLeadName: (v: string) => void
  leadContact: string
  setLeadContact: (v: string) => void
  leadComment: string
  setLeadComment: (v: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const t = useT()
  const {
    open,
    status,
    productName,
    variantLabel,
    leadName,
    setLeadName,
    leadContact,
    setLeadContact,
    leadComment,
    setLeadComment,
    onClose,
    onSubmit,
  } = props

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-[92%] max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-medium">
              {t('Передзамовлення', 'Pre-order')}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {t(
                'Залиште контакт — і ми Вам передзвонимо!',
                'Leave your contact and we will get back to you.',
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {productName}
              {variantLabel ? ` — ${variantLabel}` : ''}
            </div>
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-md border border-gray-200 hover:border-black transition cursor-pointer"
            onClick={onClose}
            aria-label={t('Закрити', 'Close')}
          >
            ✕
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {t("Ім’я", 'Name')}
            </label>
            <input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder={t("Ваше ім’я", 'Your name')}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {t('Телефон', 'Phone')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={leadContact}
              onChange={(e) => setLeadContact(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder="+380"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              {t('Коментар', 'Comment')}
            </label>
            <textarea
              value={leadComment}
              onChange={(e) => setLeadComment(e.target.value)}
              className="w-full min-h-[90px] rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              placeholder={t(
                'Наприклад: хочу з ремінцем…, доставка в…',
                'For example: with strap option, delivery to...',
              )}
            />
          </div>

          {status === 'success' ? (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {t(
                'Дякуємо! Ми отримали ваш контакт і скоро з вами зв’яжемось.',
                'Thank you! We received your contact and will reach out soon.',
              )}
            </div>
          ) : (
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="mt-1 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[16px] py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
            >
              {status === 'submitting'
                ? t('Надсилаємо…', 'Sending...')
                : t('Надіслати', 'Send')}
            </button>
          )}

          {status === 'error' && (
            <div className="text-xs text-gray-600">
              {t(
                'Якщо форма не відправилась — відкриється лист для швидкого передзамовлення.',
                'If the form fails, an email draft for quick pre-order will open.',
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
