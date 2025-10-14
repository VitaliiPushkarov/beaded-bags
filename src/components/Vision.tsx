// src/components/sections/Vision.tsx
'use client'
import { useEffect, useRef, useState } from 'react'

export default function Vision() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // авто-скейл: вміщуємо у вікно з невеликими полями
  useEffect(() => {
    const recalc = () => {
      const wrap = wrapRef.current
      const inner = innerRef.current
      if (!wrap || !inner) return

      const vw = window.innerWidth
      const vh = window.innerHeight

      // поля секції зверху/знизу
      const verticalPadding = 64 // px
      const horizontalPadding = 32 // px

      // природний розмір контенту (без скейлу)
      inner.style.transform = 'scale(1)'
      inner.style.transformOrigin = 'top center'
      const rect = inner.getBoundingClientRect()

      const sX = (vw - horizontalPadding * 2) / rect.width
      const sY = (vh - verticalPadding * 2) / rect.height
      const s = Math.min(1, sX, sY) // не збільшуємо, лише вміщуємо
      setScale(Number.isFinite(s) ? s : 1)
    }

    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(document.documentElement)
    ro.observe(wrapRef.current!)
    window.addEventListener('resize', recalc)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [])

  const W =
    'font-fixel-display uppercase tracking-tight leading-[0.95] text-[clamp(26px,6.8vw,88px)]'

  return (
    <section className="mx-auto max-w-[1440px] px-[50px]py-10 md:py-14 overflow-hidden">
      {/* Mobile — суцільний заголовок */}
      <h2 className="md:hidden font-fixel-display uppercase text-[10vw] leading-[0.95]">
        LEADING THE WORLD IN INCLUSIVE AND INNOVATIVE FASHION, EMPOWERING
        EVERYONE TO FEEL PERFECTLY THEMSELVES
      </h2>

      {/* Desktop — авто-скейл у межах вікна */}
      <div
        ref={wrapRef}
        className="hidden md:block relative min-h-[60vh]"
        style={{}}
      >
        <div
          ref={innerRef}
          className="grid grid-cols-12 gap-x-3 gap-y-7 relative"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {/* дрібні підписи */}
          <span className="absolute left-[50px] -top-6 text-[11px] tracking-[0.2em] uppercase">
            Our
          </span>
          <span className="absolute right-[50px] -top-6 text-[11px] tracking-[0.2em] uppercase">
            Is
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 -top-6 text-[11px] tracking-[0.2em] uppercase">
            Vision
          </span>

          {/* Розкладка слів */}
          <div className={`col-start-2 col-end-5 ${W}`}>Leading</div>
          <div className={`col-start-10 col-end-13 ${W}`}>World</div>

          <div className={`col-start-2 col-end-5 ${W}`}>The</div>
          <div className={`col-start-7 col-end-9 ${W}`}>In</div>
          <div className={`col-start-9 col-end-13 ${W}`}>Inclusive</div>

          <div className={`col-start-2 col-end-6 ${W}`}>
            And&nbsp;&nbsp;Innovative
          </div>
          <div className={`col-start-7 col-end-10 ${W}`}>Fashion,</div>

          <div className={`col-start-2 col-end-7 ${W}`}>Empowering</div>
          <div className={`col-start-9 col-end-13 ${W}`}>Everyone</div>

          <div className={`col-start-5 col-end-7 ${W}`}>To</div>
          <div className={`col-start-7 col-end-9 ${W}`}>Feel</div>
          <div className={`col-start-9 col-end-11 ${W}`}>Perfectly</div>

          <div className={`col-start-2 col-end-8 ${W}`}>Themselves</div>
        </div>
      </div>
    </section>
  )
}
