'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Column {
  name: string;
  type: string;
  constraint: string;
}

interface TableDef {
  name: string;
  columns: Column[];
}

interface Result {
  tables: TableDef[];
  apiRoutes: string[];
  summary: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: 'Todo list',    prompt: 'Create a todo list with title, status and due date' },
  { label: 'Blog posts',   prompt: 'Build a blog with posts and comments' },
  { label: 'Online store', prompt: 'Create an e-commerce store with products and orders' },
  { label: 'Chat app',     prompt: 'Build a real-time chat app with channels and messages' },
];

function parsePrompt(prompt: string): Result {
  const lower = prompt.toLowerCase();

  if (lower.includes('todo') || lower.includes('task') || lower.includes('to-do') || lower.includes('to do')) {
    return {
      tables: [
        {
          name: 'todos',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY' },
            { name: 'user_id',    type: 'uuid',        constraint: 'REFERENCES users(id)' },
            { name: 'title',      type: 'text',        constraint: 'NOT NULL' },
            { name: 'completed',  type: 'boolean',     constraint: 'DEFAULT false' },
            { name: 'priority',   type: 'text',        constraint: "DEFAULT 'medium'" },
            { name: 'due_date',   type: 'date',        constraint: '' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'users',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY' },
            { name: 'email',      type: 'text',        constraint: 'UNIQUE NOT NULL' },
            { name: 'full_name',  type: 'text',        constraint: '' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      apiRoutes: [
        'GET    /api/v1/todos           — List your todos',
        'POST   /api/v1/todos           — Create a todo',
        'PATCH  /api/v1/todos/:id       — Complete / update a todo',
        'DELETE /api/v1/todos/:id       — Delete a todo',
      ],
      summary: '2 tables · 4 REST APIs · Row Level Security — ready in seconds.',
    };
  }

  if (lower.includes('blog') || lower.includes('post') || lower.includes('article')) {
    return {
      tables: [
        {
          name: 'posts',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY' },
            { name: 'author_id',  type: 'uuid',        constraint: 'REFERENCES users(id)' },
            { name: 'title',      type: 'text',        constraint: 'NOT NULL' },
            { name: 'slug',       type: 'text',        constraint: 'UNIQUE NOT NULL' },
            { name: 'content',    type: 'text',        constraint: '' },
            { name: 'published',  type: 'boolean',     constraint: 'DEFAULT false' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'comments',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY' },
            { name: 'post_id',    type: 'uuid',        constraint: 'REFERENCES posts(id)' },
            { name: 'user_id',    type: 'uuid',        constraint: 'REFERENCES users(id)' },
            { name: 'body',       type: 'text',        constraint: 'NOT NULL' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      apiRoutes: [
        'GET    /api/v1/posts            — List published posts',
        'POST   /api/v1/posts            — Create post (auth)',
        'GET    /api/v1/posts/:slug      — Get post + comments',
        'POST   /api/v1/comments         — Add comment (auth)',
      ],
      summary: '2 tables · 4 REST APIs · author-scoped write access — instant deploy.',
    };
  }

  if (
    lower.includes('shop') || lower.includes('store') ||
    lower.includes('ecommerce') || lower.includes('e-commerce') ||
    lower.includes('product') || lower.includes('order')
  ) {
    return {
      tables: [
        {
          name: 'products',
          columns: [
            { name: 'id',         type: 'uuid',    constraint: 'PRIMARY KEY' },
            { name: 'name',       type: 'text',    constraint: 'NOT NULL' },
            { name: 'price',      type: 'numeric', constraint: 'NOT NULL' },
            { name: 'stock',      type: 'integer', constraint: 'DEFAULT 0' },
            { name: 'category',   type: 'text',    constraint: '' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'orders',
          columns: [
            { name: 'id',          type: 'uuid',    constraint: 'PRIMARY KEY' },
            { name: 'customer_id', type: 'uuid',    constraint: 'REFERENCES users(id)' },
            { name: 'total',       type: 'numeric', constraint: 'NOT NULL' },
            { name: 'status',      type: 'text',    constraint: "DEFAULT 'pending'" },
            { name: 'created_at',  type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      apiRoutes: [
        'GET    /api/v1/products         — Browse products',
        'POST   /api/v1/orders           — Place order (auth)',
        'GET    /api/v1/orders/:id        — Order detail',
        'PATCH  /api/v1/orders/:id/status — Update status',
      ],
      summary: '2 tables · 4 REST APIs · customer-scoped order isolation — production-ready.',
    };
  }

  if (lower.includes('chat') || lower.includes('message') || lower.includes('channel')) {
    return {
      tables: [
        {
          name: 'channels',
          columns: [
            { name: 'id',         type: 'uuid',    constraint: 'PRIMARY KEY' },
            { name: 'name',       type: 'text',    constraint: 'NOT NULL' },
            { name: 'is_private', type: 'boolean', constraint: 'DEFAULT false' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'messages',
          columns: [
            { name: 'id',         type: 'uuid', constraint: 'PRIMARY KEY' },
            { name: 'channel_id', type: 'uuid', constraint: 'REFERENCES channels(id)' },
            { name: 'sender_id',  type: 'uuid', constraint: 'REFERENCES users(id)' },
            { name: 'content',    type: 'text', constraint: 'NOT NULL' },
            { name: 'sent_at',    type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      apiRoutes: [
        'GET    /api/v1/channels              — List channels',
        'POST   /api/v1/messages              — Send message (auth)',
        'GET    /api/v1/channels/:id/messages — Fetch messages',
        'WS     /realtime/channels/:id        — Live stream',
      ],
      summary: '2 tables · 4 routes · WebSocket realtime enabled — deploy instantly.',
    };
  }

  const words = prompt.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const noun = (words[words.length - 1] ?? 'item').toLowerCase();
  const tableName = noun.endsWith('s') ? noun : noun + 's';
  return {
    tables: [
      {
        name: tableName,
        columns: [
          { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY' },
          { name: 'user_id',    type: 'uuid',        constraint: 'REFERENCES users(id)' },
          { name: 'name',       type: 'text',        constraint: 'NOT NULL' },
          { name: 'data',       type: 'jsonb',       constraint: "DEFAULT '{}'" },
          { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          { name: 'updated_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
        ],
      },
    ],
    apiRoutes: [
      `GET    /api/v1/${tableName}     — List records`,
      `POST   /api/v1/${tableName}     — Create record`,
      `PATCH  /api/v1/${tableName}/:id — Update record`,
      `DELETE /api/v1/${tableName}/:id — Delete record`,
    ],
    summary: `1 table · 4 REST APIs · auto-generated — live in seconds.`,
  };
}

const TYPE_COLOR: Record<string, string> = {
  uuid:        'text-purple-400',
  text:        'text-green-400',
  boolean:     'text-yellow-400',
  integer:     'text-blue-400',
  numeric:     'text-blue-400',
  date:        'text-orange-300',
  timestamptz: 'text-orange-300',
  jsonb:       'text-pink-400',
};

const METHOD_COLOR: Record<string, string> = {
  GET:    'bg-green-500/20 text-green-400',
  POST:   'bg-blue-500/20 text-blue-400',
  PATCH:  'bg-yellow-500/20 text-yellow-400',
  DELETE: 'bg-red-500/20 text-red-400',
  WS:     'bg-purple-500/20 text-purple-400',
};

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconTable = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconApi = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const IconSpin = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIBuilderDemo() {
  const [prompt, setPrompt]           = useState('');
  const [phase, setPhase]             = useState<'idle' | 'thinking' | 'building' | 'done'>('idle');
  const [result, setResult]           = useState<Result | null>(null);
  const [visibleCols, setVisibleCols] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab]     = useState<'tables' | 'api'>('tables');
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [thinkDots, setThinkDots]     = useState('');

  useEffect(() => {
    if (phase !== 'thinking') return;
    const id = setInterval(() => setThinkDots(d => d.length >= 3 ? '' : d + '.'), 380);
    return () => clearInterval(id);
  }, [phase]);

  const handleGenerate = async (overridePrompt?: string) => {
    const text = (overridePrompt ?? prompt).trim();
    if (!text || phase === 'thinking' || phase === 'building') return;

    setPhase('thinking');
    setResult(null);
    setVisibleCols({});
    setActiveTab('tables');
    setActiveTableIdx(0);

    await delay(1100);

    const parsed = parsePrompt(text);
    setResult(parsed);
    setPhase('building');

    for (let t = 0; t < parsed.tables.length; t++) {
      const table = parsed.tables[t];
      setActiveTableIdx(t);
      for (let c = 0; c <= table.columns.length; c++) {
        setVisibleCols(prev => ({ ...prev, [table.name]: c }));
        await delay(100);
      }
      await delay(160);
    }

    setPhase('done');
  };

  const handleSuggestion = (s: typeof SUGGESTIONS[0]) => {
    setPrompt(s.prompt);
    setPhase('idle');
    setResult(null);
    setVisibleCols({});
    handleGenerate(s.prompt);
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setVisibleCols({});
    setPrompt('');
  };

  const isBuilding = phase === 'thinking' || phase === 'building';
  const currentTable = result?.tables[activeTableIdx];

  return (
    <section id="ai-demo" className="py-24 bg-zinc-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ea580c06_1px,transparent_1px),linear-gradient(to_bottom,#ea580c06_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600/20 border border-orange-500/30 rounded-full text-sm font-semibold text-orange-300 mb-4">
            <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
            AI Backend Builder
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-white">Describe it. </span>
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Watch it build.</span>
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Type what you want — your tables, columns, and REST APIs appear in real time.
          </p>
        </div>

        {/* Demo window */}
        <div className="bg-zinc-900 rounded-2xl border-2 border-orange-500/20 overflow-hidden shadow-2xl shadow-orange-500/10">

          {/* Window chrome */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs font-semibold text-orange-400">AI Builder — Live Demo</span>
            </div>
            {phase === 'done' && (
              <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Reset
              </button>
            )}
          </div>

          {/* Prompt area */}
          <div className="p-5 border-b border-zinc-800 bg-black/20">
            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestion(s)}
                  disabled={isBuilding}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    prompt === s.prompt && phase !== 'idle'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-orange-500/50 hover:text-orange-300'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="flex gap-3">
              <input
                value={prompt}
                onChange={e => { setPrompt(e.target.value); if (phase === 'done') reset(); }}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g.  Create a todo list table with title, status and due date…"
                disabled={isBuilding}
                className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-600 rounded-xl text-sm focus:outline-none focus:border-orange-500/60 transition-colors disabled:opacity-50 font-mono"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || isBuilding}
                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl text-sm font-bold hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 whitespace-nowrap flex items-center gap-2">
                {isBuilding ? <><IconSpin />Building…</> : 'Generate'}
              </button>
            </div>
          </div>

          {/* Idle state */}
          {phase === 'idle' && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-zinc-300 text-base font-medium mb-1">Pick a template or describe your backend</p>
              <p className="text-zinc-600 text-sm">Watch your tables get built column by column in real time</p>
            </div>
          )}

          {/* Thinking state */}
          {phase === 'thinking' && (
            <div className="flex flex-col items-center justify-center py-14 gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-white font-semibold text-center">Analyzing your description{thinkDots}</p>
                <p className="text-zinc-500 text-sm text-center mt-1">Planning tables, columns, relationships…</p>
              </div>
            </div>
          )}

          {/* Building / Done state */}
          {(phase === 'building' || phase === 'done') && result && (
            <div>
              {/* Tab bar */}
              <div className="flex border-b border-zinc-800 bg-zinc-900/50">
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-all ${
                    activeTab === 'tables'
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <IconTable />
                  Tables ({result.tables.length})
                </button>
                <button
                  onClick={() => setActiveTab('api')}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-all ${
                    activeTab === 'api'
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <IconApi />
                  API Routes ({result.apiRoutes.length})
                </button>

                {phase === 'done' && (
                  <div className="ml-auto flex items-center pr-4">
                    <span className="flex items-center gap-1.5 text-xs text-orange-400 font-medium bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                      <IconCheck />
                      {result.summary}
                    </span>
                  </div>
                )}
              </div>

              {/* Tables panel */}
              {activeTab === 'tables' && (
                <div className="flex" style={{ minHeight: 300 }}>
                  {/* Sidebar */}
                  <div className="w-40 border-r border-zinc-800 flex-shrink-0 bg-zinc-900/30">
                    {result.tables.map((t, i) => {
                      const done = (visibleCols[t.name] ?? 0) >= t.columns.length;
                      return (
                        <button
                          key={t.name}
                          onClick={() => setActiveTableIdx(i)}
                          className={`w-full flex items-center gap-2 px-3 py-3.5 text-sm border-b border-zinc-800/60 transition-all ${
                            activeTableIdx === i
                              ? 'bg-orange-500/10 text-orange-400 border-l-2 border-l-orange-500'
                              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                          }`}>
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span className="font-mono font-medium truncate text-xs">{t.name}</span>
                          {phase === 'building' && activeTableIdx === i && !done && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                          )}
                          {done && <span className="ml-auto flex-shrink-0"><IconCheck /></span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Column animation panel */}
                  {currentTable && (
                    <div className="flex-1 overflow-auto">
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/50">
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="font-mono font-bold text-white">{currentTable.name}</span>
                        <span className="text-xs text-zinc-500 ml-auto">
                          {visibleCols[currentTable.name] ?? 0} / {currentTable.columns.length} columns
                        </span>
                      </div>

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800/60">
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Column</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Type</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Constraint</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentTable.columns.map((col, ci) => {
                            const revealed = (visibleCols[currentTable.name] ?? 0) > ci;
                            const isNew    = (visibleCols[currentTable.name] ?? 0) - 1 === ci && phase === 'building';
                            return (
                              <tr
                                key={col.name}
                                style={{
                                  opacity: revealed ? 1 : 0,
                                  transform: revealed ? 'translateY(0)' : 'translateY(-6px)',
                                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                                }}
                                className={`border-b border-zinc-800/40 ${isNew ? 'bg-orange-500/5' : 'hover:bg-zinc-800/30'}`}>
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    {isNew && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                                    )}
                                    <span className="font-mono font-medium text-zinc-200">{col.name}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`font-mono font-semibold text-sm ${TYPE_COLOR[col.type] ?? 'text-zinc-400'}`}>
                                    {col.type}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <span className="font-mono text-xs text-zinc-500">{col.constraint}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* API Routes panel */}
              {activeTab === 'api' && (
                <div className="p-5 space-y-2">
                  {result.apiRoutes.map((route, i) => {
                    const parts  = route.split(/\s+/);
                    const method = parts[0];
                    const path   = parts[1] ?? '';
                    const desc   = parts.slice(2).join(' ').replace(/^—\s*/, '');
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono flex-shrink-0 ${METHOD_COLOR[method] ?? 'bg-zinc-700 text-zinc-400'}`}>
                          {method}
                        </span>
                        <span className="font-mono text-sm text-zinc-200 flex-shrink-0">{path}</span>
                        <span className="text-sm text-zinc-500 ml-auto text-right">{desc}</span>
                      </div>
                    );
                  })}
                  <div className="mt-3 px-4 py-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                    <p className="text-xs text-zinc-500">
                      <span className="text-orange-400 font-semibold">Base URL: </span>
                      <span className="font-mono text-zinc-400">https://api.zendbx.com/v1/your-project</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-zinc-400 mb-5 text-lg">
            This is just the demo — sign up and build real backends instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl font-bold text-base hover:from-orange-500 hover:to-orange-400 transition-all shadow-2xl shadow-orange-500/40">
              Start Building Free →
            </Link>
            <Link
              href="/dashboard/ai-builder"
              className="px-8 py-4 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl font-semibold text-base hover:border-orange-500/50 hover:text-white transition-all">
              Open full AI Builder
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-600">No credit card · 2 free projects · Setup in 30 seconds</p>
        </div>
      </div>
    </section>
  );
}
