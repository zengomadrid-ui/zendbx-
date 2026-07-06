import { CodeBlock, Note, Heading, Tabs } from '../components';

export const metadata = { title: 'Installation — ZendBX Docs' };

const npmInstall = `npm install @zendbx/sdk`;
const yarnInstall = `yarn add @zendbx/sdk`;
const pnpmInstall = `pnpm add @zendbx/sdk`;
const bunInstall = `bun add @zendbx/sdk`;

const reactEnv = `# .env.local
VITE_ZENDBX_URL=https://api.zendbx.in
VITE_ZENDBX_PROJECT_ID=your-project-id
VITE_ZENDBX_ANON_KEY=your-anon-key`;

const nextjsEnv = `# .env.local
NEXT_PUBLIC_ZENDBX_URL=https://api.zendbx.in
NEXT_PUBLIC_ZENDBX_PROJECT_ID=your-project-id
NEXT_PUBLIC_ZENDBX_ANON_KEY=your-anon-key`;

const nodeEnv = `# .env
ZENDBX_URL=https://api.zendbx.in
ZENDBX_PROJECT_ID=your-project-id
ZENDBX_SERVICE_KEY=your-service-key`;

const reactSetup = `// src/lib/zendbx.ts
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: import.meta.env.VITE_ZENDBX_URL,
  projectId: import.meta.env.VITE_ZENDBX_PROJECT_ID,
  anonKey: import.meta.env.VITE_ZENDBX_ANON_KEY,
})`;

const nextjsSetup = `// lib/zendbx.ts
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: process.env.NEXT_PUBLIC_ZENDBX_URL!,
  projectId: process.env.NEXT_PUBLIC_ZENDBX_PROJECT_ID!,
  anonKey: process.env.NEXT_PUBLIC_ZENDBX_ANON_KEY!,
})`;

const nodeSetup = `// lib/zendbx.js
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: process.env.ZENDBX_URL,
  projectId: process.env.ZENDBX_PROJECT_ID,
  anonKey: process.env.ZENDBX_SERVICE_KEY, // Use service key on server
})`;

const vueSetup = `// src/lib/zendbx.ts
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: import.meta.env.VITE_ZENDBX_URL,
  projectId: import.meta.env.VITE_ZENDBX_PROJECT_ID,
  anonKey: import.meta.env.VITE_ZENDBX_ANON_KEY,
})`;

const svelteSetup = `// src/lib/zendbx.ts
import { createClient } from '@zendbx/sdk'
import { PUBLIC_ZENDBX_URL, PUBLIC_ZENDBX_PROJECT_ID, PUBLIC_ZENDBX_ANON_KEY } from '$env/static/public'

export const zendbx = createClient({
  apiUrl: PUBLIC_ZENDBX_URL,
  projectId: PUBLIC_ZENDBX_PROJECT_ID,
  anonKey: PUBLIC_ZENDBX_ANON_KEY,
})`;

