import { CodeBlock, Note, Heading } from '../../components';

export const metadata = { title: 'Error Codes — ZendBX Docs' };

export default function ErrorsPage() {
  return (
    <article>
      <Heading level={1}>Error Codes & Troubleshooting</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Complete reference for all ZendBX error codes with solutions.
      </p>

      <Heading level={2} id="format">Error Response Format</Heading>
      <p className="text-sm text-gray-400 mb-3">
        All errors follow this consistent format:
      </p>
      <CodeBlock code={`{
  "error": {
    "message": "Human-readable error description",
    "status": 400,
    "code": "INVALID_REQUEST",
    "details": {
      // Additional context
    }
  },
  "data": null
}`} lang="json" />

      <Heading level={2} id="4xx">4xx Client Errors</Heading>

      <div className="space-y-6 my-6">
        {/* 400 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">400 Bad Request</h4>
          <p className="text-xs text-gray-400 mb-3">The request was malformed or missing required parameters.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Common Causes:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>Missing required fields in request body</li>
            <li>Invalid JSON syntax</li>
            <li>Invalid UUID format for projectId</li>
            <li>Malformed query parameters</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <CodeBlock code={`// ❌ Wrong - missing required field
await db.from('users').insert({ name: 'John' }) // email required

// ✅ Correct
await db.from('users').insert({ name: 'John', email: 'john@example.com' })`} lang="typescript" />
        </div>

        {/* 401 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">401 Unauthorized</h4>
          <p className="text-xs text-gray-400 mb-3">Missing or invalid authentication token.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Common Causes:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>No <code className="text-orange-400">Authorization</code> header</li>
            <li>Expired JWT token</li>
            <li>Invalid API key</li>
            <li>Token signed with wrong secret</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <CodeBlock code={`// Check if user is signed in
const { data: { user } } = await db.auth.getUser()
if (!user) {
  // Redirect to login
  window.location.href = '/login'
}

// Or sign in again
await db.auth.signIn({ email, password })`} lang="typescript" />
        </div>

        {/* 403 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">403 Forbidden</h4>
          <p className="text-xs text-gray-400 mb-3">Authenticated but not authorized to perform this action.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Common Causes:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>Row Level Security policy denied access</li>
            <li>Insufficient permissions for the project</li>
            <li>Trying to access another user's data</li>
            <li>Using anon key for admin operations</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <CodeBlock code={`// Check RLS policies in dashboard
// Ensure policy allows current user:
CREATE POLICY "Users can read own data"
ON users FOR SELECT
USING (auth.uid() = id);

// Or use service_role key on server (bypasses RLS)
const serverClient = createClient({
  apiUrl, projectId,
  anonKey: process.env.ZENDBX_SERVICE_KEY
})`} lang="sql" />
        </div>

        {/* 404 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">404 Not Found</h4>
          <p className="text-xs text-gray-400 mb-3">The requested resource doesn't exist.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Common Causes:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>Table doesn't exist</li>
            <li>Bucket doesn't exist</li>
            <li>File not found</li>
            <li>Wrong project slug in URL</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <CodeBlock code={`// Verify table exists
const { data: tables } = await db.db.listTables()
console.log(tables)

// Check bucket exists
const { data: buckets } = await db.storage.listBuckets()
console.log(buckets)`} lang="typescript" />
        </div>

        {/* 409 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">409 Conflict</h4>
          <p className="text-xs text-gray-400 mb-3">Unique constraint violation or duplicate key.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Common Causes:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>Email already exists (signup)</li>
            <li>Duplicate primary key</li>
            <li>Unique constraint violation</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <CodeBlock code={`// Check if exists before insert
const { data: existing } = await db
  .from('users')
  .select('email')
  .eq('email', email)
  .single()

if (existing) {
  alert('Email already registered')
} else {
  await db.from('users').insert({ email, ... })
}`} lang="typescript" />
        </div>

        {/* 429 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">429 Too Many Requests</h4>
          <p className="text-xs text-gray-400 mb-3">Rate limit exceeded.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Rate Limits:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>Free tier: 100 requests/minute</li>
            <li>Pro tier: 1000 requests/minute</li>
            <li>Enterprise: Custom limits</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <CodeBlock code={`// Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** i)))
        continue
      }
      throw error
    }
  }
}`} lang="typescript" />
        </div>
      </div>

      <Heading level={2} id="5xx">5xx Server Errors</Heading>

      <div className="space-y-6 my-6">
        {/* 500 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">500 Internal Server Error</h4>
          <p className="text-xs text-gray-400 mb-3">Unexpected server error.</p>
          
          <p className="text-xs font-semibold text-white mb-1">Common Causes:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-3">
            <li>Database connection failed</li>
            <li>Invalid SQL syntax</li>
            <li>Server misconfiguration</li>
          </ul>

          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Retry the request</li>
            <li>Check server status at <a href="https://status.zendbx.in" className="text-orange-400 hover:underline">status.zendbx.in</a></li>
            <li>Contact support if persistent</li>
          </ul>
        </div>

        {/* 503 */}
        <div className="border border-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-orange-400 mb-2">503 Service Unavailable</h4>
          <p className="text-xs text-gray-400 mb-3">Service temporarily unavailable (maintenance or overload).</p>
          
          <p className="text-xs font-semibold text-white mb-1">Solution:</p>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>Wait 30-60 seconds and retry</li>
            <li>Check <a href="https://status.zendbx.in" className="text-orange-400 hover:underline">status.zendbx.in</a></li>
            <li>Subscribe to status notifications</li>
          </ul>
        </div>
      </div>

      <Heading level={2} id="specific">Specific Error Messages</Heading>

      <div className="space-y-4 my-6">
        <div className="border-l-2 border-orange-500 pl-4">
          <p className="text-xs font-mono text-orange-400 mb-1">"relation does not exist"</p>
          <p className="text-xs text-gray-400 mb-2">Table doesn't exist in your database.</p>
          <CodeBlock code={`// Create the table first in Dashboard → Database → Tables
// Or programmatically:
await db.db.createTable('todos', [
  { name: 'id', type: 'uuid', primary_key: true },
  { name: 'title', type: 'text' },
])`} lang="typescript" />
        </div>

        <div className="border-l-2 border-orange-500 pl-4">
          <p className="text-xs font-mono text-orange-400 mb-1">"column does not exist"</p>
          <p className="text-xs text-gray-400 mb-2">You're selecting/updating a column that doesn't exist.</p>
          <CodeBlock code={`// Check table schema
const { data: schema } = await db.db.getTable('users')
console.log(schema.columns)`} lang="typescript" />
        </div>

        <div className="border-l-2 border-orange-500 pl-4">
          <p className="text-xs font-mono text-orange-400 mb-1">"Missing projectId"</p>
          <p className="text-xs text-gray-400 mb-2">Client initialized without required projectId.</p>
          <CodeBlock code={`// ❌ Wrong
const db = createClient({ apiUrl, anonKey })

// ✅ Correct
const db = createClient({ apiUrl, anonKey, projectId: 'your-project-id' })`} lang="typescript" />
        </div>

        <div className="border-l-2 border-orange-500 pl-4">
          <p className="text-xs font-mono text-orange-400 mb-1">"CORS policy blocked"</p>
          <p className="text-xs text-gray-400 mb-2">Your domain isn't allowed in CORS settings.</p>
          <p className="text-xs text-gray-400">
            Solution: Add your domain in <strong className="text-white">Dashboard → Settings → CORS</strong>
          </p>
        </div>

        <div className="border-l-2 border-orange-500 pl-4">
          <p className="text-xs font-mono text-orange-400 mb-1">"WebSocket connection failed"</p>
          <p className="text-xs text-gray-400 mb-2">Can't connect to realtime server.</p>
          <CodeBlock code={`// Check WebSocket server is running
// Default: ws://localhost:8001

// Or specify custom URL:
const db = createClient({
  apiUrl, anonKey, projectId,
  wsUrl: 'wss://ws.zendbx.in'
})`} lang="typescript" />
        </div>
      </div>

      <Heading level={2} id="debugging">Debugging Tips</Heading>
      <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside mb-6">
        <li><strong className="text-white">Check browser console</strong> — Full error details appear in DevTools</li>
        <li><strong className="text-white">Enable debug logging</strong> — Set <code className="text-orange-400">DEBUG=zendbx:*</code></li>
        <li><strong className="text-white">Test with cURL</strong> — Isolate SDK vs API issues</li>
        <li><strong className="text-white">Verify credentials</strong> — Double-check URL, project ID, and API keys</li>
        <li><strong className="text-white">Check RLS policies</strong> — Use service key to bypass RLS temporarily</li>
      </ul>

      <div className="mt-10 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <p className="text-sm font-semibold text-orange-400 mb-2">Need Help?</p>
        <p className="text-sm text-gray-400">
          Join our <a href="https://discord.gg/zendbx" className="text-orange-400 hover:underline">Discord community</a> or
          email <a href="mailto:support@zendbx.in" className="text-orange-400 hover:underline">support@zendbx.in</a>
        </p>
      </div>
    </article>
  );
}

