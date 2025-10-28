'use client'

import { useState } from 'react'
import clsx from 'clsx'

type Item = {
  id: string
  title: string
  content: React.ReactNode
  defaultOpen?: boolean
}

export default function Accordion({
  items,
  className,
}: {
  items: Item[]
  className?: string
}) {
  const [openId, setOpenId] = useState<string | null>(
    items.find((i) => i.defaultOpen)?.id ?? null
  )

  return (
    <div className={clsx('divide-y border-2', className)}>
      {items.map((it) => {
        const isOpen = openId === it.id
        return (
          <section key={it.id}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`acc-panel-${it.id}`}
                onClick={() => setOpenId(isOpen ? null : it.id)}
                className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left hover:bg-gray-900 hover:text-white cursor-pointer"
              >
                <span className="font-medium">{it.title}</span>
                <span
                  className={clsx(
                    'transition-transform text-2xl leading-none select-none',
                    isOpen ? 'rotate-180' : 'rotate-0'
                  )}
                >
                  ▾
                </span>
              </button>
            </h3>

            <div
              id={`acc-panel-${it.id}`}
              role="region"
              hidden={!isOpen}
              className="px-[20px] py-[14px] mt-[15px]"
            >
              {it.content}
            </div>
          </section>
        )
      })}
    </div>
  )
}
