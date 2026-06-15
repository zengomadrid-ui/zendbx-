'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type Tab = 'Database' | 'Auth' | 'Realtime' | 'Storage';

const SNIPPETS: Record<Tab, { line: string; label: string; tokens: { t: string; c: string }[][] }> = {
  Database: {
    label: 'Query anything in one call',
    line: 'db.from().select().eq().order()',
    tokens: [
      [{ t: 'import', c: 'text-orange-400' }, { t: ' { ZendBX } from ', c: 'text-neutral-400' }, { t: '"zendbx"', c: 'text-emerald-400' }],
      [],
      [{ t: 'const ', c: 'text-orange-400' }, { t: 'db', c: 'text-sky-300' }, { t: ' = new ZendBX({ url, anonKey })', c: 'text-neutral-400' }],
      [],
      [{ t: '// Fully typed, auto-completed', c: 'text-neutral-600 italic' }],
      [{ t: 'const ', c: 'text-orange-400' }, { t: '{ data } ', c: 'text-white' }, { t: '= await ', c: 'text-orange-400' }, { t: 'db', c: 'text-sky-300' }],
      [{ t: '  .from', c: 'text-white' }, { t: '(', c: 'text-white' }, { t: '"products"', c: 'text-emerald-400' }, { t: ')', c: 'text-white' }],
      [{ t: '  .select', c: 'text-white' }, { t: '(', c: 'text-white' }, { t: '"id, name, price"', c: 'text-emerald-400' }, { t: ')', c: 'text-white' }],
      [{ t: '  .gt', c: 'text-white' }, { t: '(', c: 'text-white' }, { t: '"price"', c: 'text-emerald-400' }, { t: ', ', c: 'text-white' }, { t: '100', c: 'text-sky-400' }, { t: ')', c: 'text-white' }],
      [{ t: '  .order', c: 'text-white' }, { t: '(', c: 'text-white' }, { t: '"price"', c: 'text-emerald-400' }, { t: ', { ', c: 'text-white' }, { t: 'ascending', c: 'text-sky-300' }, { t: ': ', c: 'text-white' }, { t: 'false', c: 'text-amber-400' }, { t: ' })', c: 'text-white' }],
    ],
  },
  Auth: {
    label: 'Ship auth before your first commit',
    line: 'db.auth.signUp() / signIn()',
    tokens: [
      [{ t: '// Sign up', c: 'text-neutral-600 italic' }],
      [{ t: 'const ', c: 'text-orange-400' }, { t: '{ data } ', c: 'text-white' }, { t: '= await ', c: 'text-orange-400' }, { t: 'db', c: 'text-sky-300' }, { t: '.auth.signUp({', c: 'text-white' }],
      [{ t: '  email', c: 'text-sky-300' }, { t: ': ', c: 'text-white' }, { t: '"user@app.com"', c: 'text-emerald-400' }, { t: ',', c: 'text-white' }],
      [{ t: '  password', c: 'text-sky-300' }, { t: ': ', c: 'text-white' }, { t: '"s3cr3t"', c: 'text-emerald-400' }],
      [{ t: '})', c: 'text-white' }],
      [],
      [{ t: '// Sign in', c: 'text-neutral-600 italic' }],
      [{ t: 'const ', c: 'text-orange-400' }, { t: '{ user } ', c: 'text-white' }, { t: '= await ', c: 'text-orange-400' }, { t: 'db', c: 'text-sky-300' }, { t: '.auth.signIn({', c: 'text-white' }],
      [{ t: '  email, password', c: 'text-sky-300' }],
      [{ t: '})', c: 'text-white' }],
    ],
  },
  Realtime: {
    label: 'Live updates — zero polling',
    line: 'db.realtime.from().on().subscribe()',
    tokens: [
      [{ t: '// Subscribe to changes', c: 'text-neutral-600 italic' }],
      [{ t: 'const ', c: 'text-orange-400' }, { t: 'sub ', c: 'text-white' }, { t: '= ', c: 'text-white' }, { t: 'db', c: 'text-sky-300' }, { t: '.realtime', c: 'text-white' }],
      [{ t: '  .from', c: 'text-white' }, { t: '(', c: 'text-white' }, { t: '"messages"', c: 'text-emerald-400' }, { t: ')', c: 'text-white' }],
      [{ t: '  .on', c: 'text-white' }, { t: '(', c: 'text-white' }, { t: '"INSERT"', c: 'text-amber-400' }, { t: ', (', c: 'text-white' }, { t: 'payload', c: 'text-sky-300' }, { t: ') => {', c: 'text-white' }],
      [{ t: '    console', c: 'text-neutral-400' }, { t: '.log(', c: 'text-white' }, { t: 'payload.new', c: 'text-sky-300' }, { t: ')', c: 'text-white' }],
      [{ t: '  })', c: 'text-white' }],
      [{ t: '  .subscribe()', c: 'text-white' }],
      [],
      [{ t: '// Clean up', c: 'text-neutral-600 italic' }],
      [{ t: 'sub', c: 'text-sky-300' }, { t: '.unsubscribe()', c: 'text-white' }],
    ],
  },
  Storage: {
    label: 'File uploads in one call',
    line: 'db.storage.bucket().upload()',
    tokens: [
      [{ t: '// Upload a file', c: 'text-neutral-600 italic' }],
      [{ t: 'const ', c: 'text-orange-400' }, { t: 'bucket ', c: 'text-white' }, { t: '= ', c: 'text-white' }, { t: 'db', c: 'text-sky-300' }, { t: '.storage.bucket(', c: 'text-white' }, { t: '"avatars"', c: 'text-emerald-400' }, { t: ')', c: 'text-white' }],
      [],
      [{ t: 'const ', c: 'text-orange-400' }, { t: '{ data } ', c: 'text-white' }, { t: '= await ', c: 'text-orange-400' }, { t: 'bucket', c: 'text-sky-300' }, { t: '.upload(', c: 'text-white' }],
      [{ t: '  file, ', c: 'text-sky-300' }, { t: '"profile.png"', c: 'text-emerald-400' }],
      [{ t: ')', c: 'text-white' }],
      [],
      [{ t: '// Get public URL', c: 'text-neutral-600 italic' }],
      [{ t: 'const ', c: 'text-orange-400' }, { t: '{ url } ', c: 'text-white' }, { t: '= ', c: 'text-white' }, { t: 'bucket', c: 'text-sky-300' }, { t: '.getPublicUrl(', c: 'text-white' }, { t: '"profile.png"', c: 'text-emerald-400' }, { t: ')', c: 'text-white' }],
    ],
  },
};

