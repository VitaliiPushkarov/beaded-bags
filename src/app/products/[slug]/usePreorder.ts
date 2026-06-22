import { useState } from 'react'
import type { Product, ProductVariant } from '@prisma/client'
import {
  buildFallbackPreorderItems,
  buildPreorderMailtoBody,
  formatUaPhone,
  isUaPhoneValid,
  UA_PHONE_DEFAULT_PREFIX,
  normalizePreorderItems,
  type PreorderItemInput,
} from '@/lib/preorder'

export function usePreorder(params: {
  product: Product
  variant: ProductVariant | null
  strapId?: string
  items?: PreorderItemInput[]
}) {
  const { product, variant, strapId, items = [] } = params

  const variantLabel = variant
    ? (() => {
        const optionParts = [
          variant.color?.trim() || null,
          ((variant as any).modelSize as string | null | undefined)?.trim()
            ? `Розмір: ${String((variant as any).modelSize).trim()}`
            : null,
          ((variant as any).pouchColor as string | null | undefined)?.trim()
            ? `Мішечок: ${String((variant as any).pouchColor).trim()}`
            : null,
        ].filter((x): x is string => Boolean(x))

        return optionParts.length
          ? `${product.name} — ${optionParts.join(' · ')}`
          : product.name
      })()
    : ''

  const [preorderOpen, setPreorderOpen] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadContact, setLeadContact] = useState(UA_PHONE_DEFAULT_PREFIX)
  const [leadComment, setLeadComment] = useState('')
  const [preorderStatus, setPreorderStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')

  const openPreorder = () => {
    if (!leadContact.trim()) {
      setLeadContact(UA_PHONE_DEFAULT_PREFIX)
    }
    setPreorderStatus('idle')
    setPreorderOpen(true)
  }

  const closePreorder = () => setPreorderOpen(false)

  const submitPreorder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!variant) return

    const normalizedItems = normalizePreorderItems(items)
    const fallbackItems = buildFallbackPreorderItems({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: variant.id,
      variantLabel,
      variantColor: variant.color ?? null,
      strapId: strapId ?? null,
    })
    const payloadItems = normalizedItems.length ? normalizedItems : fallbackItems
    const primaryItem =
      payloadItems.find((item) => item.kind === 'main') ?? payloadItems[0]

    if (!primaryItem) return

    if (!isUaPhoneValid(leadContact)) return

    const formattedPhone = formatUaPhone(leadContact)

    const payload = {
      productId: primaryItem.productId,
      productSlug: primaryItem.productSlug,
      productName: primaryItem.productName,
      variantId: primaryItem.variantId,
      variantColor: primaryItem.variantColor,
      strapId: primaryItem.strapId ?? strapId ?? null,
      contactName: leadName.trim(),
      contact: formattedPhone,
      comment: leadComment.trim() || null,
      source: 'product_page',
      items: payloadItems,
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

      const subject = encodeURIComponent(
        `Передзамовлення: ${primaryItem.productName}`,
      )
      const body = encodeURIComponent(
        buildPreorderMailtoBody({
          items: payloadItems,
          pageUrl:
            typeof window !== 'undefined' ? window.location.href : undefined,
          contactName: leadName.trim() || null,
          contact: formattedPhone,
          comment: leadComment.trim() || null,
        }),
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
