import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains-mono', display: 'swap' });

const PRODUCTION_URL = "https://zendbx.in";

// Detect if we're on the production domain at runtime
// This is used server-side for metadata generation
const isProduction = process.env.NEXT_PUBLIC_APP_URL === "https://zendbx.in"
  || process.env.VERCEL_URL === "zendbx.in"
  || process.env.NODE_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_URL),

  title: {
    default: "Zendbx — Open Source Backend Platform",
    template: "%s | Zendbx",
  },
  description:
    "Zendbx is an AI-native Backend-as-a-Service providing PostgreSQL, Authentication, Storage, Realtime APIs, and Serverless Functions for developers.",
  keywords: [
    "backend as a service",
    "BaaS",
    "PostgreSQL",
    "authentication",
    "storage",
    "realtime",
    "AI",
    "API",
    "open source",
    "Supabase alternative",
    "serverless",
    "developer tools",
  ],
  authors: [{ name: "Zendbx", url: PRODUCTION_URL }],
  creator: "Zendbx",
  publisher: "Zendbx",

  // Canonical & alternates
  alternates: {
    canonical: PRODUCTION_URL,
  },

  // Only allow indexing on the real production domain
  robots: isProduction
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      }
    : {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: PRODUCTION_URL,
    siteName: "Zendbx",
    title: "Zendbx — Open Source Backend Platform",
    description:
      "Zendbx is an AI-native Backend-as-a-Service providing PostgreSQL, Authentication, Storage, Realtime APIs, and Serverless Functions for developers.",
    images: [
      {
        url: `${PRODUCTION_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Zendbx — Open Source Backend Platform",
      },
    ],
  },

  // Twitter / X Cards
  twitter: {
    card: "summary_large_image",
    site: "@zendbx",
    creator: "@zendbx",
    title: "Zendbx — Open Source Backend Platform",
    description:
      "AI-native BaaS: PostgreSQL, Auth, Storage, Realtime APIs, and Serverless Functions for developers.",
    images: [`${PRODUCTION_URL}/og-image.png`],
  },

  // Icons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
    shortcut: "/favicon.ico",
  },

  // Verification (add values when you have them)
  // verification: {
  //   google: "YOUR_GOOGLE_SITE_VERIFICATION_TOKEN",
  //   yandex: "YOUR_YANDEX_VERIFICATION_TOKEN",
  // },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Canonical URL — always points to production */}
        <link rel="canonical" href={PRODUCTION_URL} />

        {/* Structured Data — Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Zendbx",
              url: PRODUCTION_URL,
              logo: `${PRODUCTION_URL}/logo.png`,
              sameAs: [
                "https://github.com/zendbx",
                "https://twitter.com/zendbx",
              ],
              description:
                "Zendbx is an AI-native Backend-as-a-Service providing PostgreSQL, Authentication, Storage, Realtime APIs, and Serverless Functions for developers.",
            }),
          }}
        />

        {/* Structured Data — SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Zendbx",
              operatingSystem: "Web",
              applicationCategory: "DeveloperApplication",
              url: PRODUCTION_URL,
              description:
                "AI-native Backend-as-a-Service platform. Instant PostgreSQL, REST APIs, authentication, storage, and realtime subscriptions.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free tier available",
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-zinc-900 text-gray-100`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
