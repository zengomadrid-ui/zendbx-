import { CodeBlock, Note, Heading, ParamTable, Badge, Tabs } from '../components';

export const metadata = { title: 'SDK Reference — ZendBX Docs' };

const install = `npm install @zendbx/sdk`;

const createClientBasic = `import { createClient } from '@zendbx/sdk';

const client = createClient({
  apiUrl: 'https://api.zendbx.in',
  projectSlug: 'my-project',
  anonKey: 'your-anon-key',
});`;

const createClientAdvanced = `const client = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  projectSlug: 'my-project',
  anonKey: process.env.ZENDBX_ANON_KEY!,
  accessToken: 'user-jwt-token',  // Optional: for authenticated requests
  autoRefreshToken: true,         // Optional: auto-refresh expired tokens
});`;

const signUp = `const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password-123',
  name: 'John Doe',  // optional
});

if (error) {
  console.error('Sign up failed:', error.message);
} else {
  console.log('User created:', data.user);
  console.log('Access token:', data.access_token);
}

// Response Type:
// interface AuthResponse {
//   access_token: string;
//   user: User;
// }`;

const signIn = `const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'secure-password-123',
});

// Token is automatically stored in the client
console.log('Logged in:', data.user.email);`;

const getUser = `const user = await client.auth.getUser();
console.log('Current user:', user.email);`;

const getSession = `const token = client.auth.getSession();
console.log('Current token:', token);`;

const setSession = `// Useful for SSR or when restoring a session
client.auth.setSession('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');`;

const signOut = `await client.auth.signOut();
// Token is cleared from the client`;

const refreshSession = `const { data } = await client.auth.refreshSession();
console.log('New token:', data.access_token);`;

const passwordReset = `// Request password reset
await client.auth.resetPasswordForEmail('user@example.com');
// User receives email with reset token

// Update password with token
await client.auth.updatePassword('reset-token-from-email', 'new-password');`;

const emailVerification = `await client.auth.verifyEmail('verification-token-from-email');`;

const updateUser = `const user = await client.auth.updateUser({
  name: 'Jane Doe',
  email: 'jane@example.com'
});`;

const fromSelect = `// Select all columns
const { data, error } = await client.from('users').select('*');

// Select specific columns
const { data } = await client.from('users').select('id, name, email');

// With TypeScript types
interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

const { data } = await client.from<User>('users').select('*');
// data is User[] | null with full autocomplete`;

const selectWithCount = `// Get total count with results
const { data, count } = await client.from('users')
  .select('*', { count: 'exact' });

console.log(\`Found \${count} users\`);

// Count Types:
// 'exact' - Precise count (slower on large tables)
// 'planned' - Estimate from query planner
// 'estimated' - Fast estimate from statistics`;

const filters = `// Equality
.eq('status', 'active')
.neq('role', 'admin')

// Comparison
.gt('age', 18)
.gte('score', 90)
.lt('price', 100)
.lte('stock', 10)

// String matching
.like('email', '%@gmail.com')
.ilike('name', '%john%')  // case-insensitive

// Array/NULL checks
.in('status', ['active', 'pending'])
.is('deleted_at', null)

// Negation
.not('status', 'eq', 'deleted')

// OR conditions (PostgREST syntax)
.or('status.eq.active,status.eq.pending')

// Chaining filters (AND logic)
const { data } = await client.from('users')
  .select('*')
  .eq('country', 'India')
  .gt('age', 18)
  .like('email', '%@gmail.com')
  .is('verified', true);`;

const insert = `// Single row insert
const { data, error } = await client.from('users').insert({
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active'
});

// Insert returns empty array by default
// Chain .select() to return the inserted row
const { data } = await client.from('users')
  .insert({ name: 'John' })
  .select();

console.log('Inserted user:', data[0]);`;

