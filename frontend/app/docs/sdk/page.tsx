import { CodeBlock, Note, Heading, ParamTable, Badge, Tabs } from '../components';

export const metadata = { title: 'SDK Reference — ZendBX Docs' };

const install = `npm install @zendbx/sdk`;

const createClientBasic = `import { createClient } from '@zendbx/sdk';

const db = createClient({
  apiUrl: 'https://api.zendbx.in',
  anonKey: 'your-anon-key',
  projectSlug: 'my-project',
});`;

const createClientAdvanced = `const db = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  anonKey: process.env.ZENDBX_ANON_KEY!,
  projectSlug: 'my-project',

  // Custom token provider — no localStorage required
  getAccessToken: () => myAuthStore.getToken(),

  // Or inject a static token
  accessToken: 'eyJhbGci...',

  // Custom storage key (default: 'zendbx_token')
  // Pass null to disable localStorage entirely (Node.js, SSR)
  storageKey: null,
});`;

const signUp = `const { data, error } = await db.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  name: 'Jane Doe',       // optional
});
// data: { user: User, session: Session }`;

const signIn = `const { data, error } = await db.auth.signIn({
  email: 'user@example.com',
  password: 'password123',
});`;

const getUser = `const { data } = await db.auth.getUser();
// data: { user: User | null }`;

const getSession = `const { data } = await db.auth.getSession();
// data: { session: Session | null }`;

const signOut = `await db.auth.signOut();`;

const setToken = `// Inject token from an external auth system (e.g. ZendBX dashboard SSO)
db.auth.setAccessToken(localStorage.getItem('token') ?? '');

// Retrieve current token
const token = db.auth.getAccessToken();

// Clear token
db.auth.clearAccessToken();`;

const authStateChange = `const { unsubscribe } = db.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in:', session?.user);
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      break;
  }
});

// Stop listening:
unsubscribe();`;

const fromSelect = `// Select all columns
const { data } = await db.from('users').select('*');

// Select specific columns
const { data } = await db.from('users').select('id, name, email');

// With filters
const { data } = await db
  .from('users')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(20);`;

const filters = `// Equality
.eq('column', value)
.neq('column', value)

// Comparison
.gt('age', 18)
.gte('score', 90)
.lt('price', 100)
.lte('quantity', 50)

// String matching
.like('name', '%john%')
.ilike('email', '%@gmail.com')

// NULL checks
.is('deleted_at', null)

// Range
.range(0, 9)    // rows 0-9 (offset/limit)`;

const insert = `// Insert one row
const { data, error } = await db.from('todos').insert({
  title: 'My first todo',
  done: false,
});

// Insert multiple rows
const { data } = await db.from('todos').insert([
  { title: 'Task 1', done: false },
  { title: 'Task 2', done: true },
]);`;

const update = `const { data, error } = await db
  .from('todos')
  .update({ done: true })
  .eq('id', 'some-uuid');`;

const del = `const { data, error } = await db
  .from('todos')
  .delete()
  .eq('id', 'some-uuid');`;

const storageUpload = `const bucket = db.storage.bucket('avatars');

// Upload a File (browser)
const { data, error } = await bucket.upload(file, 'user-123.png');

// Upload a Buffer (Node.js)
const { data, error } = await bucket.upload(buffer, 'user-123.pdf', {
  contentType: 'application/pdf',
});`;

const storageList = `const { data: files } = await bucket.list();

// With search and sorting
const { data: files } = await bucket.list({
  search: 'invoice',
  sortBy: 'file_size',
  sortDir: 'desc',
});`;

const storageDelete = `await bucket.delete('file-uuid');

// Bulk delete
await bucket.bulkDelete(['uuid-1', 'uuid-2']);`;

const signedUrl = `const { data } = await bucket.createSignedUrl('file-uuid', '1h');
console.log(data.url); // Temporary access URL`;

const realtime = `const sub = db.realtime
  .from('messages')
  .on('INSERT', (payload) => console.log('New:', payload.new))
  .on('UPDATE', (payload) => console.log('Changed:', payload.new))
  .on('DELETE', (payload) => console.log('Removed:', payload.old))
  .subscribe();

sub.unsubscribe();`;

