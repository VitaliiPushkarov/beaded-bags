import { useState } from 'react'
import type { Product, ProductVariant } from '@prisma/client'

export function usePreorder(params: {
  product: Product
  variant: ProductVariant | null
  strapId?: string
}) {
  const { product, variant, strapId } = params

  const [preorderOpen, setPreorderOpen] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadContact, setLeadContact] = useState('')
  const [leadComment, setLeadComment] = useState('')
  const [preorderStatus, setPreorderStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')

  const openPreorder = () => {
    setPreorderStatus('idle')
    setPreorderOpen(true)
  }

  const closePreorder = () => setPreorderOpen(false)

  const submitPreorder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!variant) return

    const payload = {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: variant.id,
      variantColor: variant.color ?? null,
      strapId: strapId ?? null,
      contactName: leadName.trim(),
      contact: leadContact.trim(),
      comment: leadComment.trim() || null,
      source: 'product_page',
      createdAt: new Date().toISOString(),
    }

    if (!payload.contact) return

    setPreorderStatus('submitting')

    try {
      const res = await fetch('/api/preorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setPreorderStatus('success')
        return
      }

      throw new Error('preorder_api_failed')
    } catch {
      setPreorderStatus('error')

      const subject = encodeURIComponent(`Передзамовлення: ${product.name}`)
      const body = encodeURIComponent(
        `Хочу передзамовити товар.\n\n` +
          `Товар: ${product.name}\n` +
          `Варіант: ${variant.color ? variant.color : variant.id}\n` +
          `Сторінка: ${
            typeof window !== 'undefined' ? window.location.href : ''
          }\n\n` +
          `Ім'я: ${leadName}\n` +
          `Контакт (телефон/email): ${leadContact}\n` +
          (leadComment ? `Коментар: ${leadComment}\n` : '')
      )

      window.location.href = `mailto:hello@gerdan.online?subject=${subject}&body=${body}`
    }
  }

  return {
    preorderOpen,
    preorderStatus,
    leadName,
    setLeadName,
    leadContact,
    setLeadContact,
    leadComment,
    setLeadComment,
    openPreorder,
    closePreorder,
    submitPreorder,
  }
}