const bulkInsert = `// Multiple rows (homogeneous)
const { data, error } = await client.from('users').insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Carol', email: 'carol@example.com' }
]).select();

console.log(\`Inserted \${data.length} users\`);

// Heterogeneous bulk insert (different columns per row)
const { data } = await client.from('products').insert([
  { name: 'Widget', price: 19.99, sku: 'WDG-001' },
  { name: 'Gadget', price: 29.99 }, // no SKU
  { name: 'Doohickey' } // no price or SKU
]).select();

// IMPORTANT: Bulk inserts are atomic - all rows insert or none do`;

const update = `// Update with filter
const { data, error } = await client.from('users')
  .update({ status: 'inactive' })
  .eq('id', '123');

// Update multiple rows
await client.from('users')
  .update({ verified: true })
  .gt('created_at', '2024-01-01');

// Update and return updated rows
const { data } = await client.from('users')
  .update({ email: 'newemail@example.com' })
  .eq('id', '123')
  .select();`;

const del = `// Delete with filter
await client.from('users').delete().eq('id', '123');

// Delete multiple rows
await client.from('logs')
  .delete()
  .lt('created_at', '2024-01-01');

// Delete with multiple conditions
await client.from('users')
  .delete()
  .eq('status', 'inactive')
  .lt('last_login', '2023-01-01');`;

const storageUpload = `const bucket = db.storage.bucket('avatars');

// Multiple order clauses
const { data } = await client.from('products')
  .select('*')
  .order('category')
  .order('price', { ascending: false });`;

const pagination = `// Limit
const { data } = await client.from('users')
  .select('*')
  .limit(20);

// Range (offset + limit)
// Get rows 0-19 (page 1)
const { data } = await client.from('users')
  .select('*')
  .range(0, 19);

// Get rows 20-39 (page 2)
const { data } = await client.from('users')
  .select('*')
  .range(20, 39);

// Pagination example
const pageSize = 20;
const page = 2;  // 0-indexed

const { data, count } = await client.from('users')
  .select('*', { count: 'exact' })
  .range(page * pageSize, (page + 1) * pageSize - 1);

console.log(\`Page \${page + 1} of \${Math.ceil(count / pageSize)}\`);`;

const singleRow = `// .single() - Returns a single object instead of an array
// Throws error if 0 or multiple rows found
const { data, error } = await client.from('users')
  .select('*')
  .eq('id', '123')
  .single();
// data is User | null (not User[] | null)

// .maybeSingle() - Like single() but returns null instead of error when no rows found
const { data } = await client.from('users')
  .select('*')
  .eq('email', 'john@example.com')
  .maybeSingle();
// data is User | null, error is null even if no rows found`;

const storageList = `const { data: buckets } = await client.storage.listBuckets();`;

const storageCreate = `const { data } = await client.storage.createBucket('avatars', { 
  public: true 
});`;

const storageUpload = `const file = document.getElementById('file-input').files[0];

const { data, error } = await client.storage
  .from('avatars')
  .upload('user-123/profile.jpg', file, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: true  // Overwrite if exists
  });`;

const storageDownload = `const { data: blob } = await client.storage
  .from('avatars')
  .download('user-123/profile.jpg');

// Create download URL
const url = URL.createObjectURL(blob);`;

const storagePublicUrl = `const { data } = client.storage
  .from('avatars')
  .getPublicUrl('user-123/profile.jpg');

console.log(data.publicUrl);
// https://api.zendbx.in/p/my-project/v1/storage/buckets/avatars/files/user-123/profile.jpg`;

const signedUrl = `const { data } = await client.storage
  .from('documents')
  .createSignedUrl('contract.pdf', 3600); // 1 hour

console.log(data.signedUrl);`;

const storageDelete = `await client.storage
  .from('avatars')
  .remove(['user-123/old-avatar.jpg']);`;

const storageListFiles = `const { data: files } = await client.storage
  .from('avatars')
  .list('user-123/');`;

const typescriptTypes = `import type {
  // Response types
  ZendbxResponse,
  ZendbxError,
  
  // Auth types
  User,
  Session,
  AuthData,
  SignUpCredentials,
  SignInCredentials,
  
  // Query types
  FilterOperator,
  OrderClause,
  SelectOptions,
  
  // Storage types
  StorageBucket,
  StorageObject,
  StorageUploadResult,
  
  // Database types
  DatabaseRow,
  JsonValue,
  
  // Error classes
  ZendbxSDKError,
  AuthExpiredError,
} from '@zendbx/sdk';`;

