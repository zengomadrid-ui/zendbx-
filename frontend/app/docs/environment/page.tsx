import { CodeBlock, Note, Heading } from '../components';

export const metadata = { title: 'Environment Variables — ZendBX Docs' };

const reactVite = `# .env.local
VITE_ZENDBX_URL=https://api.zendbx.in
VITE_ZENDBX_PROJECT_ID=your-project-id-uuid
VITE_ZENDBX_PROJECT_SLUG=your-project-slug
VITE_ZENDBX_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

const nextjs = `# .env.local
NEXT_PUBLIC_ZENDBX_URL=https://api.zendbx.in
NEXT_PUBLIC_ZENDBX_PROJECT_ID=your-project-id-uuid
NEXT_PUBLIC_ZENDBX_PROJECT_SLUG=your-project-slug
NEXT_PUBLIC_ZENDBX_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side only (NO NEXT_PUBLIC_ prefix)
ZENDBX_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

const node = `# .env
ZENDBX_URL=https://api.zendbx.in
ZENDBX_PROJECT_ID=your-project-id-uuid
ZENDBX_PROJECT_SLUG=your-project-slug
ZENDBX_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ZENDBX_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

const svelte = `# .env
PUBLIC_ZENDBX_URL=https://api.zendbx.in
PUBLIC_ZENDBX_PROJECT_ID=your-project-id-uuid
PUBLIC_ZENDBX_PROJECT_SLUG=your-project-slug
PUBLIC_ZENDBX_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side only (NO PUBLIC_ prefix)
ZENDBX_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

const vue = `# .env.local
VITE_ZENDBX_URL=https://api.zendbx.in
VITE_ZENDBX_PROJECT_ID=your-project-id-uuid
VITE_ZENDBX_PROJECT_SLUG=your-project-slug
VITE_ZENDBX_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`;

const angular = `// environment.ts
export const environment = {
  production: false,
  zendbx: {
    url: 'https://api.zendbx.in',
    projectId: 'your-project-id-uuid',
    projectSlug: 'your-project-slug',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
};`;

const docker = `# docker-compose.yml
services:
  app:
    environment:
      - ZENDBX_URL=https://api.zendbx.in
      - ZENDBX_PROJECT_ID=\${ZENDBX_PROJECT_ID}
      - ZENDBX_SERVICE_KEY=\${ZENDBX_SERVICE_KEY}
    env_file:
      - .env`;

const vercel = `# Add these in Vercel Dashboard → Settings → Environment Variables
NEXT_PUBLIC_ZENDBX_URL=https://api.zendbx.in
NEXT_PUBLIC_ZENDBX_PROJECT_ID=your-project-id
NEXT_PUBLIC_ZENDBX_ANON_KEY=your-anon-key
ZENDBX_SERVICE_KEY=your-service-key`;

const netlify = `# netlify.toml
[build.environment]
  VITE_ZENDBX_URL = "https://api.zendbx.in"
  VITE_ZENDBX_PROJECT_ID = "your-project-id"
  VITE_ZENDBX_ANON_KEY = "your-anon-key"`;

