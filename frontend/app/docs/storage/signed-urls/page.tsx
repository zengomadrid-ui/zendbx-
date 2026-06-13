import { CodeBlock, Note, Heading, ParamTable } from '../../components';

export const metadata = { title: 'Signed URLs — ZendBX Docs' };

const basicSignedUrl = `// Generate a 1-hour signed URL
const bucket = db.storage.bucket('documents');
const { data, error } = await bucket.createSignedUrl('file-id', '1h');

console.log(data.url);
// https://api.zendbx.in/p/demo/storage/signed/eyJhbGc...

// Use in your app
<img src={data.url} alt="Document" />
<a href={data.url} download>Download</a>`;

const expiryOptions = `// 5 minutes
const { data } = await bucket.createSignedUrl('file-id', '5m');

// 15 minutes
const { data } = await bucket.createSignedUrl('file-id', '15m');

// 1 hour (recommended for most use cases)
const { data } = await bucket.createSignedUrl('file-id', '1h');

// 24 hours
const { data } = await bucket.createSignedUrl('file-id', '24h');

// 7 days (maximum)
const { data } = await bucket.createSignedUrl('file-id', '7d');`;

const emailExample = `// Generate signed URL for email
async function sendInvoiceEmail(userId, fileId) {
  const bucket = db.storage.bucket('invoices');
  
  // 7-day expiry for email links
  const { data } = await bucket.createSignedUrl(fileId, '7d');
  
  await sendEmail({
    to: user.email,
    subject: 'Your Invoice',
    html: \`
      <p>Your invoice is ready:</p>
      <a href="\${data.url}">Download Invoice</a>
      <p><small>Link expires in 7 days</small></p>
    \`,
  });
}`;

const shareExample = `// Share file temporarily
async function shareFile(fileId, recipientEmail) {
  const bucket = db.storage.bucket('shared');
  
  // 24-hour access
  const { data } = await bucket.createSignedUrl(fileId, '24h');
  
  // Log the share event
  await db.from('file_shares').insert({
    file_id: fileId,
    shared_with: recipientEmail,
    url: data.url,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  
  return data.url;
}`;

const imageGallery = `// Image gallery with signed URLs
async function loadGallery() {
  const bucket = db.storage.bucket('photos');
  const { data: files } = await bucket.list();
  
  // Generate signed URLs for all images
  const images = await Promise.all(
    files.map(async (file) => {
      const { data } = await bucket.createSignedUrl(file.id, '1h');
      return {
        id: file.id,
        filename: file.filename,
        url: data.url,
      };
    })
  );
  
  return images;
}

// Render gallery
<div className="grid grid-cols-3 gap-4">
  {images.map(img => (
    <img key={img.id} src={img.url} alt={img.filename} />
  ))}
</div>`;

const cacheExample = `// Cache signed URLs (avoid regenerating)
const urlCache = new Map();

async function getCachedSignedUrl(fileId) {
  const cached = urlCache.get(fileId);
  
  // Check if cached URL is still valid
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  
  // Generate new signed URL
  const bucket = db.storage.bucket('documents');
  const { data } = await bucket.createSignedUrl(fileId, '1h');
  
  // Cache with expiry (subtract 5 min buffer)
  urlCache.set(fileId, {
    url: data.url,
    expiresAt: Date.now() + 55 * 60 * 1000,
  });
  
  return data.url;
}`;

const restExample = `curl -X POST https://api.zendbx.in/p/demo/storage/files/{file-id}/signed-url \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expiry": "1h"
  }'

# Response
{
  "data": {
    "url": "https://api.zendbx.in/p/demo/storage/signed/eyJhbGc...",
    "expires_at": "2024-01-15T11:30:00Z"
  },
  "error": null
}`;

const securityExample = `// Server-side: Generate signed URLs
// ✅ GOOD - Server generates URLs
export async function getFileUrl(fileId: string) {
  const bucket = db.storage.bucket('documents');
  const { data } = await bucket.createSignedUrl(fileId, '1h');
  return data.url;
}

// ❌ BAD - Exposing service role key to client
// Never do this!
const publicClient = new ZendBXClient(
  'https://api.zendbx.in',
  'service_role_key_exposed_to_client' // NEVER DO THIS
);`;

const rlsExample = `-- Restrict signed URL generation with RLS
CREATE POLICY "Users can only create signed URLs for own files"
ON storage_objects
FOR SELECT
USING (
  auth.uid()::text = (metadata->>'userId')
  OR
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid()
  )
);`;

const downloadExample = `// Force download with signed URL
const { data } = await bucket.createSignedUrl('file-id', '1h');

// Use in download link
<a 
  href={data.url} 
  download="document.pdf"
  className="btn btn-primary"
>
  Download PDF
</a>

// Or trigger programmatically
async function downloadFile() {
  const { data } = await bucket.createSignedUrl('file-id', '5m');
  
  const response = await fetch(data.url);
  const blob = await response.blob();
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filename.pdf';
  a.click();
  URL.revokeObjectURL(url);
}`;

const expiredHandling = `// Handle expired URLs gracefully
async function loadImage(fileId) {
  try {
    const { data } = await bucket.createSignedUrl(fileId, '1h');
    return data.url;
  } catch (error) {
    if (error.code === 'file_not_found') {
      console.error('File no longer exists');
    } else if (error.code === 'permission_denied') {
      console.error('No access to file');
    } else {
      console.error('Failed to generate URL:', error);
    }
    return null;
  }
}

// Auto-refresh expired URLs
function useSignedUrl(fileId, expiry = '1h') {
  const [url, setUrl] = useState(null);
  
  useEffect(() => {
    const loadUrl = async () => {
      const bucket = db.storage.bucket('photos');
      const { data } = await bucket.createSignedUrl(fileId, expiry);
      setUrl(data.url);
    };
    
    loadUrl();
    
    // Refresh before expiry
    const expiryMs = parseExpiry(expiry);
    const interval = setInterval(loadUrl, expiryMs - 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fileId, expiry]);
  
  return url;
}`;

