export type Product = {
  productId: string
  slug: string
  name: string
  basePriceUAH: number
  description: string
  inStock: boolean
  color?: string
  variants: ProductVariant[]
  images: string[]
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
    productId: 'blue-bag-001',
    slug: 'beaded-bag-blue',
    name: 'Beaded Bag — Blue',
    basePriceUAH: 3200,
    description: 'Ручна робота, бісер, 20×15 см, під замовлення 3–5 днів',
    inStock: true,
    color: 'blue',
    images: ['/img/blue-bag-02.png', '/img/blue-bag.png'],
    variants: [
      {
        id: 'var-pink',
        color: 'Pink',
        hex: '#EFB6CB',
        image: '/img/blue-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'pink-bag-001',
    slug: 'beaded-bag-pink',
    name: 'Beaded Bag — Pink',
    basePriceUAH: 3400,
    description: 'Класична рожева, 21×16 см, у наявності',
    inStock: true,
    color: 'pink',
    images: ['/img/pink-bag-02.png', '/img/pink-bag.png'],
    variants: [
      {
        id: 'var-pink',
        color: 'Pink',
        hex: '#EFB6CB',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'white-bag-001',
    slug: 'beaded-bag-white',
    name: 'Beaded Bag — White',
    basePriceUAH: 3400,
    description: 'Класична біла, 21×16 см, у наявності',
    inStock: true,
    color: 'white',
    images: ['/img/white-bag-02.png', '/img/white-bag.png'],
    variants: [
      {
        id: 'var-white',
        color: 'White',
        hex: '#EFB6CB',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'red-bag-001',
    slug: 'beaded-bag-red',
    name: 'Beaded Bag — Red',
    basePriceUAH: 3400,
    description: 'Класична червона, 21×16 см, у наявності',
    inStock: true,
    color: 'Red',
    images: ['/img/red-bag-02.png', '/img/red-bag.png'],
    variants: [
      {
        id: 'var-pink',
        color: 'Pink',
        hex: '#EFB6CB',
        image: '/img/blue-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'bag-violet-001',
    slug: 'beaded-bag-violet',
    name: 'Beaded Bag — Violet',
    basePriceUAH: 3400,
    description: 'Класична фіолетова, 21×16 см, у наявності',
    inStock: true,
    color: 'Violet',
    images: ['/img/red-bag-02.png', '/img/red-bag.png'],
    variants: [
      {
        id: 'var-pink',
        color: 'Pink',
        hex: '#EFB6CB',
        image: '/img/blue-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'bag-violet-002',
    slug: 'beaded-bag-violet',
    name: 'Beaded Bag — Violet',
    basePriceUAH: 3400,
    description: 'Класична фіолетова, 21×16 см, у наявності',
    inStock: true,
    color: 'Violet',
    images: ['/img/red-bag-02.png', '/img/red-bag.png'],
    variants: [
      {
        id: 'var-pink',
        color: 'Pink',
        hex: '#EFB6CB',
        image: '/img/blue-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'bag-violet-003',
    slug: 'beaded-bag-violet',
    name: 'Beaded Bag — Violet',
    basePriceUAH: 3400,
    description: 'Класична фіолетова, 21×16 см, у наявності',
    inStock: true,
    color: 'Violet',
    images: ['/img/red-bag-02.png', '/img/red-bag.png'],
    variants: [
      {
        id: 'var-pink',
        color: 'Pink',
        hex: '#EFB6CB',
        image: '/img/blue-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-sand',
        color: 'Sand',
        hex: '#D9A35E',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-oliv',
        color: 'Olive',
        hex: '#5E7D5B',
        image: '/img/red-bag-02.png',
        inStock: false,
      },
      {
        id: 'var-deep',
        color: 'Deep',
        hex: '#2F4841',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
]
export const getBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug)
