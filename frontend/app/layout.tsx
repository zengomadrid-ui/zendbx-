import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: "ZENDBX - AI-Native Backend Platform",
  description: "Build production-ready backends in minutes. Zero configuration, instant APIs, built-in authentication, and AI-powered queries.",
  keywords: ["backend", "AI", "database", "API", "authentication", "BaaS"],
  authors: [{ name: "ZENDBX" }],
  icons: { icon: '/logo.png', apple: '/logo.png' },
  openGraph: {
    title: "ZENDBX - AI-Native Backend Platform",
    description: "Build production-ready backends in minutes.",
    type: "website",
    images: ['/logo.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-zinc-900 text-gray-100`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}