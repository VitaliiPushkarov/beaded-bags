import Accordion from '@/components/ui/Accordion'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'

export const metadata = {
  title: 'ІНФО | GERDAN',
  description: 'Оплата, доставка по Україні та корисні рекомендації.',
}

export default function InfoPage() {
  const items = [
    {
      id: 'pay',
      title: 'Оплата',
      defaultOpen: true,
      content: (
        <div className="space-y-4 text-[15px] leading-relaxed">
          <p>Ми надаємо можливість оплати наступними способами:</p>

          <p className="font-semibold">Оплата на сайті карткою.</p>

          <p className="font-semibold">Оплата при отриманні</p>
          <p className="text-gray-700">
            (післяплата Нова пошта, додаткова комісія: 20 грн + 2% від суми
            платежу). Даний спосіб оплати дійсний для замовлень без будь-яких
            змін (вибір кольору з нашої палітри не є зміною).
          </p>

          <p className="text-gray-700">
            Після того як ви визначилися з вибором і зробили замовлення через
            наш магазин, ми відправимо всю інформацію вам на email. При оплаті
            на сайті LiqPay додаткових дій не потрібно.
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
      title: 'Доставка по Україні',
      content: (
        <div className="space-y-4 text-[15px] leading-relaxed">
          <p>
            Відправляємо «Новою поштою» по всій Україні. Строки доставки 1–3 дні
            після підтвердження/оплати замовлення. Після відправки ви отримаєте
            SMS/Viber із номером ТТН.
          </p>
          <ul className="list-disc pl-5 text-gray-700">
            <li>Вартість доставки — за тарифами перевізника.</li>
            <li>Самовивіз із відділення або доставка курʼєром.</li>
            <li>Післяплата — з комісією «Нової пошти» (20 грн + 2%).</li>
          </ul>
          <p className="text-gray-700">
            Якщо товари виготовляються під замовлення, терміни виробництва та
            відправки вказуються на сторінці товару або узгоджуються з
            менеджером.
          </p>
        </div>
      ),
    },
    {
      id: 'tips',
      title: 'Наші рекомендації',
      content: (
        <div className="space-y-3 text-[15px] leading-relaxed">
          <ul className="list-disc pl-5 text-gray-700">
            <li>Перевіряйте правильність ПІБ та телефону при оформленні.</li>
            <li>
              Якщо потрібно змінити замовлення — напишіть нам якнайшвидше.
            </li>
            <li>Зберігайте лист-підтвердження до отримання посилки.</li>
            <li>
              Для подарунків можемо додати листівку — просто зазначте в
              коментарі.
            </li>
          </ul>
          <p className="text-gray-700">
            З будь-яких питань — пишіть у{' '}
            <a href="mailto:support@gerdan.com" className="underline">
              support@gerdan.com
            </a>{' '}
            або в Instagram.
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
      <h1 className="text-3xl md:text-4xl font-semibold mb-6">ІНФО</h1>
      <Accordion items={items} />
    </main>
  )
}
