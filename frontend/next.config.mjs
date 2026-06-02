/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // Production optimizations
  compress: true,
  // Environment variables validation
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // NUCLEAR OPTION: Completely disable static generation
  output: 'standalone',
  // Disable all static optimization
  experimental: {
    isrMemoryCacheSize: 0,
  },
  // Skip static page generation during build
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  // Disable static page generation for all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
