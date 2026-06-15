import { z } from 'zod'

import { buildOrderCustomerSchema } from './customer'

const OrderItemAddonSchema = z.object({
  addonVariantId: z.string().min(1),
  name: z.string().min(1),
  priceUAH: z.number().min(0),
  qty: z.number().int().min(1),
})

const OrderItemSchema = z.object({
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  strapId: z.string().optional().nullable(),
  sizeId: z.string().optional().nullable(),
  pouchId: z.string().optional().nullable(),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  priceUAH: z.number().min(0),
  modelSize: z.string().optional().nullable(),
  pouchColor: z.string().optional().nullable(),
  strapName: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  addons: z.array(OrderItemAddonSchema).optional().nullable(),
})

const NovaPoshtaShippingSchema = z.object({
  method: z.literal('nova_poshta'),
  np: z.object({
    cityRef: z.string().min(1),
    cityName: z.string().min(1),
    warehouseRef: z.string().min(1),
    warehouseName: z.string().min(1),
  }),
})

const InternationalAddressShippingSchema = z.object({
  method: z.literal('international_address'),
  address: z.object({
    countryCode: z.string().trim().length(2),
    countryName: z.string().trim().min(2),
    city: z.string().trim().min(1),
    region: z.string().trim().optional().nullable(),
    postalCode: z.string().trim().min(1),
    addressLine1: z.string().trim().min(1),
    addressLine2: z.string().trim().optional().nullable(),
  }),
})

export const OrderCreateCheckoutBodySchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  amountUAH: z.number().min(0),
  promoCode: z.string().optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  customer: buildOrderCustomerSchema(2).extend({
    phone: z.string().min(7),
  }),
  shipping: z.discriminatedUnion('method', [
    NovaPoshtaShippingSchema,
    InternationalAddressShippingSchema,
  ]),
  paymentMethod: z.enum(['LIQPAY', 'BANK_TRANSFER']).optional(),
})
