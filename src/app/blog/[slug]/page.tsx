import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { getBlogPostBySlug, getBlogPosts } from '@/lib/blog'
import Image from 'next/image'

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

export function generateStaticParams() {
  return getBlogPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)

  if (!post) {
    return {
      title: 'Статтю не знайдено',
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const canonicalUrl = `https://gerdan.online/blog/${post.slug}`
  const ogImageUrl = post.coverImage.startsWith('http')
    ? post.coverImage
    : `https://gerdan.online${post.coverImage}`

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
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
  const { slug } = await params
  const post = getBlogPostBySlug(slug)

  if (!post) notFound()

  const articleImage = post.coverImage.startsWith('http')
    ? post.coverImage
    : `https://gerdan.online${post.coverImage}`

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    image: [articleImage],
    mainEntityOfPage: `https://gerdan.online/blog/${post.slug}`,
    author: {
      '@type': 'Organization',
      name: 'GERDAN',
    },
    publisher: {
      '@type': 'Organization',
      name: 'GERDAN',
      logo: {
        '@type': 'ImageObject',
        url: 'https://gerdan.online/gerdan.svg',
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
