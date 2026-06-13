import { CodeBlock, Note, Heading, ParamTable } from '../components';

export const metadata = { title: 'Storage — ZendBX Docs' };

const createBucket = `// via SDK
await db.storage.createBucket('avatars', {
  description: 'User profile pictures',
  isPublic: false,
});`;

const listBuckets = `const { data: buckets } = await db.storage.listBuckets();`;

const upload = `const bucket = db.storage.bucket('avatars');

// Browser: upload a File object
const file = event.target.files[0];
const { data, error } = await bucket.upload(file, 'user-123.png');

// Node.js: upload a Buffer
const buffer = fs.readFileSync('./resume.pdf');
const { data, error } = await bucket.upload(buffer, 'resume.pdf', {
  contentType: 'application/pdf',
});`;

const list = `const { data: files } = await bucket.list();
// data: StorageObject[]

// With options
const { data: files } = await bucket.list({
  search: 'resume',
  sortBy: 'created_at',
  sortDir: 'desc',
});`;

const download = `const response = await bucket.download('file-uuid');
const blob = await response.blob();
const url = URL.createObjectURL(blob);`;

const signedUrl = `// Generate a temporary URL (expires in 1 hour)
const { data } = await bucket.createSignedUrl('file-uuid', '1h');
console.log(data.url);

// Available expiry values: '5m', '15m', '1h', '24h', '7d'`;

const deleteFile = `// Delete single file
await bucket.delete('file-uuid');

// Delete multiple files
await bucket.bulkDelete(['uuid-1', 'uuid-2', 'uuid-3']);`;

const previewUrl = `// Get inline preview URL (public buckets only)
const url = bucket.getPreviewUrl('file-uuid');`;

const curlUpload = `curl -X POST https://api.zendbx.in/p/my-project/storage/buckets/avatars/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -F "file=@/path/to/photo.png"`;

const curlList = `curl https://api.zendbx.in/p/my-project/storage/buckets/avatars/files \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "apikey: YOUR_ANON_KEY"`;

const curlSignedUrl = `curl -X POST https://api.zendbx.in/p/my-project/storage/files/{file-id}/signed-url \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"expiry":"1h"}'`;

