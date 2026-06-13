import { CodeBlock, Note, Heading, ParamTable } from '../../components';

export const metadata = { title: 'Storage API Reference — ZendBX Docs' };

const createBucketExample = `// SDK
const { data, error } = await db.storage.createBucket('documents', {
  description: 'User documents',
  isPublic: false,
});

// REST API
POST /p/{project-slug}/storage/buckets
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY

{
  "name": "documents",
  "description": "User documents",
  "is_public": false
}`;

const listBucketsExample = `// SDK
const { data: buckets, error } = await db.storage.listBuckets();

// REST API
GET /p/{project-slug}/storage/buckets
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY`;

const getBucketExample = `// SDK
const { data: bucket, error } = await db.storage.bucket('documents').info();

// REST API
GET /p/{project-slug}/storage/buckets/documents
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY`;

const deleteBucketExample = `// SDK
const { error } = await db.storage.deleteBucket('documents');

// REST API
DELETE /p/{project-slug}/storage/buckets/documents
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY`;

const uploadExample = `// SDK - Browser
const bucket = db.storage.bucket('documents');
const file = event.target.files[0];
const { data, error } = await bucket.upload(file);

// SDK - Node.js
const buffer = fs.readFileSync('./report.pdf');
const { data, error } = await bucket.upload(buffer, 'report.pdf', {
  contentType: 'application/pdf',
});

// REST API
POST /p/{project-slug}/storage/buckets/documents/upload
Content-Type: multipart/form-data
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY

file: [binary data]`;

const listFilesExample = `// SDK
const bucket = db.storage.bucket('documents');
const { data: files, error } = await bucket.list({
  search: 'invoice',
  sortBy: 'created_at',
  sortDir: 'desc',
  limit: 50,
  offset: 0,
});

// REST API
GET /p/{project-slug}/storage/buckets/documents/files?search=invoice&sortBy=created_at&sortDir=desc
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY`;

const downloadExample = `// SDK
const bucket = db.storage.bucket('documents');
const response = await bucket.download('file-id');
const blob = await response.blob();

// REST API
GET /p/{project-slug}/storage/files/{file-id}/download
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY`;

const signedUrlExample = `// SDK
const bucket = db.storage.bucket('documents');
const { data, error } = await bucket.createSignedUrl('file-id', '1h');
// data.url → temporary download URL

// REST API
POST /p/{project-slug}/storage/files/{file-id}/signed-url
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY

{
  "expiry": "1h"
}`;

const deleteFileExample = `// SDK
const bucket = db.storage.bucket('documents');
await bucket.delete('file-id');

// Bulk delete
await bucket.bulkDelete(['file-1', 'file-2', 'file-3']);

// REST API
DELETE /p/{project-slug}/storage/files/{file-id}
Authorization: Bearer YOUR_TOKEN
apikey: YOUR_ANON_KEY`;

const previewUrlExample = `// SDK (public buckets only)
const bucket = db.storage.bucket('public-assets');
const url = bucket.getPreviewUrl('logo.png');

// Returns: https://api.zendbx.in/p/demo/storage/files/{file-id}/preview`;

