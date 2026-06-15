'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function CTA() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="bg-[#000] py-28 relative overflow-hidden">
      {/* Top line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.15), transparent)' }} />

      {/* Big ambient circle */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(249,115,22,0.07), transparent)' }} />

      <div className="max-w-4xl mx-auto px-4 text-center relative z-10" ref={ref}>

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-orange-500/20 bg-orange-500/5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-semibold text-orange-400">Free forever plan available</span>
        </div>

        <h2 className="text-5xl sm:text-6xl lg:text-[72px] font-black text-white leading-[1.03] tracking-[-0.03em] mb-6">
          Ready to ship<br />
          <span className="text-orange-500">your backend?</span>
        </h2>

        <p className="text-lg text-neutral-500 max-w-lg mx-auto mb-10 leading-relaxed">
          Join thousands of developers who replaced weeks of infrastructure work with a 30-second setup.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-2 px-8 py-4 font-bold text-[15px] text-black rounded-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-orange-500 group-hover:bg-orange-400 transition-colors duration-200" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12), transparent)' }} />
            <span className="relative">Start building — it's free</span>
            <svg className="relative w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link href="/docs"
            className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-[15px] text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all hover:bg-white/[0.02]">
            Read the docs
          </Link>
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-700">
          {['No credit card required', '2 free projects forever', 'Up and running in 30s'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
