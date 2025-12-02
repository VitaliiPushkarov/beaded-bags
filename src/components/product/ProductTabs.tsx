'use client'
import { useState } from 'react'

type Props = {
  description?: string | null
  info?: string | null
  dimensions?: string | null
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
    <div className="w-full mt-[27px] pt-6">
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
      <div className="text-gray-700 leading-relaxed whitespace-pre-line">
        {tab === 'description' && <div>{description}</div>}
        {tab === 'info' && <div>{info}</div>}
        {tab === 'dimensions' && <div>{dimensions}</div>}
      </div>
    </div>
  )
}