export default function InstallationPage() {
  return (
    <article>
      <Heading level={1}>Installation</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Install the ZendBX SDK in your project. Works with React, Next.js, Vue, Svelte, Node.js, and any modern JavaScript environment.
      </p>

      <Heading level={2} id="requirements">Requirements</Heading>
      <ul className="text-sm text-gray-400 space-y-1 mb-6 list-disc list-inside">
        <li>Node.js 18+ or Bun 1.0+</li>
        <li>A ZendBX account (sign up at <a href="https://devapp.zendbx.in" className="text-orange-400 hover:underline">devapp.zendbx.in</a>)</li>
        <li>A project created in your dashboard</li>
      </ul>

      <Heading level={2} id="install">Install the SDK</Heading>
      <Tabs tabs={['npm', 'Yarn', 'pnpm', 'Bun']}>
        <CodeBlock code={npmInstall} lang="bash" />
        <CodeBlock code={yarnInstall} lang="bash" />
        <CodeBlock code={pnpmInstall} lang="bash" />
        <CodeBlock code={bunInstall} lang="bash" />
      </Tabs>

      <Heading level={2} id="get-credentials">Get Your Credentials</Heading>
      <p className="text-sm text-gray-400 mb-3">
        From your ZendBX dashboard:
      </p>
      <ol className="text-sm text-gray-400 space-y-2 mb-6 list-decimal list-inside">
        <li>Go to <strong className="text-white">Project Settings → API Keys</strong></li>
        <li>Copy your <strong className="text-white">Project URL</strong> (e.g., https://api.zendbx.in)</li>
        <li>Copy your <strong className="text-white">Project ID</strong> (UUID format)</li>
        <li>Copy your <strong className="text-white">Anon Key</strong> (public API key)</li>
        <li>Copy your <strong className="text-white">Service Key</strong> (private, server-only)</li>
      </ol>

      <Note type="warning">
        Never expose your <code className="text-orange-400">service_role</code> key in client-side code.
        Use the <code className="text-orange-400">anon</code> key for browsers and the service key only on servers.
      </Note>

      <Heading level={2} id="setup">Framework Setup</Heading>

      <Heading level={3} id="react-vite">React + Vite</Heading>
      <CodeBlock code={reactEnv} lang="bash" title="Environment variables" />
      <CodeBlock code={reactSetup} lang="typescript" title="Client setup" />

      <Heading level={3} id="nextjs">Next.js</Heading>
      <CodeBlock code={nextjsEnv} lang="bash" title="Environment variables" />
      <CodeBlock code={nextjsSetup} lang="typescript" title="Client setup" />
      <Note>
        In Next.js, prefix client-side env vars with <code className="text-orange-400">NEXT_PUBLIC_</code>.
        Server-side variables don't need the prefix.
      </Note>

      <Heading level={3} id="vue">Vue 3 + Vite</Heading>
      <CodeBlock code={reactEnv} lang="bash" title="Environment variables" />
      <CodeBlock code={vueSetup} lang="typescript" title="Client setup" />

      <Heading level={3} id="svelte">SvelteKit</Heading>
      <p className="text-sm text-gray-400 mb-3">
        In SvelteKit, create <code className="text-orange-400">.env</code> with public variables:
      </p>
      <CodeBlock code={`PUBLIC_ZENDBX_URL=https://api.zendbx.in
PUBLIC_ZENDBX_PROJECT_ID=your-project-id
PUBLIC_ZENDBX_ANON_KEY=your-anon-key`} lang="bash" />
      <CodeBlock code={svelteSetup} lang="typescript" title="Client setup" />

      <Heading level={3} id="nodejs">Node.js / Express</Heading>
      <CodeBlock code={nodeEnv} lang="bash" title="Environment variables" />
      <CodeBlock code={nodeSetup} lang="javascript" title="Client setup" />
      <Note>
        On the server, use the <code className="text-orange-400">service_role</code> key to bypass RLS.
        Install <code className="text-orange-400">dotenv</code> and call <code className="text-orange-400">require('dotenv').config()</code> at the top of your entry file.
      </Note>

      <Heading level={2} id="verify">Verify Installation</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Test your setup with a simple query:
      </p>
      <CodeBlock code={`import { zendbx } from './lib/zendbx'

// Test connection
const { data, error } = await zendbx.from('_test').select('*').limit(1)

if (error) {
  console.error('Connection failed:', error.message)
} else {
  console.log('Connected successfully!')
}`} lang="typescript" />

      <Heading level={2} id="typescript">TypeScript Support</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The SDK is written in TypeScript and includes full type definitions. No additional setup required.
      </p>
      <CodeBlock code={`interface User {
  id: string
  email: string
  name: string
  created_at: string
}

const { data } = await zendbx.from<User>('users').select('*')
// data is typed as User[] | null`} lang="typescript" />

      <Heading level={2} id="cdn">CDN Usage (Browser)</Heading>
      <p className="text-sm text-gray-400 mb-3">
        For quick prototyping, load the SDK from a CDN:
      </p>
      <CodeBlock code={`<script type="module">
  import { createClient } from 'https://esm.sh/@zendbx/sdk@latest'
  
  const db = createClient({
    apiUrl: 'https://api.zendbx.in',
    projectId: 'your-project-id',
    anonKey: 'your-anon-key'
  })
  
  const { data } = await db.from('users').select('*')
  console.log(data)
</script>`} lang="html" />

      <div className="mt-10 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <p className="text-sm font-semibold text-orange-400 mb-2">Next Steps</p>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li><a href="/docs/quickstart" className="text-orange-400 hover:underline">Follow the Quick Start guide</a></li>
          <li><a href="/docs/auth" className="text-orange-400 hover:underline">Set up authentication</a></li>
          <li><a href="/docs/database" className="text-orange-400 hover:underline">Learn about database queries</a></li>
        </ul>
      </div>
    </article>
  );
}
