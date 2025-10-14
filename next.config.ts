import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Додаємо Swiper у транспіляцію, щоб він працював з Next 15 / React 19
  transpilePackages: ['swiper'],
}

export default nextConfig