export default function SignedUrlsPage() {
  return (
    <article>
      <Heading level={1}>Signed URLs</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Signed URLs provide temporary, secure access to private files without requiring authentication. 
        Perfect for sharing files, embedding in emails, or displaying in client applications.
      </p>

      <Heading level={2} id="overview">What are Signed URLs?</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Signed URLs are time-limited URLs that grant temporary access to private files. They contain:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>File identifier</li>
        <li>Expiration timestamp</li>
        <li>Cryptographic signature (prevents tampering)</li>
      </ul>
      <Note>
        Signed URLs work only for files in private buckets. Public buckets use direct preview URLs instead.
      </Note>

      <Heading level={2} id="basic-usage">Basic Usage</Heading>
      <CodeBlock code={basicSignedUrl} lang="typescript" />

      <Heading level={2} id="expiry-options">Expiry Options</Heading>
      <CodeBlock code={expiryOptions} lang="typescript" />
      <ParamTable params={[
        { name: '5m', type: '5 minutes', description: 'Quick shares, temporary previews' },
        { name: '15m', type: '15 minutes', description: 'Short-term access' },
        { name: '1h', type: '1 hour', description: 'Recommended for most use cases' },
        { name: '24h', type: '24 hours', description: 'Day-long access' },
        { name: '7d', type: '7 days', description: 'Email links, long-term shares (maximum)' },
      ]} />

      <Heading level={2} id="use-cases">Common Use Cases</Heading>

      <Heading level={3} id="email-attachments">Email Attachments</Heading>
      <CodeBlock code={emailExample} lang="typescript" />

      <Heading level={3} id="file-sharing">Temporary File Sharing</Heading>
      <CodeBlock code={shareExample} lang="typescript" />

      <Heading level={3} id="image-gallery">Image Gallery</Heading>
      <CodeBlock code={imageGallery} lang="typescript" />

      <Heading level={2} id="caching">Caching Signed URLs</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Avoid regenerating signed URLs on every page load:
      </p>
      <CodeBlock code={cacheExample} lang="typescript" />
      <Note>
        Cache signed URLs in memory or Redis with a buffer before expiry (e.g., 5 minutes).
      </Note>

      <Heading level={2} id="rest-api">REST API</Heading>
      <CodeBlock code={restExample} lang="bash" />

      <Heading level={2} id="security">Security Considerations</Heading>
      <CodeBlock code={securityExample} lang="typescript" />
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-2">
        <li>
          <strong className="text-white">Generate server-side:</strong> Never expose service role keys to clients
        </li>
        <li>
          <strong className="text-white">Use short expiry:</strong> Minimize risk if URL is leaked
        </li>
        <li>
          <strong className="text-white">Log access:</strong> Track who generated signed URLs and when
        </li>
        <li>
          <strong className="text-white">Validate permissions:</strong> Check user access before generating URL
        </li>
        <li>
          <strong className="text-white">Use HTTPS only:</strong> Signed URLs should never be sent over HTTP
        </li>
      </ul>

      <Heading level={2} id="rls">Row-Level Security</Heading>
      <CodeBlock code={rlsExample} lang="sql" />
      <Note>
        RLS policies apply when generating signed URLs. Users can only create URLs for files they have access to.
      </Note>

      <Heading level={2} id="downloads">Forced Downloads</Heading>
      <CodeBlock code={downloadExample} lang="typescript" />

      <Heading level={2} id="expired-urls">Handling Expired URLs</Heading>
      <CodeBlock code={expiredHandling} lang="typescript" />

      <Heading level={2} id="best-practices">Best Practices</Heading>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-2">
        <li>
          <strong className="text-white">Choose appropriate expiry:</strong> Balance security and user experience
        </li>
        <li>
          <strong className="text-white">Cache URLs:</strong> Avoid regenerating on every request
        </li>
        <li>
          <strong className="text-white">Handle expiry gracefully:</strong> Show user-friendly messages
        </li>
        <li>
          <strong className="text-white">Log generation:</strong> Track signed URL creation for audit trails
        </li>
        <li>
          <strong className="text-white">Use 1h for most cases:</strong> Good balance between security and UX
        </li>
        <li>
          <strong className="text-white">Regenerate before expiry:</strong> Implement auto-refresh for long sessions
        </li>
      </ul>

      <Heading level={2} id="limits">Limits & Quotas</Heading>
      <ParamTable params={[
        { name: 'Max expiry', type: 'string', description: '7 days' },
        { name: 'Min expiry', type: 'string', description: '5 minutes' },
        { name: 'URLs per minute', type: 'string', description: 'Subject to API rate limits' },
        { name: 'URL length', type: 'string', description: '~200-500 characters (varies)' },
      ]} />

      <Heading level={2} id="troubleshooting">Troubleshooting</Heading>
      <ParamTable params={[
        { name: 'URL expired', type: 'error', description: 'Generate a new signed URL' },
        { name: 'Invalid signature', type: 'error', description: 'URL was tampered with or project keys changed' },
        { name: 'File not found', type: 'error', description: 'File was deleted or moved' },
        { name: 'Permission denied', type: 'error', description: 'User lost access to file or bucket' },
      ]} />
    </article>
  );
}
