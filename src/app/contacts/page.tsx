import { MailIcon, PhoneIcon } from 'lucide-react'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'

export default function Contacts() {
  return (
    <main className="max-w-[1440px] mx-auto py-10 px-[50px]">
      <Suspense fallback={null}>
        {' '}
        <Breadcrumbs />{' '}
      </Suspense>

      <div className="flex flex-col gap-[50px]">
        <div className="flex items-center flex-col justify-center gap-5">
          <h3>Графік роботи:</h3>
          <p>пн-пт: 10:00 – 19:00, сб: 11:00 – 19:00</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 items-center">
          <div className="flex items-center justify-center flex-col gap-3">
            <MailIcon size={30} className="mx-auto mb-2" />
            <div className="flex gap-1">
              <p>Email:</p>
              <a href="mailto:pushkarov.vitalii@gmail.com">
                pushkarov.vitalii@gmail.com
              </a>
            </div>
          </div>
          <div className="flex items-center justify-center flex-col gap-3">
            <PhoneIcon size={30} className="mx-auto mb-2" />
            <div className="flex gap-1">
              <p>Phone:</p>
              <a href="phone:+380955837060">+380955837060</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