const customRowTypes = `// Extend DatabaseRow for type safety
interface Product extends DatabaseRow {
  id: string;
  name: string;
  price: number;
  category: 'electronics' | 'clothing' | 'food';
  in_stock: boolean;
}

const { data } = await client.from<Product>('products')
  .select('*')
  .eq('category', 'electronics')
  .gt('price', 100);

// Full IntelliSense support
if (data) {
  data.forEach(product => {
    console.log(product.name, product.price);
  });
}`;

const errorHandling = `const { data, error } = await client.from('users').select('*');

if (error) {
  console.error('Query failed:', error.message);
  console.error('Status:', error.status);
  console.error('Details:', error.details);
  return;
}

// Safe to use data here
console.log('Users:', data);`;

const errorStructure = `interface ZendbxError {
  message: string;   // Human-readable error message
  status?: number;   // HTTP status code
  details?: unknown; // Additional context
  code?: string;     // Error code for programmatic handling
  hint?: string;     // Suggestion for fixing the error
}`;

const sdkErrors = `import { 
  ZendbxSDKError,
  MissingConfigError,
  InvalidUrlError,
  AuthExpiredError,
  ProjectNotFoundError,
  StorageProviderError 
} from '@zendbx/sdk';

try {
  const client = createClient({
    apiUrl: '',  // Invalid
    projectSlug: 'test',
    anonKey: 'key'
  });
} catch (error) {
  if (error instanceof MissingConfigError) {
    console.error('Configuration error:', error.message);
  }
}`;

const lazyQuery = `// Build query conditionally
let query = client.from('products').select('*');

if (category) query = query.eq('category', category);
if (minPrice) query = query.gte('price', minPrice);
if (inStock) query = query.eq('in_stock', true);

// Execute once
const { data } = await query;`;

const fullExample = `import { createClient } from '@zendbx/sdk';
import type { User } from '@zendbx/sdk';

// Initialize client
const client = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  projectSlug: process.env.ZENDBX_PROJECT_SLUG!,
  anonKey: process.env.ZENDBX_ANON_KEY!
});

// Type-safe user interface
interface AppUser extends User {
  subscription_tier: 'free' | 'pro' | 'enterprise';
  last_login: string;
}

async function main() {
  // Sign in
  const { data: authData, error: authError } = await client.auth.signIn({
    email: 'user@example.com',
    password: 'secure-password'
  });

  if (authError) {
    console.error('Login failed:', authError.message);
    return;
  }

  console.log('Logged in as:', authData.user.email);

  // Fetch data with filters
  const { data: users, error, count } = await client
    .from<AppUser>('users')
    .select('*', { count: 'exact' })
    .eq('subscription_tier', 'pro')
    .gte('last_login', '2024-01-01')
    .order('last_login', { ascending: false })
    .range(0, 19);

  if (error) {
    console.error('Query failed:', error.message);
    return;
  }

  console.log(\`Found \${count} pro users, showing first 20:\`);
  users?.forEach(user => {
    console.log(\`- \${user.email} (\${user.subscription_tier})\`);
  });

  // Insert new record
  const { data: newUser, error: insertError } = await client
    .from<AppUser>('users')
    .insert({
      email: 'newuser@example.com',
      name: 'New User',
      subscription_tier: 'free'
    })
    .select();

  if (!insertError) {
    console.log('Created user:', newUser[0].id);
  }

  // Bulk insert
  const bulkData = [
    { name: 'Alice', email: 'alice@example.com', subscription_tier: 'pro' },
    { name: 'Bob', email: 'bob@example.com', subscription_tier: 'free' },
    { name: 'Carol', email: 'carol@example.com', subscription_tier: 'enterprise' }
  ];

  const { data: bulkUsers } = await client
    .from<AppUser>('users')
    .insert(bulkData)
    .select();

  // Upload file
  const file = new File(['Hello'], 'test.txt', { type: 'text/plain' });
  await client.storage
    .from('documents')
    .upload(\`user-\${authData.user.id}/hello.txt\`, file);

  // Sign out
  await client.auth.signOut();
}

main().catch(console.error);`;