export default function StoragePage() {
  return (
    <article>
      <Heading level={1}>Storage</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX Storage is an enterprise-grade object storage system backed by Backblaze B2. 
        Files are organized into buckets per project with a clean, slug-based API that never exposes internal UUIDs.
      </p>

      <Heading level={2} id="architecture">Architecture V3</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Storage V3 is built as a first-class platform service following these core principles:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Every API is project-scoped</li>
        <li>Public APIs use human-readable identifiers (slugs), never internal UUIDs</li>
        <li>Business logic exists only once in service layers</li>
        <li>Routers are thin; services contain logic</li>
        <li>Provider-agnostic design supports future multi-cloud storage</li>
      </ul>

      <p className="text-sm text-gray-400 mb-3">
        All routes follow the pattern:
      </p>
      <CodeBlock code={`/p/{project-slug}/storage/buckets/{bucket-slug}/...`} lang="text" />
      
      <p className="text-sm text-gray-400 mb-3">
        File metadata is stored in PostgreSQL (<code className="text-orange-400">storage_buckets</code> and <code className="text-orange-400">storage_objects</code> tables).
        The actual file bytes live in Backblaze B2, but the architecture supports pluggable storage providers.
      </p>

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
        <p className="text-xs text-gray-400 font-mono mb-2">Architecture Layers</p>
        <CodeBlock code={`HTTP Router (FastAPI)
    ↓
Service Layer (business logic)
    ↓
Repository Layer (SQL)
    ↓
Database (PostgreSQL)
    ↓
Storage Provider (Backblaze B2)`} lang="text" />
      </div>

      <Heading level={2} id="resource-resolution">Resource Resolution</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The SDK and REST API never require UUIDs. The backend automatically resolves:
      </p>
      <CodeBlock code={`project_slug → project_id → bucket_slug → bucket_uuid → storage_provider`} lang="text" />
      <p className="text-sm text-gray-400 mb-3">
        This means you can reference resources naturally:
      </p>
      <CodeBlock code={`const bucket = db.storage.bucket('avatars');  // Not: bucket('550e8400-e29b-41d4-a716...')`} lang="typescript" />

      <Heading level={2} id="buckets">Buckets</Heading>
      <p className="text-sm text-gray-400 mb-3">
        A bucket is a named container for files. Create buckets in the Dashboard → Storage → Buckets,
        or programmatically:
      </p>
      <CodeBlock code={createBucket} lang="typescript" />
      <CodeBlock code={listBuckets} lang="typescript" />

      <Note>
        Bucket slugs are auto-generated from the name. <code className="text-orange-400">My Avatars</code> becomes <code className="text-orange-400">my-avatars</code>.
        Use slugs in all SDK calls. UUIDs are supported internally for backward compatibility but should not be used in new code.
      </Note>

      <Heading level={2} id="public-vs-private">Public vs Private Buckets</Heading>
      <p className="text-sm text-gray-400 mb-3">
        <strong className="text-white">Private buckets</strong> (default) — files require a signed URL or authenticated download.<br />
        <strong className="text-white">Public buckets</strong> — files are accessible via a direct preview URL without authentication.
      </p>
      <Note type="warning">
        Make buckets public only for genuinely public content (logos, public assets).
        User documents, resumes, and private files should always use private buckets with signed URLs.
      </Note>

      <Heading level={2} id="upload">Upload</Heading>
      <CodeBlock code={upload} lang="typescript" />
      <ParamTable params={[
        { name: 'file', type: 'File | Blob | ArrayBuffer | Uint8Array', required: true, description: 'The file to upload.' },
        { name: 'filename', type: 'string', required: false, description: 'Override the filename. Defaults to file.name for File objects.' },
        { name: 'options.contentType', type: 'string', required: false, description: 'MIME type. Auto-detected for File objects.' },
      ]} />

      <Heading level={2} id="list">List Files</Heading>
      <CodeBlock code={list} lang="typescript" />

      <Heading level={2} id="download">Download</Heading>
      <CodeBlock code={download} lang="typescript" />

      <Heading level={2} id="signed-urls">Signed URLs</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Generate temporary URLs for private files. Use these to share files with specific users
        or serve them in &lt;img&gt; tags.
      </p>
      <CodeBlock code={signedUrl} lang="typescript" />

      <Heading level={2} id="delete">Delete</Heading>
      <CodeBlock code={deleteFile} lang="typescript" />

      <Heading level={2} id="preview">Preview URL</Heading>
      <CodeBlock code={previewUrl} lang="typescript" />

      <Heading level={2} id="rest-examples">REST API Examples</Heading>
      <CodeBlock code={curlUpload} lang="bash" title="Upload via cURL" />
      <CodeBlock code={curlList} lang="bash" title="List files" />
      <CodeBlock code={curlSignedUrl} lang="bash" title="Generate signed URL" />

      <Heading level={2} id="security">Security & Permissions</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Every storage operation validates:
      </p>
      <ol className="text-sm text-gray-400 mb-4 list-decimal list-inside space-y-1">
        <li>Project ownership and access</li>
        <li>Bucket existence and permissions</li>
        <li>User authorization (JWT or API key)</li>
        <li>Row-level security policies (if configured)</li>
      </ol>
      <Note type="warning">
        Never expose service role keys in client-side code. Use anon keys with RLS policies for client apps.
      </Note>

      <Heading level={2} id="provider-abstraction">Storage Provider Abstraction</Heading>
      <p className="text-sm text-gray-400 mb-3">
        ZendBX Storage V3 uses a provider-agnostic architecture. Currently supports Backblaze B2,
        with planned support for:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>AWS S3</li>
        <li>Cloudflare R2</li>
        <li>MinIO (self-hosted)</li>
        <li>Azure Blob Storage</li>
        <li>Google Cloud Storage</li>
      </ul>
      <p className="text-sm text-gray-400 mb-3">
        Changing storage providers requires zero application code changes — only backend configuration.
      </p>

      <Heading level={2} id="metrics">Monitoring & Metrics</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Storage V3 tracks:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Upload/download counts</li>
        <li>Storage usage per project and bucket</li>
        <li>Transfer bandwidth</li>
        <li>Failed upload attempts</li>
        <li>Operation duration (latency)</li>
        <li>Provider availability</li>
      </ul>
      <p className="text-sm text-gray-400 mb-3">
        View these metrics in Dashboard → Analytics → Storage.
      </p>

      <Heading level={2} id="future-features">Future Features</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The V3 architecture is designed to support:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Access Control Lists (ACLs)</li>
        <li>Object versioning</li>
        <li>Lifecycle rules (auto-delete old files)</li>
        <li>CDN integration</li>
        <li>Multipart uploads for large files</li>
        <li>Multi-region replication</li>
        <li>Image transformations (resize, compress)</li>
      </ul>

      <Heading level={2} id="migration">Migrating from Legacy API</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The legacy <code className="text-orange-400">/api/storage</code> endpoint is still supported but deprecated.
        New projects should use <code className="text-orange-400">/p/{`{project-slug}`}/storage</code>.
      </p>
      <Note>
        Both APIs use the same service layer internally — there is no duplicate logic.
        The legacy API will be removed in a future major version.
      </Note>
    </article>
  );
}
