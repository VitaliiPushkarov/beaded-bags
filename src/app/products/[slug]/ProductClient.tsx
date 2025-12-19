'use client'
import {
  useEffect,
  useMemo,
  useState,
  Suspense,
  useRef,
  FormEvent,
} from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

import VariantSwatches from '@/components/product/VariantSwatches'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import {
  Product,
  ProductVariant,
  ProductVariantImage,
  ProductVariantStrap,
  ProductAddon,
} from '@prisma/client'
import ProductGallery from '@/components/ProductGallery'
import ProductTabs from '@/components/product/ProductTabs'
import YouMayAlsoLike from '@/components/YouMayAlsoLike'
import { pushMetaViewContent } from '@/lib/analytics/datalayer'

type VariantWithImagesStrapsAndAddons = ProductVariant & {
  images: ProductVariantImage[]
  straps: ProductVariantStrap[]
  addonsOnVariant?: {
    addon: ProductAddon
  }[]
}

export type ProductWithVariants = Product & {
  variants: VariantWithImagesStrapsAndAddons[]
}

export function ProductClient({ p }: { p: ProductWithVariants }) {
  const sp = useSearchParams()
  const variantFromUrl = sp.get('variant') || undefined

  const [variantId, setVariantId] = useState<string | undefined>(
    p.variants?.[0]?.id
  )
  const [strapId, setStrapId] = useState<string | undefined>(undefined)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])
  const openCart = useUI((s) => s.openCart)

  // --- Preorder lead capture (when out of stock) ---
  const [preorderOpen, setPreorderOpen] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [leadContact, setLeadContact] = useState('')
  const [leadComment, setLeadComment] = useState('')
  const [preorderStatus, setPreorderStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')

  const submitPreorder = async (e: FormEvent) => {
    e.preventDefault()
    if (!v) return

    const payload = {
      productId: p.id,
      productSlug: p.slug,
      productName: p.name,
      variantId: v.id,
      variantColor: v.color ?? null,
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

      // fallback to mailto if endpoint missing / returns error
      throw new Error('preorder_api_failed')
    } catch {
      setPreorderStatus('error')

      const subject = encodeURIComponent(`Передзамовлення: ${p.name}`)
      const body = encodeURIComponent(
        `Хочу передзамовити товар.\n\n` +
          `Товар: ${p.name}\n` +
          `Варіант: ${v.color ? v.color : v.id}\n` +
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

  //sync variantId with URL param
  useEffect(() => {
    if (!variantFromUrl || !p.variants?.length) return
    const ok = p.variants.some((v) => v.id === variantFromUrl)
    if (ok) setVariantId(variantFromUrl)
  }, [variantFromUrl, p.variants])

  const v = useMemo(
    () =>
      p.variants?.find((x) => x.id === variantId) ?? p.variants?.[0] ?? null,
    [p.variants, variantId]
  )

  // Обраний ремінець для поточного варіанту
  const selectedStrap = useMemo(
    () => v?.straps?.find((s) => s.id === strapId) ?? null,
    [v, strapId]
  )

  // Коли змінюється варіант — автоматично обираємо перший ремінець (якщо є)
  useEffect(() => {
    if (v && v.straps && v.straps.length > 0) {
      setStrapId(v.straps[0].id)
    } else {
      setStrapId(undefined)
    }
    // при зміні варіанту скидаємо вибрані прикраси
    setSelectedAddonIds([])
  }, [v])

  const variantInStock = !!v?.inStock
  const add = useCart((s) => s.add)

  // Доступні прикраси/аддони для цього варіанту
  const availableAddons = useMemo(
    () =>
      (v?.addonsOnVariant || [])
        .map((av) => av.addon)
        .filter((addon) => addon.active),
    [v]
  )

  const addonsTotal = useMemo(
    () =>
      availableAddons
        .filter((a) => selectedAddonIds.includes(a.id))
        .reduce((sum, a) => sum + (a.priceUAH ?? 0), 0),
    [availableAddons, selectedAddonIds]
  )

  const addonsById = useMemo(() => {
    const map: Record<string, ProductAddon> = {}
    availableAddons.forEach((a) => {
      map[a.id] = a
    })
    return map
  }, [availableAddons])

  // Ціна сумки — статична, прикраси вираховуються окремо
  const basePrice = v?.priceUAH ?? p.basePriceUAH ?? 0

  const price = basePrice + addonsTotal
  // --- Meta Pixel via GTM: ViewContent (fires once per selected variant) ---
  const viewedKeyRef = useRef<string>('')
  useEffect(() => {
    if (!v) return

    const contentId = v.id
    const contentName = `${p.name}${v.color ? ` — ${v.color}` : ''}`
    const key = `${p.id}:${contentId}`

    // prevent duplicates on re-renders / StrictMode; also ignore addon changes
    if (viewedKeyRef.current === key) return
    viewedKeyRef.current = key

    pushMetaViewContent({
      contentId,
      contentName,
      value: basePrice, // product base price only; addons are separate items
      productId: p.id,
      variantId: v.id,
      slug: p.slug,
    })
  }, [p.id, p.name, p.slug, v?.id, v?.color, basePrice])

  const galleryImages = useMemo(() => {
    if (!v) return ['/img/placeholder.png']

    const base: string[] = []

    if (Array.isArray(v.images) && v.images.length > 0) {
      ;[...v.images]
        .sort((a, b) => a.sort - b.sort)
        .forEach((img) => {
          if (img.url && !base.includes(img.url)) base.push(img.url)
        })
    }

    // fallback to variant image
    if (v.image && !base.includes(v.image)) {
      base.push(v.image)
    }

    if (!base.length) base.push('/img/placeholder.png')

    // Якщо обрано ремінець з власним зображенням — показуємо його першим
    if (selectedStrap) {
      const strapImage = selectedStrap.mainImageUrl || selectedStrap.imageUrl
      if (strapImage) {
        const withStrapFirst = [
          strapImage,
          ...base.filter((url) => url !== strapImage),
        ]
        return withStrapFirst
      }
    }

    return base
  }, [v, selectedStrap])

  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <section className="mx-auto flex flex-col items-center md:items-stretch md:flex-row md:justify-between gap-4 md:gap-10 mb-[60px] md:px-6">
        {/* Ліва колонка: карусель */}
        <ProductGallery images={galleryImages} />

        {/* Права колонка */}
        <div className="flex flex-col items-start w-full lg:w-[33%]">
          <h2 className=" md:text-[38px] text-2xl font-fixel-display font-medium md:mb-6 mb-3">
            {p.name}
          </h2>

          <div className=" text-lg md:text-2xl mb-1">{basePrice} ₴</div>
          {addonsTotal > 0 && (
            <div className="text-xs text-gray-600 mb-2">
              Обрані прикраси: +{addonsTotal} ₴
            </div>
          )}
          {/* inStock Status */}
          <div className="flex items-center gap-2 text-sm mb-3">
            <span
              className={`inline-block h-2 w-2 rounded-full flex-none ${
                variantInStock ? 'bg-green-500' : 'bg-red-300'
              }`}
            />
            <span
              className={variantInStock ? 'text-green-700' : 'text-red-500'}
            >
              {variantInStock
                ? 'Є в наявності'
                : 'Відкрито передзамовлення (7–14 робочих днів). Залиште контакт — ми напишемо вам.'}
            </span>
          </div>
          {/* Divider */}
          <div className="w-full border-t border-gray-200 mb-3" />
          {/* Color + variant swatches and strap selection */}
          {p.variants.length > 0 && (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                <span>Колір:</span>
                {v?.color && (
                  <span className="font-medium text-gray-900">{v.color}</span>
                )}
              </div>

              <VariantSwatches
                variants={p.variants}
                value={variantId!}
                onChange={setVariantId}
              />

              {/* Вибір ремінця */}
              {v?.straps && v.straps.length > 0 && (
                <div className="mt-4 w-full">
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                    <span>Ремінець:</span>
                    {selectedStrap && (
                      <span className="font-medium text-gray-900">
                        {selectedStrap.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...v.straps]
                      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                      .map((s) => {
                        const isActive = s.id === strapId
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStrapId(s.id)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition cursor-pointer ${
                              isActive
                                ? 'border-black bg-black text-white'
                                : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                            }`}
                          >
                            {s.imageUrl && (
                              <span className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-100">
                                <Image
                                  src={s.imageUrl}
                                  alt={s.name}
                                  fill
                                  className="object-cover"
                                />
                              </span>
                            )}
                            <span>{s.name}</span>
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Прикрасити виріб — додаткові прикраси (горизонтальний слайдер) */}
              {availableAddons.length > 0 && (
                <div className="mt-6 w-full">
                  <div className="mb-3 text-sm font-medium text-gray-700">
                    Прикрасити виріб:
                  </div>

                  <div className="-mx-1 overflow-x-auto">
                    <div className="flex gap-3 px-1 pb-1">
                      {availableAddons
                        .slice()
                        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                        .map((addon) => {
                          const isSelected = selectedAddonIds.includes(addon.id)
                          return (
                            <div
                              key={addon.id}
                              className="relative shrink-0 w-[140px]"
                            >
                              {/* Картинка як лінк на сторінку аксесуара */}
                              <Link href={`/accessories/${addon.slug}`}>
                                <div className="relative w-full aspect-4/5 rounded-lg overflow-hidden bg-gray-100">
                                  {addon.imageUrl && (
                                    <Image
                                      src={addon.imageUrl}
                                      alt={addon.name}
                                      fill
                                      className="object-cover"
                                    />
                                  )}
                                </div>
                              </Link>

                              {/* Кнопка + / ✓ у верхньому кутку */}
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedAddonIds((prev) =>
                                    prev.includes(addon.id)
                                      ? prev.filter((id) => id !== addon.id)
                                      : [...prev, addon.id]
                                  )
                                }
                                className={`absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-md border text-base font-medium shadow-sm transition cursor-pointer ${
                                  selectedAddonIds.includes(addon.id)
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-gray-800 border-gray-300 hover:border-black'
                                }`}
                                style={{
                                  zIndex: 20, // гарантує видимість
                                }}
                              >
                                {selectedAddonIds.includes(addon.id)
                                  ? '✓'
                                  : '+'}
                              </button>

                              {/* Назва + ціна під картинкою */}
                              <div className="mt-2 text-xs text-gray-900">
                                {addon.name}
                              </div>
                              <div className="text-xs text-gray-600">
                                {addon.priceUAH} ₴
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Button "Add to cart" */}
          <button
            className="mt-3 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[18px] py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
            disabled={!variantInStock}
            onClick={() => {
              if (!v) return

              // 1) додаємо в кошик сумку (тільки її ціна)
              add({
                productId: p.id,
                variantId: v.id,
                name: `${p.name}${v.color ? ` — ${v.color}` : ''}`,
                priceUAH: basePrice,
                image: galleryImages[0],
                qty: 1,
                slug: p.slug,
              })

              // 2) додаємо в кошик кожну обрану прикрасу як окремий товар
              selectedAddonIds.forEach((addonId) => {
                const addon = addonsById[addonId]
                if (!addon) return
                add({
                  productId: addon.id,
                  variantId: addon.id,
                  name: addon.name,
                  priceUAH: addon.priceUAH ?? 0,
                  image: addon.imageUrl || galleryImages[0],
                  qty: 1,
                  slug: addon.slug,
                })
              })

              openCart()
            }}
          >
            Додати в кошик
          </button>

          {!variantInStock && (
            <button
              type="button"
              className="mt-2 inline-flex items-center justify-center w-full h-10 border border-black bg-white text-black px-5 text-[18px] py-2 hover:bg-black hover:text-white transition cursor-pointer"
              onClick={() => {
                setPreorderStatus('idle')
                setPreorderOpen(true)
              }}
            >
              Передзамовити
            </button>
          )}

          {/* Preorder modal */}
          {preorderOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setPreorderOpen(false)}
                aria-hidden="true"
              />

              <div className="relative w-[92%] max-w-md rounded-xl bg-white p-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-medium">Передзамовлення</div>
                    <div className="mt-1 text-sm text-gray-600">
                      Залиште контакт — і ми Вам передзвонимо!
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {p.name}
                      {v?.color ? ` — ${v.color}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-md border border-gray-200 hover:border-black transition cursor-pointer"
                    onClick={() => setPreorderOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <form className="mt-4 space-y-3" onSubmit={submitPreorder}>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Ім’я
                    </label>
                    <input
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      placeholder="Ваше ім’я"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Телефон <span className="text-red-500">*</span>
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
                      Коментар
                    </label>
                    <textarea
                      value={leadComment}
                      onChange={(e) => setLeadComment(e.target.value)}
                      className="w-full min-h-[90px] rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                      placeholder="Наприклад: хочу з ремінцем…, доставка в…"
                    />
                  </div>

                  {preorderStatus === 'success' ? (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                      Дякуємо! Ми отримали ваш контакт і скоро з вами
                      зв’яжемось.
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={preorderStatus === 'submitting'}
                      className="mt-1 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[16px] py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
                    >
                      {preorderStatus === 'submitting'
                        ? 'Надсилаємо…'
                        : 'Надіслати'}
                    </button>
                  )}

                  {preorderStatus === 'error' && (
                    <div className="text-xs text-gray-600">
                      Якщо форма не відправилась — відкриється лист для швидкого
                      передзамовлення.
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          <ProductTabs
            description={p.description}
            info={p.info}
            dimensions={p.dimensions}
          />
          <div className="mt-8 space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Відправка протягом 1–3 днів</span>
            </div>

            <p>
              Маєте питання? Напишіть нам у{' '}
              <a
                href="https://instagram.com/gerdan.studio"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Instagram
              </a>
              .
            </p>
          </div>
        </div>
      </section>
      <YouMayAlsoLike currentSlug="" />
    </Suspense>
  )
}
