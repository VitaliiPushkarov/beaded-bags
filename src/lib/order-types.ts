import { z } from 'zod'

export const OrderItemInput = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  name: z.string(),
  image: z.string().optional(),
  priceUAH: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
})

export const CreateOrderInput = z.object({
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(7),
    email: z.string().email().optional(),
  }),
  delivery: z.object({
    method: z.enum(['NP_WAREHOUSE', 'NP_COURIER', 'PICKUP']),
    // для нашого кейсу НП-відділення
    npCityRef: z.string().optional(),
    npCityName: z.string().optional(),
    npWarehouseRef: z.string().optional(),
    npWarehouseText: z.string().optional(),
  }),
  items: z.array(OrderItemInput).min(1),
  subtotalUAH: z.number().int().nonnegative(),
  shippingUAH: z.number().int().nonnegative().default(0),
  totalUAH: z.number().int().nonnegative(),
})
export type CreateOrderDTO = z.infer<typeof CreateOrderInput>
