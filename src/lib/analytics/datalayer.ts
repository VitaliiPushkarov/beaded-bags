'use client'

export type MetaEventName =
  | 'meta_view_content'
  | 'meta_add_to_cart'
  | 'meta_initiate_checkout'
  | 'meta_purchase'

export type MetaPayload = {
  event: MetaEventName
  event_id?: string
  meta: {
    currency: 'UAH'
    value: number

    // Product / cart
    content_type?: 'product'
    content_ids?: string[]
    content_name?: string
    qty?: number
    num_items?: number

    // Optional extra fields for debugging/analytics
    product_id?: string
    variant_id?: string
    slug?: string

    // Purchase
    order_id?: string
  }
}

export function makeEventId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function dlPush(payload: MetaPayload) {
  if (typeof window === 'undefined') return
  ;(window as any).dataLayer = (window as any).dataLayer || []
  ;(window as any).dataLayer.push(payload)
}

// ---- Convenience wrappers ----

export function pushMetaViewContent(input: {
  contentId: string
  contentName: string
  value: number
  productId?: string
  variantId?: string
  slug?: string
  eventId?: string
}) {
  dlPush({
    event: 'meta_view_content',
    event_id: input.eventId ?? makeEventId(),
    meta: {
      content_type: 'product',
      content_ids: [input.contentId],
      content_name: input.contentName,
      currency: 'UAH',
      value: Number(input.value),
      product_id: input.productId,
      variant_id: input.variantId,
      slug: input.slug,
    },
  })
}

export function pushMetaAddToCart(input: {
  contentId: string
  contentName: string
  value: number
  qty: number
  productId?: string
  variantId?: string
  slug?: string
  eventId?: string
}) {
  dlPush({
    event: 'meta_add_to_cart',
    event_id: input.eventId ?? makeEventId(),
    meta: {
      content_type: 'product',
      content_ids: [input.contentId],
      content_name: input.contentName,
      currency: 'UAH',
      value: Number(input.value),
      qty: Number(input.qty),
      product_id: input.productId,
      variant_id: input.variantId,
      slug: input.slug,
    },
  })
}

export function pushMetaInitiateCheckout(input: {
  contentIds: string[]
  value: number
  numItems: number
  eventId?: string
}) {
  dlPush({
    event: 'meta_initiate_checkout',
    event_id: input.eventId ?? makeEventId(),
    meta: {
      content_type: 'product',
      content_ids: input.contentIds,
      currency: 'UAH',
      value: Number(input.value),
      num_items: Number(input.numItems),
    },
  })
}

export function pushMetaPurchase(input: {
  orderId: string
  contentIds: string[]
  value: number
  numItems: number
  eventId?: string // ideally same as orderId
}) {
  dlPush({
    event: 'meta_purchase',
    event_id: input.eventId ?? input.orderId,
    meta: {
      order_id: input.orderId,
      content_type: 'product',
      content_ids: input.contentIds,
      currency: 'UAH',
      value: Number(input.value),
      num_items: Number(input.numItems),
    },
  })
}
