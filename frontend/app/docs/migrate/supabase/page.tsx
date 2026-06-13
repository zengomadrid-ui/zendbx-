import { CodeBlock, Note, Heading } from '../../components';

export const metadata = { title: 'Migrate from Supabase — ZendBX Docs' };

const supabaseClient = `// Supabase
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);`;

const zendbxClient = `// ZendBX
import { createClient } from '@zendbx/sdk';
const db = createClient({
  apiUrl: ZENDBX_URL,
  anonKey: ZENDBX_ANON_KEY,
  projectSlug: 'my-project',
});`;

const authDiff = `// Supabase
const { data } = await supabase.auth.signInWithPassword({ email, password });

// ZendBX (identical API)
const { data } = await db.auth.signIn({ email, password });
// Also available: db.auth.signInWithPassword({ email, password })`;

const dbDiff = `// Supabase
const { data } = await supabase.from('todos').select('*').eq('done', false);

// ZendBX (identical API)
const { data } = await db.from('todos').select('*').eq('done', false);`;

const storageDiff = `// Supabase
await supabase.storage.from('avatars').upload('user.png', file);

// ZendBX  ← note: .bucket() not .from()
await db.storage.bucket('avatars').upload(file, 'user.png');`;

export default function MigrateSupabasePage() {
  return (
    <article>
      <Heading level={1}>Migrate from Supabase</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX is designed to be familiar to Supabase users. Most of the API is identical.
        Migration typically takes less than an hour.
      </p>

      <Heading level={2} id="client">Client Initialization</Heading>
      <CodeBlock code={supabaseClient} lang="typescript" title="Before (Supabase)" />
      <CodeBlock code={zendbxClient} lang="typescript" title="After (ZendBX)" />

      <Heading level={2} id="auth">Authentication</Heading>
      <CodeBlock code={authDiff} lang="typescript" />
      <Note>ZendBX auth is project-scoped. Each project has its own user table and JWT secret.</Note>

      <Heading level={2} id="database">Database</Heading>
      <CodeBlock code={dbDiff} lang="typescript" />
      <p className="text-sm text-gray-400 mt-2">The query builder is nearly identical. All filter methods work the same way.</p>

      <Heading level={2} id="storage">Storage</Heading>
      <CodeBlock code={storageDiff} lang="typescript" />
      <Note type="warning">
        The main difference: ZendBX uses <code className="text-orange-400">.bucket(slug)</code> instead of <code className="text-orange-400">.from(bucket)</code>.
        Upload argument order also differs: ZendBX takes <code className="text-orange-400">(file, filename)</code> instead of <code className="text-orange-400">(path, file)</code>.
      </Note>

      <Heading level={2} id="checklist">Migration Checklist</Heading>
      <ul className="space-y-2 text-sm text-gray-400">
        {[
          'Replace @supabase/supabase-js with @zendbx/sdk',
          'Update createClient() call to use options object with projectSlug',
          'Replace .storage.from() with .storage.bucket()',
          'Update upload() call argument order',
          'Move environment variables from SUPABASE_* to ZENDBX_*',
          'Create an equivalent project in the ZendBX dashboard',
          'Run any existing SQL migrations against the new project schema',
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-orange-500 flex-shrink-0">□</span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
