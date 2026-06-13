import { Heading, Note } from '../components';

export const metadata = { title: 'Architecture — ZendBX Docs' };

export default function ArchitecturePage() {
  const layers = [
    {
      name: 'Client Layer',
      color: 'border-orange-500/40 bg-orange-500/5',
      items: ['@zendbx/sdk (TypeScript)', 'REST HTTP calls', 'WebSocket (Realtime)', 'Dashboard (Next.js)'],
    },
    {
      name: 'API Gateway',
      color: 'border-blue-500/40 bg-blue-500/5',
      items: ['FastAPI (Python)', 'CORS middleware', 'ProjectContextMiddleware', 'RLS enforcer', 'Quota enforcer'],
    },
    {
      name: 'Services',
      color: 'border-green-500/40 bg-green-500/5',
      items: ['Auth service (JWT, OAuth, MFA)', 'Storage service (B2)', 'Realtime listener (LISTEN/NOTIFY)', 'AI service (Groq, Gemini)', 'Backup service'],
    },
    {
      name: 'Data Layer',
      color: 'border-purple-500/40 bg-purple-500/5',
      items: ['PostgreSQL (schema-per-project)', 'Backblaze B2 (object storage)', 'Redis (rate limiting, quotas)'],
    },
  ];

  const requestFlow = [
    { step: '1', label: 'Request arrives', desc: 'Client sends HTTP request with apikey + Authorization headers.' },
    { step: '2', label: 'CORS check', desc: 'CORSMiddleware validates the Origin header.' },
    { step: '3', label: 'Project resolution', desc: 'ProjectContextMiddleware resolves the project from the URL slug or path. Validates the apikey against the project.' },
    { step: '4', label: 'Authentication', desc: 'resolve_principal() tries platform JWT first, then project JWT. Returns a normalized principal.' },
    { step: '5', label: 'RLS context', desc: 'User ID and role are set via SET app.current_user_id on the database connection.' },
    { step: '6', label: 'Query execution', desc: 'SQL is executed inside the project schema with RLS active.' },
    { step: '7', label: 'Response', desc: 'Result is serialized to JSON and returned.' },
  ];

  return (
    <article>
      <Heading level={1}>Architecture</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX is a multi-layer system. Each layer has a single responsibility. Here's how everything fits together.
      </p>

      <Heading level={2} id="layers">System Layers</Heading>
      <div className="space-y-3 mb-8">
        {layers.map((layer) => (
          <div key={layer.name} className={`rounded-xl border p-4 ${layer.color}`}>
            <p className="text-sm font-bold text-white mb-2">{layer.name}</p>
            <div className="flex flex-wrap gap-2">
              {layer.items.map((item) => (
                <span key={item} className="text-xs px-2 py-1 rounded bg-black/30 text-gray-300 font-mono">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Heading level={2} id="request-flow">Request Flow</Heading>
      <div className="space-y-2 mb-8">
        {requestFlow.map((step) => (
          <div key={step.step} className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-orange-400">
              {step.step}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{step.label}</p>
              <p className="text-xs text-gray-500">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Heading level={2} id="schema-isolation">Schema Isolation</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Each project gets its own PostgreSQL schema. The schema name equals the project slug.
        All queries run with <code className="text-orange-400">SET search_path TO "{'{'}project_slug{'}'}", public</code>,
        ensuring complete data isolation without separate databases.
      </p>

      <Heading level={2} id="auth-architecture">Authentication Architecture</Heading>
      <p className="text-sm text-gray-400 mb-3">
        ZendBX has two token namespaces:
      </p>
      <div className="space-y-2 text-sm text-gray-400 mb-4">
        <div className="flex gap-3">
          <span className="text-orange-500">→</span>
          <div>
            <span className="text-white font-medium">Platform tokens</span> — issued at dashboard login, signed with <code className="text-orange-400">settings.SECRET_KEY</code>.
            Used by dashboard users, team members, project owners.
          </div>
        </div>
        <div className="flex gap-3">
          <span className="text-orange-500">→</span>
          <div>
            <span className="text-white font-medium">Project tokens</span> — issued by <code className="text-orange-400">auth.signIn()</code>,
            signed with the project's <code className="text-orange-400">jwt_secret</code>.
            Used by end users of applications built on ZendBX.
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-400">
        The <code className="text-orange-400">resolve_principal()</code> dependency tries both secrets and
        returns a normalized principal — endpoint code never needs to know which token type was used.
      </p>

      <Note>
        The <code className="text-orange-400">anon</code> key identifies the project but does not authenticate a user.
        It is never accepted as a Bearer token for authenticated operations.
      </Note>
    </article>
  );
}
