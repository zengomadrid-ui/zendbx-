import { CodeBlock, Note, Heading, ParamTable } from '../components';

export const metadata = { title: 'Database — ZendBX Docs' };

const schemaQuery = `-- ZendBX creates a schema for each project
-- Your tables live in: <project_slug> schema

-- Example: zenhire project
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'zenhire';`;

const rlsExample = `-- Enable RLS on a table
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own todos
CREATE POLICY "Users see own todos"
ON todos FOR SELECT
USING (auth.uid() = user_id);

-- Policy: users can insert their own todos
CREATE POLICY "Users insert own todos"
ON todos FOR INSERT
WITH CHECK (auth.uid() = user_id);`;

const crud = `import { createClient } from '@zendbx/sdk';
const db = createClient({ apiUrl, anonKey, projectSlug });

// CREATE
const { data: newRow, error } = await db.from('jobs').insert({
  title: 'Senior Engineer',
  company: 'Acme Corp',
  salary: 120000,
});

// READ
const { data: jobs } = await db
  .from('jobs')
  .select('id, title, company, salary')
  .eq('status', 'active')
  .order('salary', { ascending: false })
  .limit(10);

// UPDATE
const { data: updated } = await db
  .from('jobs')
  .update({ status: 'closed' })
  .eq('id', 'job-uuid');

// DELETE
await db.from('jobs').delete().eq('id', 'job-uuid');`;

const pagination = `// Offset pagination
const { data } = await db
  .from('jobs')
  .select('*')
  .range(0, 19);   // rows 0-19 (first page of 20)

const { data: page2 } = await db
  .from('jobs')
  .select('*')
  .range(20, 39);  // rows 20-39 (second page)

// Cursor pagination (more efficient for large tables)
const { data } = await db
  .from('jobs')
  .select('*')
  .lt('created_at', lastSeenDate)
  .order('created_at', { ascending: false })
  .limit(20);`;

const schemaQualified = `// Access tables in a specific schema
// Use dot notation in the table name

const { data } = await db
  .from('zenhire.resumes')
  .select('*')
  .eq('user_id', userId);`;

const curlInsert = `curl -X POST https://api.zendbx.in/rest/v1/jobs \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_USER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Engineer","company":"Acme","salary":100000}'`;

const curlSelect = `curl "https://api.zendbx.in/rest/v1/jobs?status=eq.active&limit=10&order=salary.desc" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_USER_TOKEN"`;

export default function DatabasePage() {
  return (
    <article>
      <Heading level={1}>Database</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX gives every project its own isolated PostgreSQL schema. Full SQL power with
        a fluent TypeScript query builder on top.
      </p>

      <Heading level={2} id="schemas">Schemas</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Each project gets a dedicated PostgreSQL schema named after the project slug.
        Tables in <code className="text-orange-400">zenhire</code> project live under the <code className="text-orange-400">zenhire</code> schema.
        This ensures complete data isolation between projects on the same database server.
      </p>
      <CodeBlock code={schemaQuery} lang="sql" />

      <Heading level={2} id="crud">CRUD Operations</Heading>
      <CodeBlock code={crud} lang="typescript" />

      <Heading level={2} id="filters">Filters</Heading>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Method</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">SQL equivalent</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Example</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            {[
              ['.eq(col, val)', 'col = val', ".eq('status', 'active')"],
              ['.neq(col, val)', 'col != val', ".neq('role', 'admin')"],
              ['.gt(col, val)', 'col > val', '.gt(\'salary\', 50000)'],
              ['.gte(col, val)', 'col >= val', '.gte(\'score\', 90)'],
              ['.lt(col, val)', 'col < val', ".lt('age', 30)"],
              ['.lte(col, val)', 'col <= val', ".lte('price', 100)"],
              ['.like(col, pat)', 'col LIKE pat', ".like('name', '%john%')"],
              ['.ilike(col, pat)', 'col ILIKE pat', ".ilike('email', '%@gmail%')"],
              ['.is(col, null)', 'col IS NULL', ".is('deleted_at', null)"],
              ['.order(col, opts)', 'ORDER BY col', ".order('created_at', { ascending: false })"],
              ['.limit(n)', 'LIMIT n', '.limit(20)'],
              ['.range(from, to)', 'OFFSET / LIMIT', '.range(0, 19)'],
            ].map(([m, s, e]) => (
              <tr key={m} className="border-b border-zinc-900">
                <td className="py-2 px-3 font-mono text-orange-300 text-xs">{m}</td>
                <td className="py-2 px-3 font-mono text-blue-400 text-xs">{s}</td>
                <td className="py-2 px-3 text-xs">{e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Heading level={2} id="pagination">Pagination</Heading>
      <CodeBlock code={pagination} lang="typescript" />

      <Heading level={2} id="schema-qualified">Schema-Qualified Tables</Heading>
      <p className="text-sm text-gray-400 mb-3">
        When calling REST endpoints directly, use dot notation to target tables in a specific schema.
        The SDK handles this automatically based on your project slug.
      </p>
      <CodeBlock code={schemaQualified} lang="typescript" />
      <Note>
        The REST API also accepts dot notation: <code className="text-orange-400">POST /rest/v1/zenhire.resumes</code>.
        This inserts a row into the <code className="text-orange-400">resumes</code> table in the <code className="text-orange-400">zenhire</code> schema.
      </Note>

      <Heading level={2} id="rls">Row Level Security</Heading>
      <p className="text-sm text-gray-400 mb-3">
        ZendBX enforces PostgreSQL RLS by default. Every query runs with the user's identity set
        via <code className="text-orange-400">SET app.current_user_id</code>. Your policies decide what each user can access.
      </p>
      <CodeBlock code={rlsExample} lang="sql" />
      <Note type="warning">
        The <code className="text-orange-400">service_role</code> key bypasses RLS entirely.
        Never expose it in the browser.
      </Note>

      <Heading level={2} id="rest-examples">REST API Examples</Heading>
      <CodeBlock code={curlInsert} lang="bash" title="INSERT via cURL" />
      <CodeBlock code={curlSelect} lang="bash" title="SELECT via cURL" />
    </article>
  );
}
