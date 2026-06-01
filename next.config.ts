import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['swiper'],
  images: {
    // Trim very large srcset candidates to reduce HTML payload for image-dense
    // catalog pages while keeping enough widths for desktop quality.
    deviceSizes: [640, 750, 828, 1080, 1200, 1536, 1920],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
}

export default nextConfig
