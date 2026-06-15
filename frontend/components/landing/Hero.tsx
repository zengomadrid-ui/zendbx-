'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const CODE_LINES = [
  { tokens: [{ t: "import", c: "text-orange-400" }, { t: " { ZendBX } ", c: "text-white" }, { t: "from", c: "text-orange-400" }, { t: ' "zendbx"', c: "text-emerald-400" }] },
  { tokens: [] },
  { tokens: [{ t: "const ", c: "text-orange-400" }, { t: "db", c: "text-sky-300" }, { t: " = ", c: "text-white" }, { t: "new ", c: "text-orange-400" }, { t: "ZendBX", c: "text-orange-300" }, { t: "({", c: "text-white" }] },
  { tokens: [{ t: "  url: ", c: "text-neutral-400" }, { t: '"https://api.zendbx.in/p/my-app"', c: "text-emerald-400" }, { t: ",", c: "text-white" }] },
  { tokens: [{ t: "  anonKey: ", c: "text-neutral-400" }, { t: "process", c: "text-sky-300" }, { t: ".env.", c: "text-white" }, { t: "ZENDBX_ANON_KEY", c: "text-sky-300" }] },
  { tokens: [{ t: "})", c: "text-white" }] },
  { tokens: [] },
  { tokens: [{ t: "// Query anything, instantly", c: "text-neutral-600 italic" }] },
  { tokens: [{ t: "const ", c: "text-orange-400" }, { t: "{ data } ", c: "text-white" }, { t: "= await ", c: "text-orange-400" }, { t: "db", c: "text-sky-300" }] },
  { tokens: [{ t: "  .from", c: "text-white" }, { t: "(", c: "text-white" }, { t: '"users"', c: "text-emerald-400" }, { t: ")", c: "text-white" }] },
  { tokens: [{ t: "  .select", c: "text-white" }, { t: "(", c: "text-white" }, { t: '"*"', c: "text-emerald-400" }, { t: ")", c: "text-white" }] },
  { tokens: [{ t: "  .eq", c: "text-white" }, { t: "(", c: "text-white" }, { t: '"role"', c: "text-emerald-400" }, { t: ", ", c: "text-white" }, { t: '"admin"', c: "text-emerald-400" }, { t: ")", c: "text-white" }] },
];

const STATS = [
  { value: "30s", label: "Setup time" },
  { value: "100%", label: "Auto APIs" },
  { value: "0", label: "Config files" },
  { value: "∞", label: "Scale" },
];

export default function Hero() {
  const glowRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onMove = (e: MouseEvent) => {
      if (!glowRef.current) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 60;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      glowRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <section className="relative min-h-screen bg-[#000] flex flex-col overflow-hidden">
      {/* Radial ambient — parallax */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute top-1/2 left-1/2 w-[900px] h-[600px] transition-transform duration-700 ease-out"
        style={{
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(249,115,22,0.13) 0%, transparent 70%)',
          willChange: 'transform',
        }}
      />

      {/* Subtle grid */}
      <div className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(249,115,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, black 0%, transparent 100%)',
        }}
      />

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-36 pb-20">

        {/* Main headline */}
        <h1
          className={`max-w-4xl text-5xl sm:text-6xl lg:text-[72px] font-semibold leading-[1.08] tracking-[-0.01em] text-white mb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '200ms' }}
        >
          The instant backend
          <br />
          <span className="relative">
            <span className="text-orange-500">for modern apps.</span>
            {/* Underline accent */}
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 400 12" preserveAspectRatio="none">
              <path d="M0 8 Q100 2 200 8 Q300 14 400 8" stroke="#f97316" strokeWidth="2.5" fill="none" strokeOpacity="0.4" />
            </svg>
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className={`max-w-xl text-lg text-neutral-400 leading-relaxed mb-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '300ms' }}
        >
          PostgreSQL database, REST APIs, auth, realtime, and storage — provisioned in seconds, not days.
          Zero DevOps. Just build.
        </p>

        {/* CTAs */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 mb-16 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '400ms' }}
        >
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-2 px-7 py-3.5 font-bold text-[15px] text-black rounded-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-orange-500 group-hover:bg-orange-400 transition-colors duration-200" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15), transparent 70%)' }} />
            <span className="relative">Start building free</span>
            <svg className="relative w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-7 py-3.5 font-semibold text-[15px] text-neutral-300 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all duration-200 hover:bg-white/[0.03]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Read the docs
          </Link>
        </div>

        {/* Code window */}
        <div
          className={`w-full max-w-2xl mx-auto transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ transitionDelay: '500ms' }}
        >
          {/* Glow behind code */}
          <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(249,115,22,0.08), transparent)' }} />

          <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-[#0a0a0a] shadow-2xl shadow-black/80">
            {/* Chrome bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 bg-[#0d0d0d]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <span className="ml-2 text-[11px] font-medium text-neutral-600 font-mono">app/page.tsx</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[11px] text-orange-500/70 font-mono">live</span>
              </div>
            </div>

            {/* Code */}
            <div className="p-5 font-mono text-[13px] leading-[1.65] overflow-x-auto text-left">
              <table className="border-collapse w-full">
                <tbody>
                  {CODE_LINES.map((line, i) => (
                    <tr key={i} className="group/row">
                      <td className="select-none pr-5 text-right text-[11px] text-neutral-700 w-5 align-top leading-[1.65]">{i + 1}</td>
                      <td className="align-top">
                        {line.tokens.length === 0
                          ? <span>&nbsp;</span>
                          : line.tokens.map((tok, j) => (
                            <span key={j} className={tok.c}>{tok.t}</span>
                          ))
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/5 bg-[#0d0d0d]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-mono text-neutral-600">200 OK · 8ms · 47 rows returned</span>
              </div>
              <span className="text-[11px] font-mono text-orange-600/50">zendbx@1.1.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="relative z-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/5">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-6 px-4 gap-1 group hover:bg-orange-500/[0.03] transition-colors duration-300">
              <span className="text-3xl font-semibold text-orange-500">{value}</span>
              <span className="text-xs text-neutral-600 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