export default function StorageAPIPage() {
  return (
    <article>
      <Heading level={1}>Storage API Reference</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Complete API reference for ZendBX Storage V3. All endpoints are project-scoped and use human-readable slugs.
      </p>

      <Note>
        Base URL: <code className="text-orange-400">https://api.zendbx.in/p/{`{project-slug}`}/storage</code>
      </Note>

      <Heading level={2} id="authentication">Authentication</Heading>
      <p className="text-sm text-gray-400 mb-3">
        All requests require authentication via JWT token or API key:
      </p>
      <CodeBlock code={`Authorization: Bearer YOUR_JWT_TOKEN
apikey: YOUR_ANON_KEY`} lang="text" />
      <p className="text-sm text-gray-400 mb-6">
        Use the anon key for client-side requests (with RLS enabled). 
        Use the service role key for server-side operations.
      </p>

      <Heading level={2} id="buckets">Bucket Operations</Heading>

      <Heading level={3} id="create-bucket">Create Bucket</Heading>
      <CodeBlock code={createBucketExample} lang="typescript" />
      <ParamTable params={[
        { name: 'name', type: 'string', required: true, description: 'Bucket name (auto-generates slug)' },
        { name: 'description', type: 'string', required: false, description: 'Bucket description' },
        { name: 'is_public', type: 'boolean', required: false, description: 'Allow public access (default: false)' },
      ]} />

      <Heading level={3} id="list-buckets">List Buckets</Heading>
      <CodeBlock code={listBucketsExample} lang="typescript" />

      <Heading level={3} id="get-bucket">Get Bucket Info</Heading>
      <CodeBlock code={getBucketExample} lang="typescript" />

      <Heading level={3} id="delete-bucket">Delete Bucket</Heading>
      <CodeBlock code={deleteBucketExample} lang="typescript" />
      <Note type="warning">
        Deleting a bucket does not delete its files. Files must be deleted separately.
      </Note>

      <Heading level={2} id="file-operations">File Operations</Heading>

      <Heading level={3} id="upload">Upload File</Heading>
      <CodeBlock code={uploadExample} lang="typescript" />
      <ParamTable params={[
        { name: 'file', type: 'File | Blob | Buffer | ArrayBuffer', required: true, description: 'File to upload' },
        { name: 'filename', type: 'string', required: false, description: 'Override filename (defaults to file.name)' },
        { name: 'contentType', type: 'string', required: false, description: 'MIME type (auto-detected for File objects)' },
      ]} />

      <Heading level={3} id="list-files">List Files</Heading>
      <CodeBlock code={listFilesExample} lang="typescript" />
      <ParamTable params={[
        { name: 'search', type: 'string', required: false, description: 'Search filename' },
        { name: 'sortBy', type: 'string', required: false, description: 'created_at | size | filename' },
        { name: 'sortDir', type: 'string', required: false, description: 'asc | desc' },
        { name: 'limit', type: 'number', required: false, description: 'Results per page (default: 50)' },
        { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
      ]} />

      <Heading level={3} id="download">Download File</Heading>
      <CodeBlock code={downloadExample} lang="typescript" />

      <Heading level={3} id="signed-url">Create Signed URL</Heading>
      <CodeBlock code={signedUrlExample} lang="typescript" />
      <ParamTable params={[
        { name: 'expiry', type: 'string', required: true, description: '5m | 15m | 1h | 24h | 7d' },
      ]} />

      <Heading level={3} id="delete-file">Delete File</Heading>
      <CodeBlock code={deleteFileExample} lang="typescript" />

      <Heading level={3} id="preview-url">Get Preview URL</Heading>
      <CodeBlock code={previewUrlExample} lang="typescript" />
      <Note>
        Preview URLs only work for public buckets. For private buckets, use signed URLs.
      </Note>

      <Heading level={2} id="response-format">Response Format</Heading>
      <p className="text-sm text-gray-400 mb-3">
        All successful responses return JSON:
      </p>
      <CodeBlock code={`{
  "data": { ... },
  "error": null
}`} lang="json" />
      <p className="text-sm text-gray-400 mb-3">
        Error responses:
      </p>
      <CodeBlock code={`{
  "data": null,
  "error": {
    "message": "Bucket not found",
    "code": "bucket_not_found",
    "status": 404
  }
}`} lang="json" />

      <Heading level={2} id="error-codes">Error Codes</Heading>
      <ParamTable params={[
        { name: '400', type: 'Bad Request', description: 'Invalid parameters' },
        { name: '401', type: 'Unauthorized', description: 'Invalid or missing authentication' },
        { name: '403', type: 'Forbidden', description: 'Permission denied' },
        { name: '404', type: 'Not Found', description: 'Project, bucket, or file not found' },
        { name: '409', type: 'Conflict', description: 'Bucket or file already exists' },
        { name: '413', type: 'Payload Too Large', description: 'File exceeds size limit' },
        { name: '415', type: 'Unsupported Media Type', description: 'File type not allowed' },
        { name: '500', type: 'Internal Server Error', description: 'Storage provider unavailable' },
      ]} />

      <Heading level={2} id="rate-limits">Rate Limits</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Storage operations are subject to rate limits based on your plan:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Free: 100 requests/minute</li>
        <li>Pro: 1,000 requests/minute</li>
        <li>Enterprise: Custom limits</li>
      </ul>
      <Note>
        Rate limit headers are included in responses: <code className="text-orange-400">X-RateLimit-Limit</code>, 
        <code className="text-orange-400">X-RateLimit-Remaining</code>, <code className="text-orange-400">X-RateLimit-Reset</code>
      </Note>
    </article>
  );
}

