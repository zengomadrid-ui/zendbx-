'use client';

import { useState, useEffect, useRef } from 'react';

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

interface GeneratedResult {
  tables: TableDef[];
  sqlStatements: string[];
  apiRoutes: string[];
  summary: string;
}

// ─── Smart parser ─────────────────────────────────────────────────────────────

function parsePrompt(prompt: string): GeneratedResult {
  const lower = prompt.toLowerCase();

  if (lower.includes('todo') || lower.includes('task') || lower.includes('to-do') || lower.includes('to do')) {
    return {
      tables: [
        {
          name: 'todos',
          columns: [
            { name: 'id',          type: 'uuid',        constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'user_id',     type: 'uuid',        constraint: 'NOT NULL REFERENCES users(id)' },
            { name: 'title',       type: 'text',        constraint: 'NOT NULL' },
            { name: 'description', type: 'text',        constraint: '' },
            { name: 'completed',   type: 'boolean',     constraint: 'DEFAULT false' },
            { name: 'priority',    type: 'text',        constraint: "DEFAULT 'medium'" },
            { name: 'due_date',    type: 'date',        constraint: '' },
            { name: 'created_at',  type: 'timestamptz', constraint: 'DEFAULT now()' },
            { name: 'updated_at',  type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'users',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'email',      type: 'text',        constraint: 'UNIQUE NOT NULL' },
            { name: 'full_name',  type: 'text',        constraint: '' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      sqlStatements: [
        `CREATE TABLE users (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  email text UNIQUE NOT NULL,\n  full_name text,\n  created_at timestamptz DEFAULT now()\n);`,
        `CREATE TABLE todos (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  title text NOT NULL,\n  description text,\n  completed boolean DEFAULT false,\n  priority text DEFAULT 'medium',\n  due_date date,\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n);`,
        `-- Row Level Security\nALTER TABLE todos ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Users see own todos" ON todos\n  FOR ALL USING (user_id = auth.uid());`,
      ],
      apiRoutes: [
        'GET    /api/v1/todos              — List your todos',
        'POST   /api/v1/todos              — Create a todo',
        'PATCH  /api/v1/todos/:id          — Update / complete a todo',
        'DELETE /api/v1/todos/:id          — Delete a todo',
        'GET    /api/v1/todos?completed=true — Fetch completed todos',
      ],
      summary: '2 tables · 5 REST APIs · Row Level Security — users only see their own todos.',
    };
  }

  if (lower.includes('blog') || lower.includes('post') || lower.includes('article')) {
    return {
      tables: [
        {
          name: 'posts',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'author_id',  type: 'uuid',        constraint: 'NOT NULL REFERENCES users(id)' },
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
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'post_id',    type: 'uuid',        constraint: 'NOT NULL REFERENCES posts(id)' },
            { name: 'user_id',    type: 'uuid',        constraint: 'NOT NULL REFERENCES users(id)' },
            { name: 'body',       type: 'text',        constraint: 'NOT NULL' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'users',
          columns: [
            { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'email',      type: 'text',        constraint: 'UNIQUE NOT NULL' },
            { name: 'username',   type: 'text',        constraint: 'UNIQUE NOT NULL' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      sqlStatements: [
        `CREATE TABLE users (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  email text UNIQUE NOT NULL,\n  username text UNIQUE NOT NULL,\n  created_at timestamptz DEFAULT now()\n);`,
        `CREATE TABLE posts (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  author_id uuid NOT NULL REFERENCES users(id),\n  title text NOT NULL,\n  slug text UNIQUE NOT NULL,\n  content text,\n  published boolean DEFAULT false,\n  created_at timestamptz DEFAULT now()\n);`,
        `CREATE TABLE comments (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,\n  user_id uuid NOT NULL REFERENCES users(id),\n  body text NOT NULL,\n  created_at timestamptz DEFAULT now()\n);`,
      ],
      apiRoutes: [
        'GET    /api/v1/posts               — List published posts',
        'POST   /api/v1/posts               — Create post (auth)',
        'GET    /api/v1/posts/:slug         — Get post + comments',
        'POST   /api/v1/comments            — Add comment (auth)',
        'DELETE /api/v1/comments/:id        — Delete comment',
      ],
      summary: '3 tables · 5 REST APIs · author-scoped writes and cascading deletes.',
    };
  }

  if (lower.includes('shop') || lower.includes('store') || lower.includes('ecommerce') || lower.includes('product')) {
    return {
      tables: [
        {
          name: 'products',
          columns: [
            { name: 'id',          type: 'uuid',    constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'name',        type: 'text',    constraint: 'NOT NULL' },
            { name: 'description', type: 'text',    constraint: '' },
            { name: 'price',       type: 'numeric', constraint: 'NOT NULL' },
            { name: 'stock',       type: 'integer', constraint: 'DEFAULT 0' },
            { name: 'category',    type: 'text',    constraint: '' },
            { name: 'created_at',  type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'orders',
          columns: [
            { name: 'id',          type: 'uuid',    constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'customer_id', type: 'uuid',    constraint: 'NOT NULL REFERENCES users(id)' },
            { name: 'total',       type: 'numeric', constraint: 'NOT NULL' },
            { name: 'status',      type: 'text',    constraint: "DEFAULT 'pending'" },
            { name: 'created_at',  type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'order_items',
          columns: [
            { name: 'id',         type: 'uuid',    constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'order_id',   type: 'uuid',    constraint: 'NOT NULL REFERENCES orders(id)' },
            { name: 'product_id', type: 'uuid',    constraint: 'NOT NULL REFERENCES products(id)' },
            { name: 'quantity',   type: 'integer', constraint: 'NOT NULL' },
            { name: 'unit_price', type: 'numeric', constraint: 'NOT NULL' },
          ],
        },
      ],
      sqlStatements: [
        `CREATE TABLE products (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  name text NOT NULL,\n  price numeric NOT NULL,\n  stock integer DEFAULT 0,\n  category text,\n  created_at timestamptz DEFAULT now()\n);`,
        `CREATE TABLE orders (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  customer_id uuid NOT NULL REFERENCES users(id),\n  total numeric NOT NULL,\n  status text DEFAULT 'pending',\n  created_at timestamptz DEFAULT now()\n);`,
        `CREATE TABLE order_items (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,\n  product_id uuid NOT NULL REFERENCES products(id),\n  quantity integer NOT NULL,\n  unit_price numeric NOT NULL\n);`,
      ],
      apiRoutes: [
        'GET    /api/v1/products            — Browse products',
        'GET    /api/v1/products/:id        — Product detail',
        'POST   /api/v1/orders             — Place order (auth)',
        'GET    /api/v1/orders/:id          — Order detail',
        'PATCH  /api/v1/orders/:id/status   — Update status',
      ],
      summary: '3 tables · 5 REST APIs · customer-scoped order isolation and price snapshots.',
    };
  }

  if (lower.includes('chat') || lower.includes('message') || lower.includes('channel')) {
    return {
      tables: [
        {
          name: 'channels',
          columns: [
            { name: 'id',         type: 'uuid',    constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'name',       type: 'text',    constraint: 'NOT NULL' },
            { name: 'is_private', type: 'boolean', constraint: 'DEFAULT false' },
            { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
        {
          name: 'messages',
          columns: [
            { name: 'id',         type: 'uuid', constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
            { name: 'channel_id', type: 'uuid', constraint: 'NOT NULL REFERENCES channels(id)' },
            { name: 'sender_id',  type: 'uuid', constraint: 'NOT NULL REFERENCES users(id)' },
            { name: 'content',    type: 'text', constraint: 'NOT NULL' },
            { name: 'sent_at',    type: 'timestamptz', constraint: 'DEFAULT now()' },
          ],
        },
      ],
      sqlStatements: [
        `CREATE TABLE channels (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  name text NOT NULL,\n  is_private boolean DEFAULT false,\n  created_at timestamptz DEFAULT now()\n);`,
        `CREATE TABLE messages (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,\n  sender_id uuid NOT NULL REFERENCES users(id),\n  content text NOT NULL,\n  sent_at timestamptz DEFAULT now()\n);`,
        `-- Realtime subscription\nALTER TABLE messages REPLICA IDENTITY FULL;\nCOMMENT ON TABLE messages IS 'realtime:enabled';`,
      ],
      apiRoutes: [
        'GET    /api/v1/channels                  — List channels',
        'POST   /api/v1/channels                  — Create channel',
        'GET    /api/v1/channels/:id/messages      — Fetch messages',
        'POST   /api/v1/messages                  — Send message (auth)',
        'WS     /realtime/channels/:id            — Live message stream',
      ],
      summary: '2 tables · 5 routes · WebSocket realtime subscriptions enabled out of the box.',
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
          { name: 'id',         type: 'uuid',        constraint: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
          { name: 'user_id',    type: 'uuid',        constraint: 'REFERENCES users(id)' },
          { name: 'name',       type: 'text',        constraint: 'NOT NULL' },
          { name: 'data',       type: 'jsonb',       constraint: "DEFAULT '{}'" },
          { name: 'created_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
          { name: 'updated_at', type: 'timestamptz', constraint: 'DEFAULT now()' },
        ],
      },
    ],
    sqlStatements: [
      `CREATE TABLE ${tableName} (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id uuid REFERENCES users(id),\n  name text NOT NULL,\n  data jsonb DEFAULT '{}',\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n);`,
    ],
    apiRoutes: [
      `GET    /api/v1/${tableName}        — List records`,
      `POST   /api/v1/${tableName}        — Create record`,
      `GET    /api/v1/${tableName}/:id    — Get record`,
      `PATCH  /api/v1/${tableName}/:id    — Update record`,
      `DELETE /api/v1/${tableName}/:id    — Delete record`,
    ],
    summary: `1 table · 5 REST APIs · auto-generated CRUD with user-scoped row security.`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  uuid:        'text-purple-400',
  text:        'text-green-400',
  boolean:     'text-yellow-400',
  integer:     'text-blue-400',
  numeric:     'text-blue-400',
  date:        'text-orange-400',
  timestamptz: 'text-orange-400',
  jsonb:       'text-pink-400',
};

const METHOD_COLOR: Record<string, string> = {
  GET:    'bg-green-500/20 text-green-400 border-green-500/30',
  POST:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PATCH:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  WS:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const SUGGESTIONS = [
  { label: 'Todo list app', prompt: 'Create a todo list table with title, status and due date' },
  { label: 'Blog platform',  prompt: 'Build a blog with posts and comments' },
  { label: 'Online store',   prompt: 'Create an e-commerce store with products and orders' },
  { label: 'Chat app',       prompt: 'Build a real-time chat app with channels and messages' },
];

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconTable = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconApi = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconSql = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconCheck = ({ className = 'w-3.5 h-3.5 text-green-400' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const IconSpin = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIBuilderPage() {
  const [prompt, setPrompt]           = useState('');
  const [phase, setPhase]             = useState<'idle' | 'thinking' | 'building' | 'done'>('idle');
  const [result, setResult]           = useState<GeneratedResult | null>(null);
  const [visibleCols, setVisibleCols] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab]     = useState<'tables' | 'sql' | 'api'>('tables');
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [thinkDots, setThinkDots]     = useState('');
  const [copiedIdx, setCopiedIdx]     = useState<number | null>(null);
  const [apiError, setApiError]       = useState('');

  useEffect(() => {
    if (phase !== 'thinking') return;
    const id = setInterval(() => setThinkDots(d => d.length >= 3 ? '' : d + '.'), 350);
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
    setApiError('');

    const projectId = typeof window !== 'undefined' ? localStorage.getItem('current_project_id') : null;
    const token     = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    // ── Try real backend first ──────────────────────────────────────────────
    if (projectId && token) {
      try {
        const apiBase = "https://api.zendbx.in";
        const res = await fetch(`${apiBase}/api/ai/${projectId}/generate-backend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ description: text }),
        });

        if (res.ok) {
          const data = await res.json();
          const plan = data.plan ?? {};
          const execution = data.execution ?? {};

          // Map backend response → UI shape
          const mapped: GeneratedResult = {
            tables: (plan.tables ?? []).map((t: any) => ({
              name: t.name,
              columns: (t.columns ?? []).map((c: any) => ({
                name: c.name,
                type: (c.type ?? 'text').toLowerCase(),
                constraint: [
                  c.primary_key ? 'PRIMARY KEY' : '',
                  c.default ? `DEFAULT ${c.default}` : '',
                  c.nullable === false ? 'NOT NULL' : '',
                  c.unique ? 'UNIQUE' : '',
                ].filter(Boolean).join(' '),
              })),
            })),
            sqlStatements: (plan.tables ?? []).map((t: any) => {
              const cols = (t.columns ?? []).map((c: any) => {
                let def = `  "${c.name}" ${c.type ?? 'TEXT'}`;
                if (c.primary_key) def += ' PRIMARY KEY';
                if (c.default)     def += ` DEFAULT ${c.default}`;
                if (c.nullable === false) def += ' NOT NULL';
                if (c.unique)      def += ' UNIQUE';
                return def;
              }).join(',\n');
              return `CREATE TABLE IF NOT EXISTS "${t.name}" (\n${cols}\n);`;
            }),
            apiRoutes: [
              ...(plan.tables ?? []).flatMap((t: any) => [
                `GET    /p/${execution.slug ?? '{slug}'}/${t.name}    — List ${t.name}`,
                `POST   /p/${execution.slug ?? '{slug}'}/${t.name}    — Create ${t.name.slice(0,-1)}`,
                `PATCH  /p/${execution.slug ?? '{slug}'}/${t.name}/:id — Update`,
                `DELETE /p/${execution.slug ?? '{slug}'}/${t.name}/:id — Delete`,
              ]),
            ],
            summary: data.summary ?? `${(plan.tables ?? []).length} tables created in your project.`,
          };

          setResult(mapped);
          setPhase('building');

          for (let t = 0; t < mapped.tables.length; t++) {
            const table = mapped.tables[t];
            setActiveTableIdx(t);
            for (let c = 0; c <= table.columns.length; c++) {
              setVisibleCols(prev => ({ ...prev, [table.name]: c }));
              await delay(120);
            }
            await delay(180);
          }

          setPhase('done');
          return; // ← real API succeeded, skip demo fallback
        } else {
          const err = await res.json().catch(() => ({}));
          setApiError(err.detail ?? `API error ${res.status}`);
        }
      } catch (e: any) {
        setApiError(e.message ?? 'Network error');
      }
    } else {
      setApiError('No project selected. Select a project first to generate real tables.');
    }

    // ── Fallback: demo mode ─────────────────────────────────────────────────
    const parsed = parsePrompt(text);
    setResult(parsed);
    setPhase('building');

    for (let t = 0; t < parsed.tables.length; t++) {
      const table = parsed.tables[t];
      setActiveTableIdx(t);
      for (let c = 0; c <= table.columns.length; c++) {
        setVisibleCols(prev => ({ ...prev, [table.name]: c }));
        await delay(120);
      }
      await delay(180);
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

  const handleCopySQL = (idx: number, sql: string) => {
    navigator.clipboard.writeText(sql).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
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
    <div className="p-6 max-w-7xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[#ededed]">AI Backend Builder</h1>
            <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/40 rounded-full text-xs font-semibold text-orange-400">
              Beta
            </span>
          </div>
          <p className="text-sm text-[#a1a1a1]">
            Describe your app in plain English — the AI generates your tables, SQL, and APIs in real time.
          </p>
        </div>
        {phase === 'done' && (
          <button onClick={reset}
            className="px-4 py-2 text-sm text-[#a1a1a1] border border-[#2a2a2a] rounded-lg hover:border-orange-500/50 hover:text-orange-400 transition-all">
            Start over
          </button>
        )}
      </div>

      {/* Prompt box */}
      {phase === 'idle' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s.label} onClick={() => handleSuggestion(s)}
                className="flex items-center gap-2 px-4 py-3 bg-[#141414] border border-[#2a2a2a] rounded-xl hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left">
                <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-[#a1a1a1]">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-[#141414] border-2 border-[#2a2a2a] rounded-2xl overflow-hidden focus-within:border-orange-500/50 transition-colors">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
              placeholder="e.g.  Create a todo list with title, done status, and due date…"
              rows={3}
              className="w-full px-5 pt-5 pb-3 bg-transparent text-[#ededed] placeholder-[#3a3a3a] text-sm resize-none focus:outline-none"
            />
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a2a2a]">
              <span className="text-xs text-[#4a4a4a]">Cmd + Enter to generate</span>
              <button onClick={() => handleGenerate()} disabled={!prompt.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg text-sm font-semibold hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20">
                Generate
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Thinking */}
      {phase === 'thinking' && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <p className="text-[#ededed] font-semibold text-lg">Analyzing your description{thinkDots}</p>
          <p className="text-[#6b6b6b] text-sm">Planning tables, columns, relationships…</p>
        </div>
      )}

      {/* Results */}
      {(phase === 'building' || phase === 'done') && result && (
        <div className="space-y-4">

          {/* Summary */}
          {phase === 'done' && (
            <div className="flex items-start gap-3 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/30 rounded-xl px-5 py-4">
              <IconCheck className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#ededed] leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* API error notice — shown when backend failed and we fell back to demo */}
          {phase === 'done' && apiError && (
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-3">
              <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-sm text-yellow-300 font-medium">Demo mode — tables were NOT created in your project</p>
                <p className="text-xs text-yellow-400/70 mt-0.5">{apiError}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tables',     value: result.tables.length,        icon: <IconTable /> },
              { label: 'API Routes', value: result.apiRoutes.length,      icon: <IconApi /> },
              { label: 'SQL Blocks', value: result.sqlStatements.length,  icon: <IconSql /> },
            ].map(s => (
              <div key={s.label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
                <div className="flex justify-center mb-2 text-orange-400">{s.icon}</div>
                <div className="text-2xl font-bold text-[#ededed]">{s.value}</div>
                <div className="text-xs text-[#6b6b6b] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl overflow-hidden">
            <div className="flex border-b border-[#2a2a2a]">
              {([
                { key: 'tables', label: 'Tables',     icon: <IconTable /> },
                { key: 'sql',    label: 'SQL',         icon: <IconSql /> },
                { key: 'api',    label: 'API Routes',  icon: <IconApi /> },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                      : 'border-transparent text-[#6b6b6b] hover:text-[#ededed]'
                  }`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Tables tab */}
            {activeTab === 'tables' && (
              <div className="flex" style={{ minHeight: 360 }}>
                <div className="w-48 border-r border-[#2a2a2a] flex-shrink-0">
                  {result.tables.map((t, i) => {
                    const done = (visibleCols[t.name] ?? 0) >= t.columns.length;
                    return (
                      <button key={t.name} onClick={() => setActiveTableIdx(i)}
                        className={`w-full flex items-center gap-2.5 px-4 py-3.5 text-sm border-b border-[#1a1a1a] transition-all ${
                          activeTableIdx === i
                            ? 'bg-orange-500/10 text-orange-400 border-l-2 border-l-orange-500'
                            : 'text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-[#ededed]'
                        }`}>
                        <IconTable />
                        <span className="font-mono font-medium truncate">{t.name}</span>
                        {phase === 'building' && activeTableIdx === i && !done && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
                        )}
                        {done && <span className="ml-auto flex-shrink-0"><IconCheck /></span>}
                      </button>
                    );
                  })}
                </div>

                {currentTable && (
                  <div className="flex-1 overflow-auto">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-[#2a2a2a] bg-[#141414]">
                      <IconTable />
                      <span className="font-mono font-bold text-[#ededed] text-base">{currentTable.name}</span>
                      <span className="text-xs text-[#6b6b6b] ml-auto">
                        {visibleCols[currentTable.name] ?? 0} / {currentTable.columns.length} columns
                      </span>
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#1e1e1e]">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#4a4a4a] uppercase tracking-wider w-10">#</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#4a4a4a] uppercase tracking-wider">Column</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#4a4a4a] uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-[#4a4a4a] uppercase tracking-wider">Constraint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTable.columns.map((col, ci) => {
                          const revealed = (visibleCols[currentTable.name] ?? 0) > ci;
                          const isNew    = (visibleCols[currentTable.name] ?? 0) - 1 === ci && phase === 'building';
                          return (
                            <tr key={col.name}
                              style={{
                                opacity: revealed ? 1 : 0,
                                transform: revealed ? 'translateY(0)' : 'translateY(-4px)',
                                transition: 'opacity 0.2s ease, transform 0.2s ease',
                              }}
                              className={`border-b border-[#111] ${isNew ? 'bg-orange-500/5' : 'hover:bg-[#141414]'}`}>
                              <td className="px-6 py-3.5 text-[#4a4a4a] font-mono text-xs">{ci + 1}</td>
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2">
                                  {isNew && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />}
                                  <span className="font-mono font-medium text-[#ededed]">{col.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5">
                                <span className={`font-mono text-sm font-semibold ${TYPE_COLOR[col.type] ?? 'text-gray-400'}`}>
                                  {col.type}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">
                                <span className="font-mono text-xs text-[#6b6b6b]">{col.constraint}</span>
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

            {/* SQL tab */}
            {activeTab === 'sql' && (
              <div className="p-5 space-y-4">
                {result.sqlStatements.map((sql, i) => (
                  <div key={i} className="rounded-xl border border-[#2a2a2a] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-[#2a2a2a]">
                      <span className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-wider">
                        Statement {i + 1}
                      </span>
                      <button onClick={() => handleCopySQL(i, sql)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-[#6b6b6b] hover:text-[#ededed] hover:bg-[#2a2a2a] transition-all">
                        {copiedIdx === i
                          ? <><IconCheck className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied</span></>
                          : <><IconCopy />Copy</>}
                      </button>
                    </div>
                    <pre className="p-5 text-sm font-mono text-[#a1a1a1] overflow-x-auto bg-black leading-relaxed">{sql}</pre>
                  </div>
                ))}
              </div>
            )}

            {/* API tab */}
            {activeTab === 'api' && (
              <div className="p-5 space-y-2">
                {result.apiRoutes.map((route, i) => {
                  const parts  = route.split(/\s+/);
                  const method = parts[0];
                  const path   = parts[1];
                  const desc   = parts.slice(2).join(' ').replace(/^—\s*/, '');
                  return (
                    <div key={i} className="flex items-center gap-4 px-4 py-3.5 bg-[#141414] border border-[#2a2a2a] rounded-xl hover:border-[#3a3a3a] transition-all">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border flex-shrink-0 ${METHOD_COLOR[method] ?? 'bg-[#2a2a2a] text-[#a1a1a1] border-[#3a3a3a]'}`}>
                        {method}
                      </span>
                      <span className="font-mono text-sm text-[#ededed] flex-shrink-0">{path}</span>
                      <span className="text-sm text-[#6b6b6b] ml-auto text-right">{desc}</span>
                    </div>
                  );
                })}
                <div className="mt-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-400">
                    <span className="font-semibold">Base URL: </span>
                    <span className="font-mono">https://api.zendbx.in/v1/your-project</span>
                  </p>
                  <p className="text-xs text-[#6b6b6b] mt-1">
                    All write endpoints require{' '}
                    <code className="text-orange-400 font-mono">Authorization: Bearer &lt;token&gt;</code>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          {phase === 'done' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-xl px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#ededed]">Like what you see?</p>
                <p className="text-xs text-[#6b6b6b] mt-0.5">
                  {apiError
                    ? 'Select a project to create these tables for real.'
                    : 'Tables have been created in your project. Head to the Table Editor to see them.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={reset}
                  className="px-4 py-2 text-sm border border-[#2a2a2a] text-[#a1a1a1] rounded-lg hover:border-[#3a3a3a] hover:text-[#ededed] transition-all whitespace-nowrap">
                  Try another
                </button>
                <button
                  onClick={() => {
                    if (apiError) {
                      window.location.href = '/onboarding';
                    } else {
                      window.location.href = '/dashboard/database/tables';
                    }
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg text-sm font-semibold hover:from-orange-500 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/20 whitespace-nowrap">
                  Create real tables
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
