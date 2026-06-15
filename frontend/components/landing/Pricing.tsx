'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

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

const PLANS = [
  {
    name: 'Hobby',
    badge: null,
    price: '$0',
    per: 'forever',
    desc: 'Perfect for personal projects and prototypes.',
    features: ['2 projects', '1 GB database storage', 'Unlimited API requests', 'Built-in auth & OAuth', 'Community support'],
    cta: 'Start for free',
    href: '/signup',
    style: 'border-white/[0.08] bg-[#080808]',
    ctaStyle: 'bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/10',
  },
  {
    name: 'Pro',
    badge: 'Most popular',
    price: '$29',
    per: 'per month',
    desc: 'For professional developers shipping real products.',
    features: ['Unlimited projects', '10 GB database storage', 'Priority support', 'Custom domains', 'Team collaboration', 'Advanced RBAC', 'Audit logs', '10k API req/day'],
    cta: 'Start Pro — free 14 days',
    href: '/signup?plan=pro',
    style: 'border-orange-500/40 bg-[#0d0a06] shadow-2xl shadow-orange-900/20',
    ctaStyle: 'bg-orange-500 hover:bg-orange-400 text-black font-bold',
  },
  {
    name: 'Team',
    badge: null,
    price: '$99',
    per: 'per month',
    desc: 'For growing teams that need scale and reliability.',
    features: ['Everything in Pro', '100 GB storage', 'SSO / SAML', '99.9% SLA', 'Dedicated support', '100k API req/day', 'Advanced analytics'],
    cta: 'Start Team trial',
    href: '/signup?plan=team',
    style: 'border-white/[0.08] bg-[#080808]',
    ctaStyle: 'bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/10',
  },
];

export default function Pricing() {
  const headRef = useReveal(0);

  return (
    <section id="pricing" className="bg-[#000] py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.15), transparent)' }} />

      {/* Soft ambient */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(249,115,22,0.05), transparent)' }} />

      <div className="max-w-6xl mx-auto px-4">

        <div ref={headRef} className="text-center mb-16">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500 mb-4">Pricing</p>
          <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold text-white leading-[1.08] tracking-[-0.01em] mb-5">
            Simple pricing.<br />
            <span className="text-orange-500">No surprises.</span>
          </h2>
          <p className="text-neutral-500 text-lg max-w-md mx-auto">
            Start free. Upgrade when you're ready. Cancel anytime — no lock-in.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-3 items-start">
          {PLANS.map((plan, i) => {
            const cardRef = useReveal(i * 80);
            return (
              <div key={plan.name} ref={cardRef}
                className={`relative rounded-2xl border p-7 flex flex-col ${plan.style}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500 text-black text-[11px] font-bold tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-black/40" />
                      {plan.badge.toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-600 mb-3">{plan.name}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-[44px] font-semibold text-white leading-none">{plan.price}</span>
                    <span className="text-sm text-neutral-600">{plan.per}</span>
                  </div>
                  <p className="text-sm text-neutral-600">{plan.desc}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-neutral-400">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.href}
                  className={`block text-center py-3 rounded-xl text-[14px] font-bold transition-all duration-200 ${plan.ctaStyle}`}>
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Enterprise bar */}
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#080808] px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-[15px] mb-0.5">Need enterprise scale?</p>
            <p className="text-sm text-neutral-600">Custom limits, dedicated infra, SLA guarantees, and white-glove onboarding.</p>
          </div>
          <Link href="/contact"
            className="shrink-0 px-5 py-2.5 rounded-xl border border-orange-500/30 text-orange-400 hover:text-orange-300 hover:border-orange-400 text-sm font-bold transition-all whitespace-nowrap">
            Talk to sales →
          </Link>
        </div>
      </div>
    </section>
  );
}
