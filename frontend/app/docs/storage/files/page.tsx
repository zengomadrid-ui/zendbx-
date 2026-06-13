import { CodeBlock, Note, Heading, ParamTable } from '../../components';

export const metadata = { title: 'Upload & Download — ZendBX Docs' };

const uploadBrowser = `// Browser - Upload from file input
const bucket = db.storage.bucket('documents');
const file = event.target.files[0];

const { data, error } = await bucket.upload(file);

if (error) {
  console.error('Upload failed:', error);
} else {
  console.log('Uploaded:', data);
  // {
  //   id: "file-uuid",
  //   filename: "report.pdf",
  //   size: 245760,
  //   content_type: "application/pdf",
  //   created_at: "2024-01-15T10:30:00Z",
  //   url: "/p/demo/storage/files/{id}/download"
  // }
}`;

const uploadNode = `// Node.js - Upload from filesystem
import fs from 'fs';

const bucket = db.storage.bucket('documents');
const buffer = fs.readFileSync('./report.pdf');

const { data, error } = await bucket.upload(buffer, 'report.pdf', {
  contentType: 'application/pdf',
});`;

const uploadCustomName = `// Custom filename
const { data, error } = await bucket.upload(file, 'custom-name.pdf');

// Auto-generate unique filename
const timestamp = Date.now();
const { data, error } = await bucket.upload(file, \`document-\${timestamp}.pdf\`);`;

const uploadOptions = `// Upload with metadata
const { data, error } = await bucket.upload(file, 'resume.pdf', {
  contentType: 'application/pdf',
  metadata: {
    userId: '123',
    uploadedBy: 'john@example.com',
    category: 'resumes',
  },
});`;

const uploadProgress = `// Track upload progress (coming soon)
const { data, error } = await bucket.upload(file, {
  onProgress: (progress) => {
    console.log(\`Uploaded: \${progress.loaded} / \${progress.total} bytes\`);
    console.log(\`Progress: \${Math.round(progress.percentage)}%\`);
  },
});`;

const downloadFile = `// Download file
const bucket = db.storage.bucket('documents');
const response = await bucket.download('file-id');

// Get as Blob (browser)
const blob = await response.blob();
const url = URL.createObjectURL(blob);

// Use in <img> or <a> tag
document.querySelector('img').src = url;

// Or trigger download
const a = document.createElement('a');
a.href = url;
a.download = 'filename.pdf';
a.click();`;

const downloadBuffer = `// Download as Buffer (Node.js)
const response = await bucket.download('file-id');
const buffer = await response.buffer();

// Save to file
fs.writeFileSync('./downloaded.pdf', buffer);`;

const signedUrl = `// Generate temporary download URL
const bucket = db.storage.bucket('documents');
const { data, error } = await bucket.createSignedUrl('file-id', '1h');

console.log(data.url);
// https://api.zendbx.in/p/demo/storage/signed/abc123...

// Use in <img> tag
<img src={data.url} alt="Document" />

// Available expiry options
'5m'   // 5 minutes
'15m'  // 15 minutes
'1h'   // 1 hour
'24h'  // 24 hours
'7d'   // 7 days`;

const publicUrl = `// Public bucket - direct preview URL
const bucket = db.storage.bucket('public-assets');
const url = bucket.getPreviewUrl('logo.png');

// Use directly (no auth required)
<img src={url} alt="Logo" />`;

const listFiles = `// List all files
const bucket = db.storage.bucket('documents');
const { data: files, error } = await bucket.list();

files.forEach(file => {
  console.log(\`\${file.filename} - \${file.size} bytes\`);
});`;

const searchFiles = `// Search and filter
const { data: files } = await bucket.list({
  search: 'invoice',           // Search filename
  sortBy: 'created_at',        // created_at | size | filename
  sortDir: 'desc',             // asc | desc
  limit: 50,                   // Results per page
  offset: 0,                   // Pagination offset
});`;

const deleteFile = `// Delete single file
const bucket = db.storage.bucket('documents');
const { error } = await bucket.delete('file-id');

// Delete multiple files
const { error } = await bucket.bulkDelete([
  'file-id-1',
  'file-id-2',
  'file-id-3',
]);`;

const restUpload = `curl -X POST https://api.zendbx.in/p/demo/storage/buckets/documents/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -F "file=@/path/to/document.pdf"`;

const restDownload = `curl https://api.zendbx.in/p/demo/storage/files/{file-id}/download \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -o downloaded.pdf`;

const secureUpload = `// Client-side: validate file before upload
function validateFile(file) {
  const maxSize = 5 * 1024 * 1024; // 5 MB
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  return true;
}

// Server-side: RLS policy
CREATE POLICY "Users can only upload to own folder"
ON storage_objects
FOR INSERT
WITH CHECK (
  auth.uid()::text = (metadata->>'userId')
);`;

const errorHandling = `try {
  const { data, error } = await bucket.upload(file);
  
  if (error) {
    if (error.code === 'file_too_large') {
      alert('File exceeds size limit');
    } else if (error.code === 'invalid_file_type') {
      alert('File type not allowed');
    } else if (error.code === 'quota_exceeded') {
      alert('Storage quota exceeded');
    } else {
      alert('Upload failed: ' + error.message);
    }
  } else {
    console.log('Upload successful:', data);
  }
} catch (err) {
  console.error('Unexpected error:', err);
}`;