export default function EnvironmentPage() {
  return (
    <article>
      <Heading level={1}>Environment Variables</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Configuration guide for all frameworks and deployment platforms.
      </p>

      <Heading level={2} id="required">Required Variables</Heading>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Variable</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Description</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Example</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            <tr className="border-b border-zinc-900">
              <td className="py-2 px-3 font-mono text-orange-300 text-xs">ZENDBX_URL</td>
              <td className="py-2 px-3 text-xs">Your ZendBX backend URL</td>
              <td className="py-2 px-3 text-xs">https://api.zendbx.in</td>
            </tr>
            <tr className="border-b border-zinc-900">
              <td className="py-2 px-3 font-mono text-orange-300 text-xs">ZENDBX_PROJECT_ID</td>
              <td className="py-2 px-3 text-xs">Your project UUID</td>
              <td className="py-2 px-3 text-xs">550e8400-e29b-41d4-a716...</td>
            </tr>
            <tr className="border-b border-zinc-900">
              <td className="py-2 px-3 font-mono text-orange-300 text-xs">ZENDBX_PROJECT_SLUG</td>
              <td className="py-2 px-3 text-xs">Human-readable project identifier</td>
              <td className="py-2 px-3 text-xs">my-app</td>
            </tr>
            <tr className="border-b border-zinc-900">
              <td className="py-2 px-3 font-mono text-orange-300 text-xs">ZENDBX_ANON_KEY</td>
              <td className="py-2 px-3 text-xs">Public API key (client-safe)</td>
              <td className="py-2 px-3 text-xs">eyJhbGciOiJIUzI1NiIs...</td>
            </tr>
            <tr className="border-b border-zinc-900">
              <td className="py-2 px-3 font-mono text-orange-300 text-xs">ZENDBX_SERVICE_KEY</td>
              <td className="py-2 px-3 text-xs">Private API key (server-only)</td>
              <td className="py-2 px-3 text-xs">eyJhbGciOiJIUzI1NiIs...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Note type="warning">
        <strong>Security:</strong> Never commit <code className="text-orange-400">.env</code> files to version control.
        Add them to <code className="text-orange-400">.gitignore</code>. Never expose the service key in client-side code.
      </Note>

      <Heading level={2} id="frameworks">Framework-Specific Setup</Heading>

      <Heading level={3} id="react">React + Vite</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Vite exposes variables prefixed with <code className="text-orange-400">VITE_</code> to the client.
      </p>
      <CodeBlock code={reactVite} lang="bash" />
      <CodeBlock code={`import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: import.meta.env.VITE_ZENDBX_URL,
  projectId: import.meta.env.VITE_ZENDBX_PROJECT_ID,
  anonKey: import.meta.env.VITE_ZENDBX_ANON_KEY,
})`} lang="typescript" />

      <Heading level={3} id="nextjs">Next.js</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Use <code className="text-orange-400">NEXT_PUBLIC_</code> prefix for client-side variables. Server-side variables don't need the prefix.
      </p>
      <CodeBlock code={nextjs} lang="bash" />
      <CodeBlock code={`// Client component
export const zendbx = createClient({
  apiUrl: process.env.NEXT_PUBLIC_ZENDBX_URL!,
  projectId: process.env.NEXT_PUBLIC_ZENDBX_PROJECT_ID!,
  anonKey: process.env.NEXT_PUBLIC_ZENDBX_ANON_KEY!,
})

// Server action
const serverClient = createClient({
  apiUrl: process.env.NEXT_PUBLIC_ZENDBX_URL!,
  projectId: process.env.NEXT_PUBLIC_ZENDBX_PROJECT_ID!,
  anonKey: process.env.ZENDBX_SERVICE_KEY!, // Server-side key
})`} lang="typescript" />

      <Heading level={3} id="vue">Vue 3 + Vite</Heading>
      <CodeBlock code={vue} lang="bash" />

      <Heading level={3} id="svelte">SvelteKit</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Use <code className="text-orange-400">PUBLIC_</code> prefix for client-exposed variables.
      </p>
      <CodeBlock code={svelte} lang="bash" />

      <Heading level={3} id="node">Node.js / Express</Heading>
      <CodeBlock code={node} lang="bash" />
      <p className="text-sm text-gray-400 mt-2">
        Install <code className="text-orange-400">dotenv</code> and load at app start:
      </p>
      <CodeBlock code={`import 'dotenv/config'
import { createClient } from '@zendbx/sdk'

export const zendbx = createClient({
  apiUrl: process.env.ZENDBX_URL,
  projectId: process.env.ZENDBX_PROJECT_ID,
  anonKey: process.env.ZENDBX_SERVICE_KEY,
})`} lang="javascript" />

      <Heading level={3} id="angular">Angular</Heading>
      <CodeBlock code={angular} lang="typescript" />

      <Heading level={2} id="deployment">Deployment Platforms</Heading>

      <Heading level={3} id="vercel">Vercel</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Add environment variables in the Vercel Dashboard → Settings → Environment Variables.
      </p>
      <CodeBlock code={vercel} lang="bash" />

      <Heading level={3} id="netlify">Netlify</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Add to <code className="text-orange-400">netlify.toml</code> or set in Netlify Dashboard → Site settings → Environment variables.
      </p>
      <CodeBlock code={netlify} lang="toml" />

      <Heading level={3} id="docker">Docker</Heading>
      <CodeBlock code={docker} lang="yaml" />

      <Heading level={2} id="best-practices">Best Practices</Heading>
      <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside mb-6">
        <li><strong className="text-white">Never commit secrets</strong> — Add <code className="text-orange-400">.env*</code> to <code className="text-orange-400">.gitignore</code></li>
        <li><strong className="text-white">Use different keys per environment</strong> — Separate development, staging, and production</li>
        <li><strong className="text-white">Rotate keys regularly</strong> — Generate new keys every 90 days from the dashboard</li>
        <li><strong className="text-white">Service keys are server-only</strong> — Never expose them in client bundles</li>
        <li><strong className="text-white">Use environment-specific URLs</strong> — Point to staging backend during development</li>
      </ul>

      <Heading level={2} id="validation">Validate Configuration</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Check that all required variables are set:
      </p>
      <CodeBlock code={`const config = {
  url: process.env.ZENDBX_URL,
  projectId: process.env.ZENDBX_PROJECT_ID,
  anonKey: process.env.ZENDBX_ANON_KEY,
}

for (const [key, value] of Object.entries(config)) {
  if (!value) {
    throw new Error(\`Missing required env var: \${key}\`)
  }
}

console.log('✓ All environment variables configured')`} lang="typescript" />

      <div className="mt-10 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <p className="text-sm font-semibold text-orange-400 mb-2">Where to find your credentials</p>
        <p className="text-sm text-gray-400">
          Log in to <a href="https://devapp.zendbx.in" className="text-orange-400 hover:underline">devapp.zendbx.in</a> →
          Select your project → <strong>Settings → API Keys</strong>
        </p>
      </div>
    </article>
  );
}
