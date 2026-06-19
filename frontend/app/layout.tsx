import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains-mono', display: 'swap' });

const PRODUCTION_URL = "https://zendbx.in";

// Only allow search engine indexing on the real production domain.
// NEXT_PUBLIC_API_URL is set to https://api.zendbx.in on Vercel; on any other
// host (devapp, staging, localhost) it will be falsy or a different URL.
const isProduction =
  process.env.NEXT_PUBLIC_APP_URL === "https://zendbx.in";

const TITLE = "Zendbx \u2014 AI-Native Backend Platform";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_URL),

  title: {
    default: TITLE,
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

  alternates: {
    canonical: PRODUCTION_URL,
  },

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

  openGraph: {
    type: "website",
    locale: "en_US",
    url: PRODUCTION_URL,
    siteName: "Zendbx",
    title: TITLE,
    description:
      "Zendbx is an AI-native Backend-as-a-Service providing PostgreSQL, Authentication, Storage, Realtime APIs, and Serverless Functions for developers.",
    images: [
      {
        url: `${PRODUCTION_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    site: "@zendbx",
    creator: "@zendbx",
    title: TITLE,
    description:
      "AI-native BaaS: PostgreSQL, Auth, Storage, Realtime APIs, and Serverless Functions for developers.",
    images: [`${PRODUCTION_URL}/og-image.png`],
  },

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href={PRODUCTION_URL} />

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