const TABS: Tab[] = ['Database', 'Auth', 'Realtime', 'Storage'];
const FRAMEWORKS = ['React', 'Next.js', 'Vue', 'Svelte', 'Node.js', 'Python', 'Go', 'Flutter'];

export default function SDKSection() {
  const [active, setActive] = useState<Tab>('Database');
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { label, tokens } = SNIPPETS[active];

  return (
    <section className="bg-[#000] py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.12), transparent)' }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 20% 50%, rgba(249,115,22,0.04), transparent)' }} />

      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — pitch */}
          <div ref={headRef}>
            <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-orange-500 mb-4">SDK</p>
            <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-semibold text-white leading-[1.08] tracking-[-0.01em] mb-5">
              Backend in<br />
              <span className="text-orange-500">3 lines of code.</span>
            </h2>
            <p className="text-neutral-500 text-lg mb-8 leading-relaxed">
              The ZendBX TypeScript SDK gives you a fully typed, auto-completed interface to your entire backend. Install, configure, ship.
            </p>

            {/* Framework badges */}
            <div className="flex flex-wrap gap-2 mb-8">
              {FRAMEWORKS.map(f => (
                <span key={f} className="px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-sm text-neutral-600 hover:text-neutral-300 hover:border-orange-500/20 transition-all cursor-default">
                  {f}
                </span>
              ))}
            </div>

            {/* Install command */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] mb-8 font-mono text-sm">
              <span className="text-orange-500 select-none">$</span>
              <span className="text-neutral-300">npm install zendbx</span>
              <button
                onClick={() => navigator.clipboard.writeText('npm install zendbx')}
                className="ml-auto text-neutral-700 hover:text-white transition-colors"
                title="Copy"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

            <Link href="/docs/sdk" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-semibold text-sm transition-colors group">
              Full SDK reference
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Right — code window */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl opacity-40 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(249,115,22,0.12), transparent 70%)', filter: 'blur(16px)' }} />

            <div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
              {/* Chrome */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-[#0d0d0d]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-[11px] text-neutral-700 font-mono ml-2">zendbx-sdk · TypeScript</span>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/[0.05] bg-[#0d0d0d]">
                {TABS.map(tab => (
                  <button key={tab} onClick={() => setActive(tab)}
                    className={`px-4 py-2.5 text-[13px] font-medium transition-all border-b-2 ${
                      active === tab
                        ? 'text-white border-orange-500'
                        : 'text-neutral-600 border-transparent hover:text-neutral-400'
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Label */}
              <div className="px-5 pt-4">
                <span className="text-[11px] text-orange-500/70 font-mono">{label}</span>
              </div>

              {/* Code */}
              <div className="p-5 font-mono text-[13px] leading-[1.7] overflow-x-auto min-h-[240px]">
                <table className="border-collapse w-full">
                  <tbody>
                    {tokens.map((line, i) => (
                      <tr key={i}>
                        <td className="select-none pr-4 text-right text-[11px] text-neutral-800 w-4 align-top leading-[1.7]">{i + 1}</td>
                        <td>
                          {line.length === 0
                            ? <span>&nbsp;</span>
                            : line.map((tok, j) => <span key={j} className={tok.c}>{tok.t}</span>)
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/[0.05] bg-[#0d0d0d] flex items-center justify-between">
                <span className="text-[11px] text-neutral-700 font-mono">TypeScript · 100% typed</span>
                <span className="text-[11px] text-orange-600/40 font-mono">zendbx@1.1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
