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
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return ref;
}

const STEPS = [
  {
    n: '01',
    title: 'Create a project',
    body: 'Sign up and create your first project. A dedicated PostgreSQL database is provisioned in under 5 seconds.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Define your schema',
    body: 'Create tables using the visual editor, SQL editor, or CSV import. Your REST API and TypeScript types are generated instantly.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Install the SDK',
    body: 'Run npm install zendbx. Configure with your project URL and anon key. Query your database from any frontend or backend in seconds.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Ship to production',
    body: 'Deploy with confidence. Your database, APIs, auth, and realtime are already production-grade with 99.9% uptime SLA.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3l14 9-14 9V3z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const headRef = useReveal(0);
  return (
    <section id="how" className="bg-[#000] py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.12), transparent)' }} />

      <div className="max-w-6xl mx-auto px-4">
        <div ref={headRef} className="text-center mb-16">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500 mb-4">How it works</p>
          <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold text-white leading-[1.08] tracking-[-0.01em] mb-5">
            From idea to backend<br />
            <span className="text-orange-500">in four steps.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          {STEPS.map((s, i) => {
            const ref = useReveal(i * 80);
            return (
              <div key={s.n} ref={ref}
                className="group relative rounded-2xl border border-white/[0.06] bg-[#080808] p-6 hover:border-orange-500/20 transition-all duration-500 overflow-hidden">
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.07), transparent 65%)' }} />

                {/* Number */}
                <div className="text-[64px] font-black text-orange-500/[0.06] leading-none mb-4 select-none">{s.n}</div>

                {/* Icon */}
                <div className="w-9 h-9 rounded-xl bg-orange-500/8 border border-orange-500/15 flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-500/12 transition-colors">
                  {s.icon}
                </div>

                <h3 className="text-[16px] font-bold text-white mb-2">{s.title}</h3>
                <p className="text-[13px] text-neutral-600 leading-relaxed">{s.body}</p>

                {/* Connector arrow (desktop, not last) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border border-orange-500/15 bg-[#000] items-center justify-center">
                    <svg className="w-3 h-3 text-orange-500/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
