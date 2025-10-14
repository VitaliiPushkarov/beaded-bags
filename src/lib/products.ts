export type Product = {
  id: string
  slug: string
  name: string
  priceUAH: number
  images: string[]
  description: string
  inStock: boolean
  color?: string
}
export type ProductVariant = {
  id: string
  color: string
  hex: string
  image: string
  inStock: boolean
  sku?: string
  priceUAH?: number
}
export const PRODUCTS: Product[] = [
  {
    id: 'blue-bag-001',
    slug: 'beaded-bag-blue',
    name: 'Beaded Bag — Blue',
    priceUAH: 3200,
    images: ['/img/blue-bag-02.png'], // Images for product cards
    description: 'Ручна робота, бісер, 20×15 см, під замовлення 3–5 днів',
    inStock: true,
    color: 'blue',
  },
  {
    id: 'pink-bag-001',
    slug: 'beaded-bag-pink',
    name: 'Beaded Bag — Pink',
    priceUAH: 3400,
    images: ['/img/pink-bag-02.png'], // Images for product cards
    description: 'Класична рожева, 21×16 см, у наявності',
    inStock: true,
    color: 'pink',
  },
  {
    id: 'white-bag-001',
    slug: 'beaded-bag-white',
    name: 'Beaded Bag — White',
    priceUAH: 3400,
    images: ['/img/white-bag-02.png'], // Images for product cards
    description: 'Класична біла, 21×16 см, у наявності',
    inStock: true,
    color: 'white',
  },
  {
    id: 'red-bag-001',
    slug: 'beaded-bag-red',
    name: 'Beaded Bag — Red',
    priceUAH: 3400,
    images: ['/img/red-bag-02.png'], // Images for product cards
    description: 'Класична червона, 21×16 см, у наявності',
    inStock: true,
    color: 'Red',
  },
  {
    id: 'bag-violet-001',
    slug: 'beaded-bag-violet',
    name: 'Beaded Bag — Violet',
    priceUAH: 3400,
    images: ['/img/blue-bag.png'], // Images for product cards
    description: 'Класична фіолетова, 21×16 см, у наявності',
    inStock: true,
    color: 'Violet',
  },
  {
    id: 'bag-violet-002',
    slug: 'beaded-bag-violet',
    name: 'Beaded Bag — Violet',
    priceUAH: 3400,
    images: ['/img/blue-bag.png'], // Images for product cards
    description: 'Класична фіолетова, 21×16 см, у наявності',
    inStock: true,
    color: 'Violet',
  },
  {
    id: 'bag-violet-003',
    slug: 'beaded-bag-violet',
    name: 'Beaded Bag — Violet',
    priceUAH: 3400,
    images: ['/img/blue-bag.png'], // Images for product cards
    description: 'Класична фіолетова, 21×16 см, у наявності',
    inStock: true,
    color: 'Violet',
  },
]
export const getBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug)
