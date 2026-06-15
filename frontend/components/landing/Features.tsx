'use client';

import { useEffect, useRef } from 'react';

function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        obs.disconnect();
      }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return ref;
}

/* ──────────────── Visual mockups ──────────────── */

function DBMockup() {
  return (
    <div className="font-mono text-xs space-y-1 select-none">
      <div className="flex items-center gap-2 text-neutral-600 mb-3">
        <span className="text-orange-500">›</span>
        <span className="text-neutral-300">CREATE TABLE orders (…)</span>
      </div>
      {[
        { col: 'id',         type: 'uuid',        val: 'gen_random_uuid()',  c: 'text-sky-400' },
        { col: 'user_id',    type: 'uuid',        val: 'NOT NULL',           c: 'text-neutral-500' },
        { col: 'total',      type: 'numeric',     val: '0',                  c: 'text-emerald-400' },
        { col: 'created_at', type: 'timestamptz', val: 'NOW()',              c: 'text-orange-400' },
      ].map(r => (
        <div key={r.col} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <span className="text-white w-20 shrink-0">{r.col}</span>
          <span className="text-purple-400 w-24 shrink-0">{r.type}</span>
          <span className={r.c}>{r.val}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-emerald-400">Table ready · REST API live</span>
      </div>
    </div>
  );
}

function AuthMockup() {
  return (
    <div className="space-y-2.5 font-mono text-xs select-none">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-neutral-600 mb-1.5">POST /v1/auth/{'{projectId}'}/signup</div>
        <div className="text-orange-300">{'{ "email": "dev@acme.com", "password": "…" }'}</div>
      </div>
      <div className="flex items-center gap-1.5 text-neutral-700">
        <div className="h-px flex-1 bg-white/5" />
        <span className="text-[10px]">200 OK · 11ms</span>
        <div className="h-px flex-1 bg-white/5" />
      </div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
        <div className="text-neutral-600 mb-1.5">Response</div>
        <div className="text-emerald-400">access_token: <span className="text-neutral-500">eyJhbGci…</span></div>
        <div className="text-emerald-400">user: <span className="text-neutral-500">{'{ id, email, … }'}</span></div>
      </div>
      <div className="flex gap-2 flex-wrap mt-1">
        {['Email', 'Google', 'GitHub', 'MFA'].map(p => (
          <span key={p} className="px-2 py-0.5 rounded-full border border-orange-500/20 text-orange-400 text-[10px] font-semibold">{p}</span>
        ))}
      </div>
    </div>
  );
}

function APIMockup() {
  return (
    <div className="space-y-2 font-mono text-xs select-none">
      {[
        { m: 'GET',    path: '/rest/v1/orders',           c: 'text-sky-400',     bg: 'bg-sky-400/5 border-sky-500/15' },
        { m: 'POST',   path: '/rest/v1/orders',           c: 'text-emerald-400', bg: 'bg-emerald-400/5 border-emerald-500/15' },
        { m: 'PATCH',  path: '/rest/v1/orders?id=eq.1',  c: 'text-amber-400',   bg: 'bg-amber-400/5 border-amber-500/15' },
        { m: 'DELETE', path: '/rest/v1/orders?id=eq.1',  c: 'text-red-400',     bg: 'bg-red-400/5 border-red-500/15' },
      ].map(({ m, path, c, bg }) => (
        <div key={m} className={`flex items-center gap-3 rounded-lg px-3 py-2 border ${bg}`}>
          <span className={`font-bold w-12 shrink-0 ${c}`}>{m}</span>
          <span className="text-neutral-500">{path}</span>
        </div>
      ))}
      <div className="pt-1 text-neutral-700 text-[10px]">Auto-generated · RLS enforced · Realtime ready</div>
    </div>
  );
}

function AIMockup() {
  return (
    <div className="space-y-2.5 text-xs select-none">
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-neutral-800 border border-white/5 flex items-center justify-center text-[9px] text-neutral-400 shrink-0 mt-0.5">You</div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-none px-3 py-2 text-neutral-300">
          Show me all orders over $1000 from this week
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-[9px] text-orange-400 shrink-0 mt-0.5">AI</div>
        <div className="bg-orange-500/[0.05] border border-orange-500/15 rounded-2xl rounded-tl-none px-3 py-2 font-mono text-[11px] text-neutral-400">
          <span className="text-orange-300">SELECT</span> * <span className="text-orange-300">FROM</span> orders
          <br />
          <span className="text-orange-300">WHERE</span> total {'>'} <span className="text-sky-400">1000</span>
          <br />
          <span className="text-orange-300">AND</span> created_at {'>'} <span className="text-emerald-400">NOW() - INTERVAL '7d'</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Feature cards ──────────────── */

const FEATURES = [
  {
    tag: 'Database',
    title: 'Instant PostgreSQL.\nZero config.',
    body: 'Every project gets an isolated, production-grade PostgreSQL database provisioned in seconds. Schema migrations, RLS, and backups are handled automatically.',
    visual: <DBMockup />,
    span: 'md:col-span-1',
  },
  {
    tag: 'Auth',
    title: 'JWT auth\nthat just works.',
    body: 'Signup, login, OAuth, MFA, and session management — all built in. Ship authentication before your first commit.',
    visual: <AuthMockup />,
    span: 'md:col-span-1',
  },
  {
    tag: 'REST API',
    title: 'Every table becomes\nan API endpoint.',
    body: 'Create a table and immediately get full CRUD, filtering, pagination, and realtime subscriptions. No controllers. No serializers.',
    visual: <APIMockup />,
    span: 'md:col-span-1',
  },
  {
    tag: 'AI',
    title: 'Talk to your data\nin plain English.',
    body: 'Describe what you need — the AI assistant writes the SQL, suggests indexes, and explains your schema. Natural language becomes production queries.',
    visual: <AIMockup />,
    span: 'md:col-span-1',
  },
];

const EXTRAS = ['Realtime subscriptions', 'File storage', 'RBAC permissions', 'Automated backups', 'SQL Editor', 'TypeScript SDK', 'Audit logs', 'API playground', 'CSV import'];

export default function Features() {
  const headRef = useReveal(0);

  return (
    <section id="features" className="bg-[#000] py-28 relative overflow-hidden">
      {/* Subtle horizontal line accent */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.2), transparent)' }} />

      <div className="max-w-6xl mx-auto px-4">

        {/* Section header */}
        <div ref={headRef} className="text-center mb-16">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500 mb-4">Platform</p>
          <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-black text-white leading-[1.08] tracking-[-0.02em] mb-5">
            Everything included.
            <br />
            <span className="text-orange-500">Nothing to configure.</span>
          </h2>
          <p className="text-neutral-500 text-lg max-w-lg mx-auto">
            Stop stitching infrastructure together. Start shipping the product.
          </p>
        </div>

        {/* 2×2 bento grid */}
        <div className="grid md:grid-cols-2 gap-3">
          {FEATURES.map((f, i) => {
            const ref = useReveal(i * 80);
            return (
              <div key={f.tag} ref={ref} className={`group relative rounded-2xl border border-white/[0.06] bg-[#080808] overflow-hidden hover:border-orange-500/20 transition-all duration-500 ${f.span}`}>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 30% 30%, rgba(249,115,22,0.05), transparent 65%)' }} />

                {/* Visual panel */}
                <div className="relative p-6 border-b border-white/[0.04] bg-gradient-to-br from-[#0d0d0d] to-[#080808] min-h-[200px] flex items-start">
                  <div className="w-full">{f.visual}</div>
                </div>

                {/* Text panel */}
                <div className="p-6">
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-orange-500 mb-3 block">{f.tag}</span>
                  <h3 className="text-[22px] font-black text-white leading-tight mb-3 whitespace-pre-line">{f.title}</h3>
                  <p className="text-[14px] text-neutral-500 leading-relaxed">{f.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* More capabilities */}
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#080808] p-6">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-700 mb-4">And much more</p>
          <div className="flex flex-wrap gap-2">
            {EXTRAS.map(e => (
              <span key={e} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-sm text-neutral-500 hover:text-neutral-300 hover:border-orange-500/20 transition-all duration-200 cursor-default">
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
