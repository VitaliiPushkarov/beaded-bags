'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n'

export default function Footer() {
  const t = useT()
  return (
    <footer className="border-t py-8 text-sm text-gray-500">
      <div className="max-w-6xl mx-auto px-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          © {new Date().getFullYear()} GERDAN.{' '}
          {t('Усі права захищені.', 'All rights reserved.')}
        </div>
        <div className="flex gap-4 flex-wrap">
          <Link href="/contacts" className="hover:text-gray-900">
            {t('Контакти', 'Contacts')}
          </Link>
          <Link href="/oferta" className="hover:text-gray-900">
            {t('Публічна оферта', 'Public offer')}
          </Link>
          <Link href="/cashback" className="hover:text-gray-900">
            {t('Умови обміну та повернення', 'Returns & exchange')}
          </Link>

          <Link href="/policy" className="hover:text-gray-900">
            {t('Політика конфіденційності', 'Privacy policy')}
          </Link>
          <Link href="/blog" className="hover:text-gray-900">
            {t('Блог', 'Blog')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
