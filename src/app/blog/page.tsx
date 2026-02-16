import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { getBlogPosts } from '@/lib/blog'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Блог',
  description:
    'Блог GERDAN про стиль, тренди аксесуарів і поради щодо вибору сумок ручної роботи.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Блог GERDAN',
    description:
      'Стиль, ідеї подарунків і тренди сумок ручної роботи в блозі GERDAN.',
    url: 'https://gerdan.online/blog',
    type: 'website',
    images: ['/icon1.png'],
  },
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogPage() {
  const posts = getBlogPosts()

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 py-10">
      <Suspense fallback={null}>
        <Breadcrumbs />
      </Suspense>

      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold mb-3">Блог GERDAN</h1>
        <p className="text-gray-600 max-w-3xl">
          Пишемо про стилізацію бісерних сумок, актуальні тренди та практичні
          ідеї для подарунків.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="border rounded-md overflow-hidden hover:border-gray-900 transition-colors"
          >
            <Link href={`/blog/${post.slug}`} className="block">
              <div className="relative aspect-[16/10] bg-gray-100">
                <Image
                  src={post.coverImage}
                  alt={post.coverImageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
                />
              </div>
            </Link>

            <div className="p-5">
              <div className="text-xs text-gray-500 mb-2">
                {formatDate(post.publishedAt)} · {post.readingMinutes} хв
                читання
              </div>
              <h2 className="text-xl font-semibold leading-snug mb-2">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="text-gray-700 mb-4">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-flex items-center text-sm underline underline-offset-2 hover:no-underline"
              >
                Читати статтю
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