export default function SDKPage() {
  return (
    <article>
      <Heading level={1}>SDK Reference</Heading>
      <p className="text-sm text-gray-400 mb-2">
        Official SDKs for ZendBX with full TypeScript support. Choose your language to get started.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
        <a href="/docs/sdk/typescript" className="block p-6 border border-gray-700 rounded-lg hover:border-orange-500 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="blue">TypeScript/JavaScript</Badge>
            <Badge color="green">v1.3.0</Badge>
          </div>
          <h3 className="text-lg font-semibold mb-2">@zendbx/sdk</h3>
          <p className="text-sm text-gray-400">
            TypeScript SDK with full generic support for React, Next.js, Vue, Svelte, Node.js, and modern JS runtimes.
          </p>
        </a>

        <a href="/docs/sdk/python" className="block p-6 border border-gray-700 rounded-lg hover:border-orange-500 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="blue">Python</Badge>
            <Badge color="green">v1.0.3</Badge>
          </div>
          <h3 className="text-lg font-semibold mb-2">zendbx</h3>
          <p className="text-sm text-gray-400">
            Async Python SDK for FastAPI, Flask, Django, and any Python 3.8+ application.
          </p>
        </a>
      </div>

      <hr className="border-gray-700 my-8" />

      <Heading level={1}>TypeScript SDK</Heading>
      <p className="text-sm text-gray-400 mb-2">
        The official TypeScript SDK for ZendBX with full type safety and generic support. Works in React, Next.js, Vue, Svelte, Node.js, and any modern JS runtime.
      </p>
      <div className="flex items-center gap-2 mb-8">
        <Badge color="orange">@zendbx/sdk</Badge>
        <Badge color="green">v1.3.0</Badge>
        <Badge color="blue">TypeScript</Badge>
      </div>

      <Heading level={2} id="install">Installation</Heading>
      <CodeBlock code={install} lang="bash" />

      <Note>
        <strong>Requirements:</strong> Node.js 18+ (uses native fetch) and TypeScript 5.0+ for type support.
      </Note>

      {/* createClient */}
      <Heading level={2} id="create-client">Client Initialization</Heading>
      <p className="text-sm text-gray-400 mb-3">Creates and returns a ZendBX client instance. Call this once and export the result.</p>

      <CodeBlock code={createClientBasic} lang="typescript" title="Basic usage" />
      <CodeBlock code={createClientAdvanced} lang="typescript" title="Advanced usage with options" />

      <ParamTable params={[
        { name: 'apiUrl', type: 'string', required: true, description: 'ZendBX API URL (e.g., https://api.zendbx.in)' },
        { name: 'projectSlug', type: 'string', required: true, description: 'Your project slug identifier' },
        { name: 'anonKey', type: 'string', required: true, description: 'Project anonymous (public) key for client-side' },
        { name: 'accessToken', type: 'string', required: false, description: 'Optional JWT token for authenticated requests' },
        { name: 'autoRefreshToken', type: 'boolean', required: false, description: 'Auto-refresh expired tokens (default: false)' },
      ]} />

      {/* Auth */}
      <Heading level={2} id="auth">Authentication</Heading>
      <p className="text-sm text-gray-400 mb-3">Complete authentication system with email/password, OAuth, and session management.</p>

      <Heading level={3} id="auth-signup">Sign Up</Heading>
      <CodeBlock code={signUp} lang="typescript" />

      <Heading level={3} id="auth-signin">Sign In</Heading>
      <CodeBlock code={signIn} lang="typescript" />

      <Heading level={3} id="auth-getuser">Get Current User</Heading>
      <CodeBlock code={getUser} lang="typescript" />

      <Heading level={3} id="auth-getsession">Get Session Token</Heading>
      <CodeBlock code={getSession} lang="typescript" />

      <Heading level={3} id="auth-setsession">Set Session Manually</Heading>
      <CodeBlock code={setSession} lang="typescript" />

      <Heading level={3} id="auth-signout">Sign Out</Heading>
      <CodeBlock code={signOut} lang="typescript" />

      <Heading level={3} id="auth-refresh">Refresh Session</Heading>
      <CodeBlock code={refreshSession} lang="typescript" />

      <Heading level={3} id="auth-password">Password Reset</Heading>
      <CodeBlock code={passwordReset} lang="typescript" />

      <Heading level={3} id="auth-verify">Email Verification</Heading>
      <CodeBlock code={emailVerification} lang="typescript" />

      <Heading level={3} id="auth-update">Update User</Heading>
      <CodeBlock code={updateUser} lang="typescript" />

      {/* Database */}
      <Heading level={2} id="database">Database Operations</Heading>
      <p className="text-sm text-gray-400 mb-3">
        All database operations use <code className="text-orange-400">client.from(tableName)</code> which returns a chainable query builder.
      </p>

      <Heading level={3} id="select">SELECT</Heading>
      <CodeBlock code={fromSelect} lang="typescript" title="Basic SELECT" />
      <CodeBlock code={selectWithCount} lang="typescript" title="SELECT with Count" />

      <Heading level={3} id="filters">Filtering</Heading>
      <p className="text-sm text-gray-400 mb-2">All filters are chainable and map to PostgREST query parameters.</p>
      <CodeBlock code={filters} lang="typescript" />

      <Heading level={3} id="insert">INSERT</Heading>
      <CodeBlock code={insert} lang="typescript" title="Single INSERT" />
      <CodeBlock code={bulkInsert} lang="typescript" title="Bulk INSERT" />

      <Note>
        <strong>Bulk inserts are atomic:</strong> All rows insert or none do. If any row fails validation, the entire operation rolls back.
        ZendBX supports heterogeneous bulk inserts where different rows can have different column sets.
      </Note>

      <Heading level={3} id="update">UPDATE</Heading>
      <CodeBlock code={update} lang="typescript" />

      <Heading level={3} id="delete">DELETE</Heading>
      <CodeBlock code={del} lang="typescript" />

      <Heading level={3} id="upsert">UPSERT</Heading>
      <CodeBlock code={upsert} lang="typescript" />

      <Note>Always chain at least one filter (<code className="text-orange-400">.eq()</code>, etc.) before <code className="text-orange-400">.update()</code> or <code className="text-orange-400">.delete()</code> to avoid modifying all rows.</Note>

      <Heading level={3} id="ordering">Ordering</Heading>
      <CodeBlock code={ordering} lang="typescript" />

      <Heading level={3} id="pagination">Pagination</Heading>
      <CodeBlock code={pagination} lang="typescript" />

      <Heading level={3} id="single">Single Row Operations</Heading>
      <CodeBlock code={singleRow} lang="typescript" />

      {/* Storage */}
      <Heading level={2} id="storage">Storage</Heading>
      <p className="text-sm text-gray-400 mb-3">
        File upload, download, and management backed by Backblaze B2.
      </p>

      <Heading level={3} id="storage-list-buckets">List Buckets</Heading>
      <CodeBlock code={storageList} lang="typescript" />

      <Heading level={3} id="storage-create-bucket">Create Bucket</Heading>
      <CodeBlock code={storageCreate} lang="typescript" />

      <Heading level={3} id="storage-upload">Upload File</Heading>
      <CodeBlock code={storageUpload} lang="typescript" />

      <Heading level={3} id="storage-download">Download File</Heading>
      <CodeBlock code={storageDownload} lang="typescript" />

      <Heading level={3} id="storage-public-url">Get Public URL</Heading>
      <CodeBlock code={storagePublicUrl} lang="typescript" />

      <Heading level={3} id="storage-signed-url">Create Signed URL (Private Files)</Heading>
      <CodeBlock code={signedUrl} lang="typescript" />

      <Heading level={3} id="storage-delete">Delete Files</Heading>
      <CodeBlock code={storageDelete} lang="typescript" />

      <Heading level={3} id="storage-list-files">List Files in Bucket</Heading>
      <CodeBlock code={storageListFiles} lang="typescript" />

      {/* TypeScript */}
      <Heading level={2} id="typescript">TypeScript Support</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Full type safety with generic row types and exported interfaces.
      </p>

      <Heading level={3} id="ts-types">Exported Types</Heading>
      <CodeBlock code={typescriptTypes} lang="typescript" />

      <Heading level={3} id="ts-custom">Custom Row Types</Heading>
      <CodeBlock code={customRowTypes} lang="typescript" />

      {/* Error handling */}
      <Heading level={2} id="errors">Error Handling</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Every operation returns <code className="text-orange-400">{'{ data, error }'}</code>. <strong>Never throws for database errors.</strong> Check <code className="text-orange-400">error</code> before using <code className="text-orange-400">data</code>.
      </p>

      <Heading level={3} id="error-check">Check Error Field</Heading>
      <CodeBlock code={errorHandling} lang="typescript" />

      <Heading level={3} id="error-structure">Error Object Structure</Heading>
      <CodeBlock code={errorStructure} lang="typescript" />

      <Heading level={3} id="error-classes">SDK Error Classes</Heading>
      <CodeBlock code={sdkErrors} lang="typescript" />

      {/* Best Practices */}
      <Heading level={2} id="best-practices">Best Practices</Heading>

      <Heading level={3} id="bp-env">Use Environment Variables</Heading>
      <CodeBlock code={`const client = createClient({
  apiUrl: process.env.ZENDBX_URL!,
  projectSlug: process.env.ZENDBX_PROJECT_SLUG!,
  anonKey: process.env.ZENDBX_ANON_KEY!
});`} lang="typescript" />

      <Heading level={3} id="bp-lazy">Lazy Query Building</Heading>
      <CodeBlock code={lazyQuery} lang="typescript" />

      <Heading level={3} id="bp-select">Use .select() for Returning Data</Heading>
      <CodeBlock code={`// Good - returns inserted data
const { data } = await client.from('users')
  .insert({ name: 'John' })
  .select();

// Returns empty array without .select()
const { data } = await client.from('users')
  .insert({ name: 'John' });
// data: []`} lang="typescript" />

      {/* Full Example */}
      <Heading level={2} id="full-example">Complete Example</Heading>
      <CodeBlock code={fullExample} lang="typescript" />

      {/* Common Errors */}
      <Heading level={2} id="common-errors">Common Errors</Heading>

      <ParamTable params={[
        { name: '401 Unauthorized', type: 'Auth Error', description: 'Authentication token expired or invalid. Call client.auth.signIn() or refreshSession().' },
        { name: '403 Forbidden', type: 'Permission', description: 'Permission denied. Check RLS policies or use service_role key for admin operations.' },
        { name: '404 Not Found', type: 'Resource', description: 'Resource not found. Verify table name, project slug, and that the resource exists.' },
        { name: '409 Conflict', type: 'Constraint', description: 'Unique constraint violation. Use .upsert() instead or handle duplicate keys.' },
        { name: '422 Validation', type: 'Input', description: 'Invalid input data. Check required fields, data types, and constraints.' },
      ]} />

      <hr className="border-gray-700 my-8" />

      {/* Further Reading */}
      <Heading level={2} id="further-reading">Further Reading</Heading>
      <ul className="list-disc list-inside space-y-2 text-sm text-gray-400">
        <li><a href="/docs/sdk/typescript" className="text-orange-400 hover:underline">TypeScript SDK Full Documentation</a></li>
        <li><a href="/docs/sdk/python" className="text-orange-400 hover:underline">Python SDK Documentation</a></li>
        <li><a href="/docs/sdk/auth" className="text-orange-400 hover:underline">Authentication Deep Dive</a></li>
        <li><a href="/docs/sdk/database" className="text-orange-400 hover:underline">Database Operations Guide</a></li>
        <li><a href="/docs/sdk/storage" className="text-orange-400 hover:underline">Storage API Reference</a></li>
        <li><a href="/docs/rest" className="text-orange-400 hover:underline">REST API Reference</a></li>
      </ul>
    </article>
  );
}
