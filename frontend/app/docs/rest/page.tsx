import { CodeBlock, Note, Heading, Badge } from '../components';

export const metadata = { title: 'REST API — ZendBX Docs' };

const headers = `Authorization: Bearer <user-token>   # Authenticated user JWT
apikey: <anon-key>                    # Project anon key (identifies the project)
Content-Type: application/json        # Required for POST/PATCH`;

const selectAll = `GET /rest/v1/todos
Authorization: Bearer <token>
apikey: <anon-key>`;

const selectFilter = `GET /rest/v1/todos?status=eq.active&limit=20&order=created_at.desc
Authorization: Bearer <token>
apikey: <anon-key>`;

const insertRow = `POST /rest/v1/todos
Authorization: Bearer <token>
apikey: <anon-key>
Content-Type: application/json

{
  "title": "Buy groceries",
  "done": false
}`;

const patchRow = `PATCH /rest/v1/todos?id=eq.some-uuid
Authorization: Bearer <token>
apikey: <anon-key>
Content-Type: application/json

{
  "done": true
}`;

const deleteRow = `DELETE /rest/v1/todos?id=eq.some-uuid
Authorization: Bearer <token>
apikey: <anon-key>`;

const schemaTable = `# Dot notation for schema-qualified tables
POST /rest/v1/zenhire.resumes
Authorization: Bearer <token>
apikey: <anon-key>
Content-Type: application/json

{
  "user_id": "uuid",
  "filename": "resume.pdf",
  "score": 85
}`;

const projectScoped = `# REST under /p/{slug}/ — for Supabase-compatible SDK usage
POST /p/my-project/rest/v1/todos
Authorization: Bearer <token>
apikey: <anon-key>
Content-Type: application/json

{ "title": "Task", "done": false }`;

const curlFull = `curl -X POST https://api.zendbx.in/rest/v1/todos \\
  -H "Authorization: Bearer eyJhbGci..." \\
  -H "apikey: your-anon-key" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Hello ZendBX","done":false}'`;

const filterOps = `# Available filter operators:
?column=eq.value         # column = value
?column=neq.value        # column != value
?column=gt.value         # column > value
?column=gte.value        # column >= value
?column=lt.value         # column < value
?column=lte.value        # column <= value
?column=like.*pattern*   # column LIKE '%pattern%'
?column=ilike.*pattern*  # column ILIKE '%pattern%' (case-insensitive)
?column=is.null          # column IS NULL
?column=is.not.null      # column IS NOT NULL

# Pagination
?limit=20&offset=0

# Ordering
?order=created_at.desc
?order=salary.asc`;

export default function RestPage() {
  return (
    <article>
      <Heading level={1}>REST API</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX exposes a universal REST API for every table. No manual endpoint creation required.
        Supports Supabase-compatible query parameters.
      </p>

      <Heading level={2} id="base-url">Base URL</Heading>
      <CodeBlock code={`https://api.zendbx.in`} lang="text" />

      <Heading level={2} id="authentication">Authentication</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Every request needs two headers:
      </p>
      <CodeBlock code={headers} lang="http" />
      <Note>
        The <code className="text-orange-400">apikey</code> header identifies your project.
        The <code className="text-orange-400">Authorization</code> header authenticates the user.
        Both are required for protected endpoints.
      </Note>

      <Heading level={2} id="endpoints">CRUD Endpoints</Heading>

      <div className="space-y-6">
        {[
          { method: 'GET', badge: 'green', label: 'Select rows', code: selectAll },
          { method: 'GET', badge: 'green', label: 'Select with filters', code: selectFilter },
          { method: 'POST', badge: 'orange', label: 'Insert a row', code: insertRow },
          { method: 'PATCH', badge: 'blue', label: 'Update a row', code: patchRow },
          { method: 'DELETE', badge: 'red', label: 'Delete a row', code: deleteRow },
        ].map((e) => (
          <div key={e.label}>
            <div className="flex items-center gap-2 mb-2">
              <Badge color={e.badge as 'green' | 'orange' | 'blue' | 'red'}>{e.method}</Badge>
              <span className="text-sm text-gray-300">{e.label}</span>
            </div>
            <CodeBlock code={e.code} lang="http" />
          </div>
        ))}
      </div>

      <Heading level={2} id="schema-tables">Schema-Qualified Tables</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Target tables in a specific schema using dot notation.
        <code className="text-orange-400 mx-1">zenhire.resumes</code> → table <code className="text-orange-400">resumes</code> in schema <code className="text-orange-400">zenhire</code>.
      </p>
      <CodeBlock code={schemaTable} lang="http" />
      <Note type="warning">
        Previously, a bug caused POST requests to schema-qualified tables to attempt DDL (CREATE TABLE).
        This is fixed in the current version — POST always executes INSERT only.
      </Note>

      <Heading level={2} id="project-scoped">Project-Scoped Routes</Heading>
      <p className="text-sm text-gray-400 mb-3">
        For Supabase SDK compatibility, REST endpoints are also available under <code className="text-orange-400">/p/{'{'}slug{'}'}/</code>:
      </p>
      <CodeBlock code={projectScoped} lang="http" />

      <Heading level={2} id="filters">Filter Reference</Heading>
      <CodeBlock code={filterOps} lang="bash" />

      <Heading level={2} id="full-example">Full cURL Example</Heading>
      <CodeBlock code={curlFull} lang="bash" />

      <Heading level={2} id="status-codes">Status Codes</Heading>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Code</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-orange-400">Meaning</th>
            </tr>
          </thead>
          <tbody className="text-gray-400">
            {[
              ['200', 'Success — data returned'],
              ['201', 'Created — row inserted'],
              ['400', 'Bad request — malformed body or missing filter'],
              ['401', 'Unauthorized — missing or invalid token'],
              ['403', 'Forbidden — RLS policy blocked the operation'],
              ['404', 'Not found — row or resource does not exist'],
              ['409', 'Conflict — unique constraint violation'],
              ['500', 'Server error — check the detail field in the response'],
            ].map(([code, msg]) => (
              <tr key={code} className="border-b border-zinc-900">
                <td className="py-2 px-3 font-mono text-orange-300">{code}</td>
                <td className="py-2 px-3">{msg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Heading level={2} id="error-format">Error Response Format</Heading>
      <CodeBlock code={`{
  "detail": {
    "message": "null value in column \\"user_id\\" violates not-null constraint",
    "sqlstate": "23502",
    "detail": "Failing row contains (null, ...).",
    "hint": null,
    "constraint": null,
    "column": "user_id"
  }
}`} lang="json" />
    </article>
  );
}
