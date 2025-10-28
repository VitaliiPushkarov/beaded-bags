export type ProductType = 'Всі' | 'Бананки' | 'Рюкзачки' | 'Чохли' | 'Шопери'

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
  type: ProductType
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
    productId: 'white-bag-001',
    slug: 'beaded-bag-white',
    name: 'Сумка з Бісеру — Біла',
    basePriceUAH: 3000,
    description: 'Ручна робота, бісер, 20×15 см',
    inStock: true,
    color: 'white',
    images: ['/img/white-bag.png', '/img/white-bag-02.png'],
    type: 'Всі',
    variants: [
      {
        id: 'var-white',
        color: 'white',
        hex: '#ffffff',
        image: '/img/white-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'classic-bag-001',
    slug: 'beaded-bag-classic',
    name: 'Сумка з Бісеру — Класика',
    basePriceUAH: 3500,
    description: 'Класична сумка з бісеру, 21×16 см',
    inStock: true,
    color: 'pink',
    images: ['/img/pink-bag.png', '/img/pink-bag-02.png'],
    type: 'Всі',
    variants: [
      {
        id: 'var-pink',
        color: 'pink',
        hex: '#FFBAD6',
        image: '/img/pink-bag.png',
        inStock: true,
      },
      {
        id: 'var-blue',
        color: 'blue',
        hex: '#1591EA',
        image: '/img/blue-bag.png',
        inStock: true,
      },
      {
        id: 'var-yellow',
        color: 'yellow',
        hex: '#FFE186',
        image: '/img/pink-bag-02.png',
        inStock: true,
      },
      {
        id: 'var-gray',
        color: 'gray',
        hex: '#2F4841',
        image: '/img/gray-bag.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'red-bag-001',
    slug: 'beaded-bag-red',
    name: 'Сумка з бісеру — Червона',
    basePriceUAH: 3500,
    description: 'Класична червона, 21×16 см',
    inStock: true,
    color: 'red',
    images: ['/img/red-bag.png', '/img/red-bag-02.png'],
    type: 'Всі',
    variants: [
      {
        id: 'var-red',
        color: 'red',
        hex: '#C11C84',
        image: '/img/red-bag-02.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'green-bag-001',
    slug: 'beaded-bag-green',
    name: 'Сумка з бісеру — Зелена',
    basePriceUAH: 3500,
    description: 'Класична зелена, 21×16 см',
    inStock: true,
    color: 'green',
    images: ['/img/green-bag.png'],
    type: 'Всі',
    variants: [
      {
        id: 'var-green',
        color: 'green',
        hex: '#2CFF05',
        image: '/img/green-bag.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'blue-bag-001',
    slug: 'beaded-bag-blue',
    name: 'Сумка з бісеру — Блакитна',
    basePriceUAH: 1800,
    description: 'Класична блакитна з бантиком, 21×16 см',
    inStock: true,
    color: 'blue',
    images: ['/img/blue-bag-bow.png'],
    type: 'Всі',
    variants: [
      {
        id: 'var-blue-bow',
        color: 'blue',
        hex: '#00F0FF',
        image: '/img/blue-bag-bow.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'gray-case-001',
    slug: 'gray-case',
    name: 'Чохол — Сірий',
    basePriceUAH: 900,
    description: 'Сірий чохол з бісеру для телефону, 15×7 см',
    inStock: true,
    color: 'gray',
    images: ['/img/gray-case.png'],
    type: 'Чохли',
    variants: [
      {
        id: 'gray-case-001',
        color: 'gray',
        hex: '#E0E0E0',
        image: '/img/gray-case.png',
        inStock: true,
      },
    ],
  },
  {
    productId: 'gray-knitted-bag-001',
    slug: 'gray-knitted-bag',
    name: 'Вʼязана сумка — Сіра',
    basePriceUAH: 2400,
    description: 'Сіра вʼязана сумка ручної роботи, 30×35 см',
    inStock: true,
    color: 'gray',
    images: ['/img/gray-bag.png'],
    type: 'Рюкзачки',
    variants: [
      {
        id: 'gray-knitted-bag-001',
        color: 'gray',
        hex: '#E0E0E0',
        image: '/img/gray-bag.png',
        inStock: true,
      },
    ],
  },
]
export const getBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug)
