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
  // Disable static page generation during build
  ...(process.env.SKIP_BUILD_STATIC_GENERATION === '1' && {
    output: 'export',
    distDir: '.next',
  }),
}

module.exports = nextConfig
