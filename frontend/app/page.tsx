"use client";

import Hero from "@/components/landing/Hero";
import SocialProof from "@/components/landing/SocialProof";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import InteractiveDemo from "@/components/landing/InteractiveDemo";
import SDKSection from "@/components/landing/SDKSection";
import Pricing from "@/components/landing/Pricing";
import Testimonials from "@/components/landing/Testimonials";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <Navbar />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <Features />
      <InteractiveDemo />
      <SDKSection />
      <Pricing />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