export default function SDKPage() {
  return (
    <article>
      <Heading level={1}>SDK Reference</Heading>
      <p className="text-sm text-gray-400 mb-2">
        The official TypeScript SDK for ZendBX. Works in React, Next.js, Vue, Svelte, Node.js, and any modern JS runtime.
      </p>
      <div className="flex items-center gap-2 mb-8">
        <Badge color="orange">@zendbx/sdk</Badge>
        <Badge color="green">v1.1.0</Badge>
        <Badge color="blue">TypeScript</Badge>
      </div>

      <Heading level={2} id="install">Installation</Heading>
      <CodeBlock code={install} lang="bash" />

      {/* createClient */}
      <Heading level={2} id="create-client">createClient()</Heading>
      <p className="text-sm text-gray-400 mb-3">Creates and returns a ZendBX client instance. Call this once and export the result.</p>

      <CodeBlock code={createClientBasic} lang="typescript" title="Basic usage" />
      <CodeBlock code={createClientAdvanced} lang="typescript" title="Advanced usage with custom token provider" />

      <ParamTable params={[
        { name: 'apiUrl', type: 'string', required: true, description: 'Your ZendBX backend URL.' },
        { name: 'anonKey', type: 'string', required: true, description: 'Your project anon (public) key.' },
        { name: 'projectSlug', type: 'string', required: true, description: 'Your project slug (e.g. my-project).' },
        { name: 'projectId', type: 'string', required: false, description: 'Project UUID. Can be used instead of projectSlug.' },
        { name: 'accessToken', type: 'string', required: false, description: 'Static access token. Takes precedence over stored token.' },
        { name: 'getAccessToken', type: '() => string | null | Promise<string | null>', required: false, description: 'Async callback called on every request. Ideal for React state or SSR.' },
        { name: 'storageKey', type: 'string | null', required: false, description: "localStorage key for token persistence. Default: 'zendbx_token'. Pass null to disable." },
        { name: 'wsUrl', type: 'string', required: false, description: 'WebSocket server URL. Defaults to same host on port 8001.' },
      ]} />

      {/* Auth */}
      <Heading level={2} id="auth">db.auth</Heading>

      <Heading level={3} id="auth-signup">signUp()</Heading>
      <CodeBlock code={signUp} lang="typescript" />

      <Heading level={3} id="auth-signin">signIn()</Heading>
      <CodeBlock code={signIn} lang="typescript" />

      <Heading level={3} id="auth-getuser">getUser()</Heading>
      <CodeBlock code={getUser} lang="typescript" />

      <Heading level={3} id="auth-getsession">getSession()</Heading>
      <CodeBlock code={getSession} lang="typescript" />

      <Heading level={3} id="auth-signout">signOut()</Heading>
      <CodeBlock code={signOut} lang="typescript" />

      <Heading level={3} id="auth-token">setAccessToken() / getAccessToken() / clearAccessToken()</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Use these to inject a token from an external auth system without depending on localStorage.
      </p>
      <CodeBlock code={setToken} lang="typescript" />

      <Heading level={3} id="auth-state">onAuthStateChange()</Heading>
      <CodeBlock code={authStateChange} lang="typescript" />

      {/* Database */}
      <Heading level={2} id="database">db.from()</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Start a chainable query against any table. Directly awaitable — no <code className="text-orange-400">.execute()</code> needed.
      </p>

      <Heading level={3} id="select">select()</Heading>
      <CodeBlock code={fromSelect} lang="typescript" />

      <Heading level={3} id="filters">Filters</Heading>
      <CodeBlock code={filters} lang="typescript" />

      <Heading level={3} id="insert">insert()</Heading>
      <CodeBlock code={insert} lang="typescript" />

      <Heading level={3} id="update">update()</Heading>
      <CodeBlock code={update} lang="typescript" />

      <Heading level={3} id="delete">delete()</Heading>
      <CodeBlock code={del} lang="typescript" />

      <Note>Always chain at least one filter (<code className="text-orange-400">.eq()</code>, etc.) before <code className="text-orange-400">.update()</code> or <code className="text-orange-400">.delete()</code> to avoid modifying all rows.</Note>

      {/* Storage */}
      <Heading level={2} id="storage">db.storage</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Object storage backed by Backblaze B2. Access files via bucket slug — no UUIDs required.
      </p>

      <Heading level={3} id="storage-upload">bucket().upload()</Heading>
      <CodeBlock code={storageUpload} lang="typescript" />

      <Heading level={3} id="storage-list">bucket().list()</Heading>
      <CodeBlock code={storageList} lang="typescript" />

      <Heading level={3} id="storage-delete">bucket().delete()</Heading>
      <CodeBlock code={storageDelete} lang="typescript" />

      <Heading level={3} id="storage-signed-url">bucket().createSignedUrl()</Heading>
      <CodeBlock code={signedUrl} lang="typescript" />

      <ParamTable params={[
        { name: 'fileId', type: 'string', required: true, description: 'UUID of the file to sign.' },
        { name: 'expiry', type: "'5m' | '15m' | '1h' | '24h' | '7d'", required: false, description: "Token expiry. Default: '1h'." },
      ]} />

      {/* Realtime */}
      <Heading level={2} id="realtime">db.realtime</Heading>
      <CodeBlock code={realtime} lang="typescript" />

      <Note>
        Realtime requires the WebSocket server to be running. The client auto-reconnects on disconnect.
        Event types: <code className="text-orange-400">INSERT</code>, <code className="text-orange-400">UPDATE</code>, <code className="text-orange-400">DELETE</code>, <code className="text-orange-400">*</code> (all events).
      </Note>

      {/* Error handling */}
      <Heading level={2} id="errors">Error Handling</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Every method returns <code className="text-orange-400">{'{ data, error }'}</code>. Check <code className="text-orange-400">error</code> before using <code className="text-orange-400">data</code>.
      </p>
      <CodeBlock code={`const { data, error } = await db.from('todos').select('*');

if (error) {
  console.error(error.message);  // human-readable message
  console.error(error.status);   // HTTP status code (401, 403, 404, 500...)
  console.error(error.details);  // raw server response
  return;
}

// data is safe to use here
console.log(data);`} lang="typescript" />
    </article>
  );
}
