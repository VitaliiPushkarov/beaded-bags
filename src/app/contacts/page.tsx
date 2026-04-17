import { Building, MailIcon, PhoneIcon } from 'lucide-react'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/server-locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: locale === 'en' ? 'Contacts' : 'Контакти',
    description:
      locale === 'en'
        ? 'GERDAN contacts: business hours, phone, email and address.'
        : 'Контакти GERDAN: графік роботи, телефон, email та адреса магазину.',
    alternates: {
      canonical: '/contacts',
    },
  }
}

export default async function Contacts() {
  const locale = await getRequestLocale()
  const isEn = locale === 'en'
  return (
    <main className="max-w-[1440px] mx-auto py-6 px-[50px]">
      <Suspense fallback={null}>
        {' '}
        <Breadcrumbs />{' '}
      </Suspense>

      <div className="flex flex-col gap-[50px]">
        <h1 className="text-3xl md:text-4xl font-semibold text-center">
          {isEn ? 'Contacts' : 'Контакти'}
        </h1>
        <div className="flex items-center flex-col justify-center gap-5">
          <h3>{isEn ? 'Business hours:' : 'Графік роботи:'}</h3>
          <p>{isEn ? 'Mon-Sun: 11:00 - 20:00' : 'пн-нд: 11:00 – 20:00'}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 gap-y-10 items-center">
          <div className="flex items-center justify-center flex-col gap-3">
            <MailIcon size={30} className="mx-auto mb-2" />
            <div className="flex gap-1">
              <p className="font-semibold">Email:</p>
              <a
                href="mailto:gerdanstudio@gmail.com"
                className="hover:text-pink-500"
              >
                gerdanstudio@gmail.com
              </a>
            </div>
          </div>
          <div className="flex items-center justify-center flex-col gap-3">
            <PhoneIcon size={30} className="mx-auto mb-2" />
            <div className="flex gap-1">
              <p className="font-semibold">Phone:</p>
              <a href="phone:+380955837060" className="hover:text-pink-500">
                +380955837060
              </a>
            </div>
          </div>
          <div className="flex items-center justify-center flex-col gap-3">
            <Building size={30} className="mx-auto mb-2" />
            <div className="flex gap-1">
              <p className="font-semibold">{isEn ? 'Address:' : 'Адреса:'}</p>
              <p>
                {isEn
                  ? '62 Velyka Perspektyvna St, Kropyvnytskyi, Ukraine'
                  : 'вул.Велика Перспективна 62, Кропивницький, Україна'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