export default function FilesPage() {
  return (
    <article>
      <Heading level={1}>Upload & Download</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Upload and download files using the ZendBX Storage SDK or REST API. 
        Works in both browser and Node.js environments.
      </p>

      <Heading level={2} id="uploading">Uploading Files</Heading>
      
      <Heading level={3} id="browser-upload">Browser Upload</Heading>
      <CodeBlock code={uploadBrowser} lang="typescript" />

      <Heading level={3} id="nodejs-upload">Node.js Upload</Heading>
      <CodeBlock code={uploadNode} lang="typescript" />

      <Heading level={3} id="custom-filename">Custom Filenames</Heading>
      <CodeBlock code={uploadCustomName} lang="typescript" />
      <Note>
        Filenames are not required to be unique. The backend generates unique IDs for each file.
      </Note>

      <Heading level={3} id="upload-options">Upload Options</Heading>
      <CodeBlock code={uploadOptions} lang="typescript" />
      <ParamTable params={[
        { name: 'file', type: 'File | Blob | Buffer', required: true, description: 'File to upload' },
        { name: 'filename', type: 'string', required: false, description: 'Custom filename (defaults to file.name)' },
        { name: 'contentType', type: 'string', required: false, description: 'MIME type (auto-detected for File objects)' },
        { name: 'metadata', type: 'object', required: false, description: 'Custom metadata (JSON object)' },
      ]} />

      <Heading level={3} id="upload-progress">Upload Progress</Heading>
      <CodeBlock code={uploadProgress} lang="typescript" />
      <Note>
        Progress tracking is planned for a future release. Currently uploads complete without progress callbacks.
      </Note>

      <Heading level={2} id="downloading">Downloading Files</Heading>

      <Heading level={3} id="browser-download">Browser Download</Heading>
      <CodeBlock code={downloadFile} lang="typescript" />

      <Heading level={3} id="nodejs-download">Node.js Download</Heading>
      <CodeBlock code={downloadBuffer} lang="typescript" />

      <Heading level={2} id="temporary-urls">Temporary URLs</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Signed URLs provide temporary access to private files without authentication:
      </p>
      <CodeBlock code={signedUrl} lang="typescript" />
      <Note>
        Signed URLs expire after the specified duration. Generate a new URL when the old one expires.
      </Note>

      <Heading level={2} id="public-urls">Public URLs</Heading>
      <CodeBlock code={publicUrl} lang="typescript" />
      <Note type="warning">
        Public URLs only work for files in public buckets. Private bucket files require signed URLs.
      </Note>

      <Heading level={2} id="listing">Listing Files</Heading>
      <CodeBlock code={listFiles} lang="typescript" />

      <Heading level={3} id="search-filter">Search & Filter</Heading>
      <CodeBlock code={searchFiles} lang="typescript" />

      <Heading level={2} id="deleting">Deleting Files</Heading>
      <CodeBlock code={deleteFile} lang="typescript" />
      <Note type="warning">
        File deletion is permanent. Deleted files cannot be recovered unless you have backups enabled.
      </Note>

      <Heading level={2} id="rest-api">REST API Examples</Heading>
      <Heading level={3} id="rest-upload">Upload via cURL</Heading>
      <CodeBlock code={restUpload} lang="bash" />

      <Heading level={3} id="rest-download">Download via cURL</Heading>
      <CodeBlock code={restDownload} lang="bash" />

      <Heading level={2} id="security">Security Best Practices</Heading>
      <CodeBlock code={secureUpload} lang="typescript" />
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-2">
        <li>
          <strong className="text-white">Validate files client-side:</strong> Check size and type before upload
        </li>
        <li>
          <strong className="text-white">Use RLS policies:</strong> Restrict uploads to authorized users
        </li>
        <li>
          <strong className="text-white">Never trust client input:</strong> Server-side validation is required
        </li>
        <li>
          <strong className="text-white">Scan for malware:</strong> Implement virus scanning for user uploads
        </li>
        <li>
          <strong className="text-white">Use private buckets:</strong> Default to private unless files are truly public
        </li>
      </ul>

      <Heading level={2} id="error-handling">Error Handling</Heading>
      <CodeBlock code={errorHandling} lang="typescript" />

      <Heading level={2} id="common-errors">Common Error Codes</Heading>
      <ParamTable params={[
        { name: 'file_too_large', type: '413', description: 'File exceeds maximum size limit' },
        { name: 'invalid_file_type', type: '415', description: 'File type not allowed' },
        { name: 'quota_exceeded', type: '413', description: 'Storage quota exceeded' },
        { name: 'bucket_not_found', type: '404', description: 'Bucket does not exist' },
        { name: 'file_not_found', type: '404', description: 'File does not exist' },
        { name: 'permission_denied', type: '403', description: 'No access to bucket or file' },
      ]} />

      <Heading level={2} id="file-limits">File Limits</Heading>
      <ParamTable params={[
        { name: 'Max file size', type: 'string', description: '5 GB (configurable per project)' },
        { name: 'Max filename length', type: 'number', description: '255 characters' },
        { name: 'Supported file types', type: 'string', description: 'All types (configurable per bucket)' },
        { name: 'Max files per bucket', type: 'string', description: 'Unlimited' },
      ]} />

      <Heading level={2} id="best-practices">Best Practices</Heading>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-2">
        <li>
          <strong className="text-white">Use unique filenames:</strong> Append timestamps or UUIDs to avoid conflicts
        </li>
        <li>
          <strong className="text-white">Set appropriate content types:</strong> Helps browsers handle files correctly
        </li>
        <li>
          <strong className="text-white">Delete unused files:</strong> Clean up to avoid quota limits
        </li>
        <li>
          <strong className="text-white">Use signed URLs for sensitive files:</strong> Limit access duration
        </li>
        <li>
          <strong className="text-white">Implement progress indicators:</strong> Improves UX for large uploads
        </li>
        <li>
          <strong className="text-white">Handle errors gracefully:</strong> Show user-friendly error messages
        </li>
      </ul>
    </article>
  );
}

