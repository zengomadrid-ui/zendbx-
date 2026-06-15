'use client';

import { useEffect, useRef } from 'react';

function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return ref;
}

const TESTIMONIALS = [
  {
    quote: "We replaced a week of backend work with a 30-second ZendBX setup. The auto-generated APIs are exactly what we needed.",
    name: "Sarah Chen",
    role: "CTO",
    company: "Launchpad",
    initials: "SC",
  },
  {
    quote: "The TypeScript SDK is the best DX I've seen for a BaaS platform. It feels like Supabase but faster to ship with.",
    name: "James Okafor",
    role: "Senior Engineer",
    company: "Finflow",
    initials: "JO",
  },
  {
    quote: "I built and deployed a full production backend in one afternoon. RLS policies, auth, realtime — everything just worked.",
    name: "Priya Nair",
    role: "Founder",
    company: "Stackbloom",
    initials: "PN",
  },
];

export default function Testimonials() {
  const headRef = useReveal(0);
  return (
    <section className="bg-[#000] py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.12), transparent)' }} />

      <div className="max-w-6xl mx-auto px-4">
        <div ref={headRef} className="text-center mb-14">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500 mb-4">Loved by developers</p>
          <h2 className="text-4xl sm:text-5xl font-semibold text-white leading-tight tracking-[-0.01em]">
            Don't take our word for it.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {TESTIMONIALS.map((t, i) => {
            const ref = useReveal(i * 80);
            return (
              <div key={t.name} ref={ref}
                className="group rounded-2xl border border-white/[0.06] bg-[#080808] p-6 hover:border-orange-500/15 transition-all duration-500 relative overflow-hidden">
                {/* Subtle hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 50% 100%, rgba(249,115,22,0.05), transparent 70%)' }} />

                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-3.5 h-3.5 text-orange-500 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>

                <p className="text-[15px] text-neutral-300 leading-relaxed mb-6">"{t.quote}"</p>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[11px] font-bold text-orange-400">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white">{t.name}</p>
                    <p className="text-[12px] text-neutral-600">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
