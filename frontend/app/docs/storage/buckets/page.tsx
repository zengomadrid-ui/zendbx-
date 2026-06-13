import { CodeBlock, Note, Heading, ParamTable } from '../../components';

export const metadata = { title: 'Storage Buckets — ZendBX Docs' };

const createBucket = `const { data: bucket, error } = await db.storage.createBucket('user-uploads', {
  description: 'Files uploaded by users',
  isPublic: false,
});

console.log(bucket);
// {
//   id: "550e8400-e29b-41d4-a716-446655440000",
//   slug: "user-uploads",
//   name: "user-uploads",
//   description: "Files uploaded by users",
//   is_public: false,
//   created_at: "2024-01-15T10:30:00Z",
//   project_id: "..."
// }`;

const publicBucket = `// Public bucket - files accessible without auth
await db.storage.createBucket('public-assets', {
  description: 'Logos, icons, public images',
  isPublic: true,
});`;

const listBuckets = `const { data: buckets, error } = await db.storage.listBuckets();

buckets.forEach(bucket => {
  console.log(\`\${bucket.name} (\${bucket.slug})\`);
  console.log(\`  Public: \${bucket.is_public}\`);
  console.log(\`  Files: \${bucket.file_count}\`);
  console.log(\`  Size: \${bucket.total_size} bytes\`);
});`;

const getBucketInfo = `const bucket = db.storage.bucket('user-uploads');
const { data: info, error } = await bucket.info();

console.log(info);
// {
//   id: "...",
//   slug: "user-uploads",
//   name: "user-uploads",
//   description: "Files uploaded by users",
//   is_public: false,
//   file_count: 142,
//   total_size: 5242880,  // bytes
//   created_at: "2024-01-15T10:30:00Z"
// }`;

const updateBucket = `// Update bucket metadata
const { data, error } = await db.storage.updateBucket('user-uploads', {
  description: 'Updated description',
  isPublic: true,
});`;

const deleteBucket = `// Delete bucket (files must be deleted separately)
const { error } = await db.storage.deleteBucket('old-bucket');`;

const bucketAccess = `// Access bucket by slug (preferred)
const bucket = db.storage.bucket('user-uploads');

// Access by UUID (backward compatibility)
const bucketById = db.storage.bucket('550e8400-e29b-41d4-a716-446655440000');

// Both work identically - backend resolves automatically`;

const namingRules = `// Valid bucket names
"user-uploads"      → slug: "user-uploads"
"User Uploads"      → slug: "user-uploads"
"My Documents 2024" → slug: "my-documents-2024"

// Invalid characters are stripped
"User's Files!!!"   → slug: "users-files"`;

const rlsPolicies = `-- Enable RLS on storage buckets
ALTER TABLE storage_buckets ENABLE ROW LEVEL SECURITY;

-- Users can only access buckets in their projects
CREATE POLICY "Users can access own project buckets"
ON storage_buckets
FOR ALL
USING (
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid()
  )
);

-- Similar policy for storage_objects
CREATE POLICY "Users can access own project files"
ON storage_objects
FOR ALL
USING (
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid()
  )
);`;

const quotaExample = `// Check storage quota
const { data: usage } = await db.storage.getUsage();

console.log(usage);
// {
//   used: 5242880,      // 5 MB
//   limit: 1073741824,  // 1 GB
//   percentage: 0.48
// }`;

