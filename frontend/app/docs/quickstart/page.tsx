import { CodeBlock, Note, Heading } from '../components';

export const metadata = { title: 'Quick Start — ZendBX Docs' };

const install = `npm install @zendbx/sdk`;

const envVars = `ZENDBX_URL=https://api.zendbx.in
ZENDBX_ANON_KEY=your-anon-key
ZENDBX_PROJECT_SLUG=my-project`;

const initClient = `import { createClient } from '@zendbx/sdk';

export const db = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  anonKey: process.env.ZENDBX_ANON_KEY!,
  projectSlug: process.env.ZENDBX_PROJECT_SLUG!,
});`;

const signUp = `const { data, error } = await db.auth.signUp({
  email: 'user@example.com',
  password: 'supersecret',
});

if (error) console.error(error.message);
else console.log('User created:', data.user);`;

const insert = `const { data, error } = await db.from('todos').insert({
  title: 'Learn ZendBX',
  done: false,
});`;

const query = `const { data: todos, error } = await db
  .from('todos')
  .select('id, title, done')
  .eq('done', false)
  .order('created_at', { ascending: false })
  .limit(20);`;

const uploadFile = `const bucket = db.storage.bucket('avatars');
const { data, error } = await bucket.upload(file, 'user-123.png');`;

const realtime = `const sub = db.realtime
  .from('todos')
  .on('INSERT', (payload) => {
    console.log('New todo:', payload.new);
  })
  .subscribe();

// Clean up:
sub.unsubscribe();`;

export default function QuickStartPage() {
  return (
    <article>
      <Heading level={1}>Quick Start</Heading>
      <p className="text-gray-400 text-sm mb-8">
        Get a fully working app with auth, database, storage, and realtime in under 5 minutes.
      </p>

      <Heading level={2} id="step-1">Step 1 — Create a Project</Heading>
      <p className="text-sm text-gray-400 mb-4">
        Log in to <a href="https://devapp.zendbx.in" className="text-orange-400 hover:underline">devapp.zendbx.in</a>,
        click <strong className="text-white">New Project</strong>, and give it a name. Once created, copy your
        <strong className="text-white"> Project URL</strong>, <strong className="text-white">Anon Key</strong>, and <strong className="text-white">Project Slug</strong>
        from Project Settings → API Keys.
      </p>

      <Heading level={2} id="step-2">Step 2 — Install the SDK</Heading>
      <CodeBlock code={install} lang="bash" />

      <Heading level={2} id="step-3">Step 3 — Set Environment Variables</Heading>
      <CodeBlock code={envVars} lang="bash" title=".env.local" />
      <Note>Never expose your <code className="text-orange-400">service_role</code> key on the client. Only use the <code className="text-orange-400">anon</code> key in browsers.</Note>

      <Heading level={2} id="step-4">Step 4 — Initialize the Client</Heading>
      <CodeBlock code={initClient} lang="typescript" title="lib/zendbx.ts" />

      <Heading level={2} id="step-5">Step 5 — Authentication</Heading>
      <CodeBlock code={signUp} lang="typescript" />

      <Heading level={2} id="step-6">Step 6 — Insert Data</Heading>
      <CodeBlock code={insert} lang="typescript" />

      <Heading level={2} id="step-7">Step 7 — Query Data</Heading>
      <CodeBlock code={query} lang="typescript" />

      <Heading level={2} id="step-8">Step 8 — Upload a File</Heading>
      <CodeBlock code={uploadFile} lang="typescript" />
      <Note>Buckets must be created first in the Dashboard → Storage → Buckets.</Note>

      <Heading level={2} id="step-9">Step 9 — Realtime Subscription</Heading>
      <CodeBlock code={realtime} lang="typescript" />

      <div className="mt-10 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <p className="text-sm font-semibold text-orange-400 mb-2">You're all set.</p>
        <p className="text-sm text-gray-400">
          Continue reading the <a href="/docs/database" className="text-orange-400 hover:underline">Database docs</a> for
          advanced querying, or the <a href="/docs/auth" className="text-orange-400 hover:underline">Auth docs</a> for
          OAuth and session management.
        </p>
      </div>
    </article>
  );
}
