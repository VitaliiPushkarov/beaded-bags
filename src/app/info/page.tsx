import Accordion from '@/components/ui/Accordion'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/server-locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: locale === 'en' ? 'Info' : 'Інформація',
    description:
      locale === 'en'
        ? 'Payment, shipping in Ukraine and useful recommendations.'
        : 'Оплата, доставка по Україні та корисні рекомендації.',
    alternates: {
      canonical: '/info',
    },
  }
}

export default async function InfoPage() {
  const locale = await getRequestLocale()
  const isEn = locale === 'en'
  const items = [
    {
      id: 'pay',
      title: isEn ? 'Payment' : 'Оплата',
      defaultOpen: true,
      content: (
        <div className="space-y-4 text-[15px] leading-relaxed">
          <p>
            {isEn
              ? 'We offer the following payment options:'
              : 'Ми надаємо можливість оплати наступними способами:'}
          </p>

          <p className="font-semibold">
            {isEn ? 'Card payment on the website.' : 'Оплата на сайті карткою.'}
          </p>
          <p className="text-gray-700">
            {isEn
              ? 'Online payment is processed via LiqPay checkout: bank card, Apple Pay and Google Pay (on supported devices/browsers).'
              : 'Онлайн-оплата працює через LiqPay checkout: банківська картка, Apple Pay та Google Pay (на сумісних пристроях/браузерах).'}
          </p>
          <p className="font-semibold">
            {isEn ? 'Cash on delivery' : 'Оплата при отриманні'}
          </p>
          <p className="text-gray-700">
            {isEn
              ? 'Nova Poshta cash on delivery, additional fee: 20 UAH + 2% of payment amount. This payment method is available for orders without custom changes.'
              : '(післяплата Нова пошта, додаткова комісія: 20 грн + 2% від суми платежу). Даний спосіб оплати дійсний для замовлень без будь-яких змін (вибір кольору з нашої палітри не є зміною).'}
          </p>

          <p className="text-gray-700">
            {isEn
              ? 'After placing an order, we will send all details to your email.'
              : 'Після того як ви визначилися з вибором і зробили замовлення через наш магазин, ми відправимо всю інформацію вам на email.'}
          </p>

          {/*  <div className="flex items-center gap-3 pt-1">
            <img src="/img/pay/applepay.svg" alt="Apple Pay" className="h-6" />
            <img
              src="/img/pay/googlepay.svg"
              alt="Google Pay"
              className="h-6"
            />
            <img src="/img/pay/visa.svg" alt="Visa" className="h-6" />
            <img
              src="/img/pay/mastercard.svg"
              alt="Mastercard"
              className="h-6"
            />
          </div> */}
        </div>
      ),
    },
    {
      id: 'delivery-ua',
      title: isEn ? 'Shipping in Ukraine' : 'Доставка по Україні',
      content: (
        <div className="space-y-4 text-[15px] leading-relaxed">
          <p>
            {isEn
              ? 'We ship with Nova Poshta across Ukraine. Delivery time is 1-3 days after confirmation/payment. After shipment you receive SMS/Viber tracking.'
              : 'Відправляємо «Новою поштою» по всій Україні. Строки доставки 1–3 дні після підтвердження/оплати замовлення. Після відправки ви отримаєте SMS/Viber із номером ТТН.'}
          </p>
          <ul className="list-disc pl-5 text-gray-700">
            <li>
              {isEn
                ? 'Shipping cost is charged by carrier rates.'
                : 'Вартість доставки — за тарифами перевізника.'}
            </li>
            <li>
              {isEn
                ? 'Pickup at branch or courier delivery.'
                : 'Самовивіз із відділення або доставка курʼєром.'}
            </li>
            <li>
              {isEn
                ? 'Cash on delivery with Nova Poshta fee (20 UAH + 2%).'
                : 'Післяплата — з комісією «Нової пошти» (20 грн + 2%).'}
            </li>
          </ul>
          <p className="text-gray-700">
            {isEn
              ? 'For made-to-order products, production and shipping timing is shown on product page or agreed with manager.'
              : 'Якщо товари виготовляються під замовлення, терміни виробництва та відправки вказуються на сторінці товару або узгоджуються з менеджером.'}
          </p>
        </div>
      ),
    },
    {
      id: 'tips',
      title: isEn ? 'Our recommendations' : 'Наші рекомендації',
      content: (
        <div className="space-y-3 text-[15px] leading-relaxed">
          <ul className="list-disc pl-5 text-gray-700">
            <li>
              {isEn
                ? 'Check full name and phone number carefully at checkout.'
                : 'Перевіряйте правильність ПІБ та телефону при оформленні.'}
            </li>
            <li>
              {isEn
                ? 'If you need to change an order, message us as soon as possible.'
                : 'Якщо потрібно змінити замовлення — напишіть нам якнайшвидше.'}
            </li>
            <li>
              {isEn
                ? 'Keep order confirmation email until parcel delivery.'
                : 'Зберігайте лист-підтвердження до отримання посилки.'}
            </li>
            <li>
              {isEn
                ? 'For gifts we can add a card, just leave a note in comments.'
                : 'Для подарунків можемо додати листівку — просто зазначте в коментарі.'}
            </li>
          </ul>
          <p className="text-gray-700">
            {isEn ? 'For any questions, write to' : 'З будь-яких питань — пишіть у'}{' '}
            <a href="mailto:support@gerdan.com" className="underline">
              support@gerdan.com
            </a>{' '}
            {isEn ? 'or Instagram.' : 'або в Instagram.'}
          </p>
        </div>
      ),
    },
  ]

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 py-10">
      <Suspense fallback={null}>
        {' '}
        <Breadcrumbs />{' '}
      </Suspense>
      <h1 className="text-3xl md:text-4xl font-semibold mb-6">
        {isEn ? 'INFO' : 'ІНФО'}
      </h1>
      <div className="flex gap-4 my-10 flex-col md:flex-row">
        <Link
          href="/oferta"
          className="w-full h-10 bg-gray-900 text-white text-center hover:bg-white hover:text-gray-900 border border-gray-900 flex items-center justify-center "
        >
          {isEn ? 'Public offer' : 'Публічна оферта'}{' '}
        </Link>
        <Link
          href="/policy"
          className="w-full h-10 bg-gray-900 text-white text-center hover:bg-white hover:text-gray-900 border border-gray-900 flex items-center justify-center"
        >
          {isEn ? 'Privacy policy' : 'Політика конфіденційності'}{' '}
        </Link>
        <Link
          href="/cashback"
          className="w-full h-10 bg-gray-900 text-white text-center hover:bg-white hover:text-gray-900 border border-gray-900 flex items-center justify-center"
        >
          {isEn ? 'Exchange & returns' : 'Обмін та повернення'}{' '}
        </Link>
      </div>
      <Accordion items={items} />
    </main>
  )
}
