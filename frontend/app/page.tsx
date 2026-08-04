"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "@/components/landing/Hero";
import SocialProof from "@/components/landing/SocialProof";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import InteractiveDemo from "@/components/landing/InteractiveDemo";
import AIBuilderDemo from "@/components/landing/AIBuilderDemo";
import SDKSection from "@/components/landing/SDKSection";
import Pricing from "@/components/landing/Pricing";
import Testimonials from "@/components/landing/Testimonials";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";

export default function Home() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated and redirect to dashboard
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // User has a token, redirect to dashboard
          router.push('/dashboard');
          setIsAuthenticated(true);
          return;
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(255,107,0,0.15)' }} />
          <div className="relative w-10 h-10 rounded-full border-2 border-[#FF6B00]/30 border-t-[#FF6B00] animate-spin" />
        </div>
      </div>
    );
  }

  // If authenticated, show nothing (redirect is happening)
  if (isAuthenticated) {
    return null;
  }

  // Show landing page for unauthenticated users
  return (
    <main className="min-h-screen bg-zinc-900">
      <Navbar />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <Features />
      <InteractiveDemo />
      <AIBuilderDemo />
      <SDKSection />
      <Pricing />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
