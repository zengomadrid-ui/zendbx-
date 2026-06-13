'use client';

import { useState } from 'react';

export function CodeBlock({ code, lang = 'typescript', title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-orange-400">{lang}</span>
          {title && <span className="text-xs text-zinc-500">{title}</span>}
        </div>
        <button
          onClick={copy}
          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="bg-zinc-950 p-4 overflow-x-auto text-sm leading-6">
        <code className="text-gray-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

export function Note({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warning' | 'danger' }) {
  const styles = {
    info: 'border-orange-500/30 bg-orange-500/5 text-orange-200',
    warning: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-200',
    danger: 'border-red-500/30 bg-red-500/5 text-red-200',
  };
  const icons = {
    info: '💡',
    warning: '⚠️',
    danger: '🚫',
  };
  return (
    <div className={`my-4 px-4 py-3 rounded-lg border text-sm ${styles[type]}`}>
      <span className="mr-2">{icons[type]}</span>
      {children}
    </div>
  );
}

export function Tabs({ tabs, children }: { tabs: string[]; children: React.ReactNode[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="my-4">
      <div className="flex border-b border-zinc-800">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              active === i
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="pt-2">{children[active]}</div>
    </div>
  );
}

export function ParamTable({ params }: {
  params: { name: string; type: string; required?: boolean; description: string }[]
}) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400 uppercase tracking-wider">Parameter</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400 uppercase tracking-wider">Type</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400 uppercase tracking-wider">Required</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400 uppercase tracking-wider">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-zinc-900 hover:bg-zinc-900/50">
              <td className="py-2 px-3 font-mono text-orange-300">{p.name}</td>
              <td className="py-2 px-3 font-mono text-blue-400">{p.type}</td>
              <td className="py-2 px-3">
                {p.required
                  ? <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">required</span>
                  : <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-gray-500">optional</span>
                }
              </td>
              <td className="py-2 px-3 text-gray-400">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Heading({ level, id, children }: { level: 1|2|3|4; id?: string; children: React.ReactNode }) {
  const classes = {
    1: 'text-3xl font-bold text-white mt-0 mb-4',
    2: 'text-xl font-bold text-white mt-10 mb-3 pb-2 border-b border-zinc-800',
    3: 'text-base font-semibold text-white mt-6 mb-2',
    4: 'text-sm font-semibold text-orange-400 mt-4 mb-1 uppercase tracking-wider',
  };
  const Tag = `h${level}` as 'h1'|'h2'|'h3'|'h4';
  return <Tag id={id} className={classes[level]}>{children}</Tag>;
}

export function Badge({ children, color = 'orange' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    gray: 'bg-zinc-800 text-gray-400 border-zinc-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${colors[color] ?? colors.orange}`}>
      {children}
    </span>
  );
}
