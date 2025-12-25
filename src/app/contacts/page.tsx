import { Building, MailIcon, PhoneIcon } from 'lucide-react'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'

export default function Contacts() {
  return (
    <main className="max-w-[1440px] mx-auto py-6 px-[50px]">
      <Suspense fallback={null}>
        {' '}
        <Breadcrumbs />{' '}
      </Suspense>

      <div className="flex flex-col gap-[50px]">
        <div className="flex items-center flex-col justify-center gap-5">
          <h3>Графік роботи:</h3>
          <p>пн-нд: 11:00 – 20:00</p>
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
              <p className="font-semibold">Юр. адреса:</p>
              <p>
                Україна, 25031, Кіровоградська обл., місто Кропивницький,
                вул.Героїв України, будинок 12
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
