import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { getBlogPostBySlug } from '@/lib/blog'
import Image from 'next/image'
import { getRequestLocale } from '@/lib/server-locale'
import { getLocaleAlternates, getSiteUrl, toAbsoluteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

type BlogPostPageProps = {
  params: Promise<{ slug: string }>
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  const siteUrl = getSiteUrl(locale)

  if (!post) {
    return {
      title: locale === 'en' ? 'Article not found' : 'Статтю не знайдено',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const canonicalUrl = `${siteUrl}/blog/${post.slug}`
  const ogImageUrl = toAbsoluteUrl(post.coverImage, locale)

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: getLocaleAlternates(`/blog/${post.slug}`),
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonicalUrl,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [ogImageUrl],
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const locale = await getRequestLocale()
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  const siteUrl = getSiteUrl(locale)

  if (!post) notFound()

  const articleImage = toAbsoluteUrl(post.coverImage, locale)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    image: [articleImage],
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    author: {
      '@type': 'Organization',
      name: 'GERDAN',
    },
    publisher: {
      '@type': 'Organization',
      name: 'GERDAN',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/gerdan.svg`,
      },
    },
  }

  return (
    <main className="max-w-[900px] mx-auto px-4 md:px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <Suspense fallback={null}>
        <Breadcrumbs
          override={[
            { label: 'Головна', href: '/' },
            { label: 'Блог', href: '/blog' },
            { label: post.title },
          ]}
        />
      </Suspense>

      <article>
        <header className="mb-8 border-b pb-6">
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight mb-3">
            {post.title}
          </h1>
          <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden bg-gray-100 mb-4">
            <Image
              src={post.coverImage}
              alt={post.coverImageAlt}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 960px) 100vw, 900px"
            />
          </div>
          <p className="text-gray-600">{post.excerpt}</p>
          <div className="text-sm text-gray-500 mt-4">
            {formatDate(post.publishedAt)} · {post.readingMinutes} хв читання
          </div>
        </header>

        <div className="space-y-8">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold mb-3">{section.heading}</h2>
              <div className="space-y-3 text-[17px] leading-relaxed text-gray-800">
                {section.paragraphs.map((paragraph, idx) => (
                  <p key={`${section.heading}-${idx}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}
