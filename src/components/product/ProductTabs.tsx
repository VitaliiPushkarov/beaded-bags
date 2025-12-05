'use client'
import { useState } from 'react'
import { CareInfoBlock } from '@/components/product/CareInfoBlock'

type Props = {
  description?: string | null
  info?: string | null
  dimensions?: string | null
}

function renderHtml(content?: string | null) {
  if (!content) return null
  return (
    <div
      className="text-gray-700 leading-relaxed whitespace-pre-line [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

export default function ProductTabs({ description, info, dimensions }: Props) {
  const [tab, setTab] = useState<'description' | 'info' | 'dimensions'>(
    'description'
  )

  const tabs = [
    { key: 'description', label: 'ОПИС' },
    { key: 'info', label: 'ІНФО' },
    { key: 'dimensions', label: 'ЗАМІРИ' },
  ] as const

  return (
    <div className="w-full mt-[27px]">
      {/* --- HEADER TABS --- */}
      <div className="flex gap-10 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              text-lg font-medium tracking-wide cursor-pointer
              ${tab === t.key ? 'text-black' : 'text-gray-400'}
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* --- CONTENT --- */}
      <div className="mt-4 text-sm leading-none whitespace-pre-line">
        {tab === 'description' && renderHtml(description)}
        {tab === 'info' && (info ? renderHtml(info) : <CareInfoBlock />)}
        {tab === 'dimensions' && renderHtml(dimensions)}
      </div>
    </div>
  )
}