export default function BucketsPage() {
  return (
    <article>
      <Heading level={1}>Storage Buckets</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Buckets are containers for organizing files in ZendBX Storage. 
        Each bucket is scoped to a project and can be public or private.
      </p>

      <Heading level={2} id="creating-buckets">Creating Buckets</Heading>
      <CodeBlock code={createBucket} lang="typescript" />
      <ParamTable params={[
        { name: 'name', type: 'string', required: true, description: 'Bucket name (auto-generates slug)' },
        { name: 'description', type: 'string', required: false, description: 'Optional description' },
        { name: 'isPublic', type: 'boolean', required: false, description: 'Public access (default: false)' },
      ]} />

      <Heading level={2} id="bucket-slugs">Bucket Slugs</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Bucket slugs are auto-generated from the name. They are:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Lowercase</li>
        <li>Spaces converted to hyphens</li>
        <li>Special characters removed</li>
        <li>Unique within a project</li>
      </ul>
      <CodeBlock code={namingRules} lang="typescript" />

      <Heading level={2} id="accessing-buckets">Accessing Buckets</Heading>
      <CodeBlock code={bucketAccess} lang="typescript" />
      <Note>
        Always use slugs in new code. UUID support exists for backward compatibility only.
      </Note>

      <Heading level={2} id="public-vs-private">Public vs Private Buckets</Heading>
      
      <Heading level={3} id="private-buckets">Private Buckets (Default)</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Files require authentication to access. Use for:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>User-uploaded documents</li>
        <li>Private photos and videos</li>
        <li>Confidential files</li>
        <li>Any user-specific data</li>
      </ul>

      <Heading level={3} id="public-buckets">Public Buckets</Heading>
      <CodeBlock code={publicBucket} lang="typescript" />
      <p className="text-sm text-gray-400 mb-3">
        Files are accessible without authentication. Use for:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Company logos and branding</li>
        <li>Public marketing assets</li>
        <li>Open-source files</li>
        <li>Static website content</li>
      </ul>
      <Note type="warning">
        Never use public buckets for user data, documents, or anything requiring access control.
      </Note>

      <Heading level={2} id="listing-buckets">Listing Buckets</Heading>
      <CodeBlock code={listBuckets} lang="typescript" />

      <Heading level={2} id="bucket-info">Getting Bucket Info</Heading>
      <CodeBlock code={getBucketInfo} lang="typescript" />

      <Heading level={2} id="updating-buckets">Updating Buckets</Heading>
      <CodeBlock code={updateBucket} lang="typescript" />

      <Heading level={2} id="deleting-buckets">Deleting Buckets</Heading>
      <CodeBlock code={deleteBucket} lang="typescript" />
      <Note type="warning">
        Deleting a bucket does NOT delete its files. Files must be deleted separately to avoid orphaned data.
      </Note>

      <Heading level={2} id="row-level-security">Row-Level Security</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Protect buckets and files with PostgreSQL RLS policies:
      </p>
      <CodeBlock code={rlsPolicies} lang="sql" />
      <Note>
        RLS policies apply to both buckets and files. Always test policies with the anon key before deploying.
      </Note>

      <Heading level={2} id="storage-quotas">Storage Quotas</Heading>
      <CodeBlock code={quotaExample} lang="typescript" />
      <p className="text-sm text-gray-400 mb-3">
        Storage quotas are enforced at the project level:
      </p>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-1">
        <li>Free: 1 GB</li>
        <li>Pro: 100 GB</li>
        <li>Enterprise: Custom limits</li>
      </ul>

      <Heading level={2} id="best-practices">Best Practices</Heading>
      <ul className="text-sm text-gray-400 mb-4 list-disc list-inside space-y-2">
        <li>
          <strong className="text-white">Use descriptive names:</strong> <code className="text-orange-400">user-avatars</code> not <code className="text-orange-400">bucket1</code>
        </li>
        <li>
          <strong className="text-white">Organize by purpose:</strong> Separate buckets for avatars, documents, images, etc.
        </li>
        <li>
          <strong className="text-white">Default to private:</strong> Only make buckets public when absolutely necessary
        </li>
        <li>
          <strong className="text-white">Enable RLS:</strong> Use Row-Level Security for multi-tenant apps
        </li>
        <li>
          <strong className="text-white">Monitor usage:</strong> Track storage and transfer to avoid quota limits
        </li>
        <li>
          <strong className="text-white">Use slugs:</strong> Reference buckets by slug, not UUID
        </li>
      </ul>

      <Heading level={2} id="limits">Bucket Limits</Heading>
      <ParamTable params={[
        { name: 'Max buckets', type: 'number', description: '100 per project' },
        { name: 'Max bucket name length', type: 'number', description: '63 characters' },
        { name: 'Max files per bucket', type: 'number', description: 'Unlimited' },
        { name: 'Max file size', type: 'string', description: '5 GB (configurable)' },
      ]} />
    </article>
  );
}

