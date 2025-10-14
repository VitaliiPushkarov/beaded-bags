export default function HeroAbout() {
  const dots = [
    'top-6 left-8 w-10 h-10',
    'top-10 right-10 w-14 h-14',
    'bottom-16 right-20 w-24 h-24',
    'bottom-10 left-10 w-16 h-16',
    'top-1/3 right-32 w-16 h-16 border',
  ]
  return (
    <section className="bg-black text-white relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 rotate-90 text-sm tracking-[0.5em] text-gray-300">
          ABOUT
        </div>

        <h1 className="text-5xl md:text-7xl font-semibold tracking-[0.3em]">
          GERDAN
        </h1>

        <div className="mt-8 space-y-3 text-xl md:text-2xl">
          <div>ЗБЕРІГАЄМО ДУХ</div>
          <div className="pl-8 md:pl-24">УКРАЇНСЬКОГО РЕМЕСЛА</div>
          <div className="pl-0 md:pl-8 text-white/90">У ФОРМІ СЬОГОДЕННЯ</div>
        </div>
      </div>

      {/* кола */}
      {dots.map((c, i) => (
        <span
          key={i}
          className={`absolute ${c} rounded-full ${
            c.includes('border') ? 'border border-white/50' : 'bg-white/90'
          }`}
        />
      ))}
    </section>
  )
}
