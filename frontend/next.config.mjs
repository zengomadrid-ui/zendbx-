/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  compress: true,
  eslint: {
    // Allow production builds to complete even with ESLint warnings
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Allow production builds to complete even with TypeScript errors
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  async headers() {
    return [
      // ── Security headers for every route ──────────────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },

      // ── API / private paths — never index ─────────────────────────────────
      {
        source: '/api/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },

      // ── Dashboard — authenticated, never index ─────────────────────────────
      {
        source: '/dashboard/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },

      // ── Auth pages — never index ───────────────────────────────────────────
      {
        source: '/(login|signup|onboarding|callback|forgot-password|reset-password|select-project)(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
