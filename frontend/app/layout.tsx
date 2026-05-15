import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "ZENDBX - AI-Native Backend Platform",
  description: "Build production-ready backends in minutes. Zero configuration, instant APIs, built-in authentication, and AI-powered queries.",
  keywords: ["backend", "AI", "database", "API", "authentication", "multi-tenant", "BaaS"],
  authors: [{ name: "ZENDBX" }],
  openGraph: {
    title: "ZENDBX - AI-Native Backend Platform",
    description: "Build production-ready backends in minutes with zero configuration.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZENDBX - AI-Native Backend Platform",
    description: "Build production-ready backends in minutes with zero configuration.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
