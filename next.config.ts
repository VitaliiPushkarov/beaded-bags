import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['swiper'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
}

export default nextConfig
