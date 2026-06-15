import { CodeBlock, Note, Heading, ParamTable, Badge } from '../../components';

export const metadata = { title: 'Auth API Reference — ZendBX Docs' };

const apiKeysExample = `// Get your keys from Dashboard → Project Settings → API Keys
const apiUrl = 'https://api.zendbx.in';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Public (safe to expose)
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Secret (keep secure)

const db = createClient({ apiUrl, anonKey, projectSlug: 'my-project' });`;

const signUpRequest = `POST /v1/auth/{project-id}/signup

Headers:
  Content-Type: application/json
  apikey: {anon-key}

Body:
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Jane Doe"
}

Response:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe"
  },
  "session": {
    "access_token": "jwt-token",
    "expires_at": 1234567890
  }
}`;

const signInRequest = `POST /v1/auth/{project-id}/login

Headers:
  Content-Type: application/json
  apikey: {anon-key}

Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "user": { ... },
  "session": {
    "access_token": "jwt-token",
    "expires_at": 1234567890
  }
}`;

const getUserRequest = `GET /v1/auth/{project-id}/user

Headers:
  Authorization: Bearer {access-token}
  apikey: {anon-key}

Response:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
}`;

const signOutRequest = `POST /v1/auth/{project-id}/logout

Headers:
  Authorization: Bearer {access-token}
  apikey: {anon-key}

Response:
{
  "message": "Signed out successfully"
}`;

const resetPasswordRequest = `POST /v1/auth/{project-id}/reset-password

Headers:
  Content-Type: application/json
  apikey: {anon-key}

Body:
{
  "email": "user@example.com"
}

Response:
{
  "message": "Password reset email sent"
}`;

const updatePasswordRequest = `POST /v1/auth/{project-id}/update-password

Headers:
  Content-Type: application/json
  apikey: {anon-key}

Body:
{
  "token": "reset-token-from-email",
  "password": "newpassword123"
}

Response:
{
  "message": "Password updated successfully"
}`;

export default function AuthAPIPage() {
  return (
    <article className="bg-black text-gray-100">
      <Heading level={1}>Auth API Reference</Heading>
      <p className="text-sm text-gray-400 mb-8">
        Complete REST API reference for authentication endpoints. All requests require project-specific API keys.
      </p>

      <Heading level={2} id="api-keys">API Keys</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Every project has two JWT-signed API keys. Both are required for authentication operations.
      </p>
      
      <div className="space-y-3 mb-6">
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="green">anon</Badge>
            <span className="text-xs text-gray-400">Public key - Safe to use in client-side code</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Used for public operations like sign-up, sign-in, and read access with RLS policies.
          </p>
          <code className="text-xs text-orange-400 break-all">
            eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6ZW5kYngiLCJwcm9qZWN0X2lkIjoieW91ci1wcm9qZWN0LWlkIiwicm9sZSI6ImFub24ifQ...
          </code>
        </div>

        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="red">service_role</Badge>
            <span className="text-xs text-gray-400">Secret key - Keep secure, never expose in client</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Bypasses RLS policies. Use only in server-side code for admin operations.
          </p>
          <code className="text-xs text-orange-400 break-all">
            eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6ZW5kYngiLCJwcm9qZWN0X2lkIjoieW91ci1wcm9qZWN0LWlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9...
          </code>
        </div>
      </div>

      <CodeBlock code={apiKeysExample} lang="typescript" title="Using API keys with SDK" />

      <Note type="warning">
        The <code className="text-orange-400">service_role</code> key bypasses Row Level Security.
        Never expose it in client-side code or public repositories.
      </Note>

      <Heading level={2} id="signup">Sign Up</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Create a new user account in the project.
      </p>
      <CodeBlock code={signUpRequest} lang="http" />
      <ParamTable params={[
        { name: 'email', type: 'string', required: true, description: 'Valid email address' },
        { name: 'password', type: 'string', required: true, description: 'Minimum 6 characters' },
        { name: 'name', type: 'string', required: false, description: 'Display name. Defaults to email prefix' },
      ]} />

      <Heading level={2} id="signin">Sign In</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Authenticate with email and password. Returns access token for subsequent requests.
      </p>
      <CodeBlock code={signInRequest} lang="http" />
      <Note>
        The returned <code className="text-orange-400">access_token</code> must be sent as 
        <code className="text-orange-400"> Authorization: Bearer &lt;token&gt;</code> for authenticated endpoints.
      </Note>

      <Heading level={2} id="getuser">Get User</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Retrieve the currently authenticated user's information.
      </p>
      <CodeBlock code={getUserRequest} lang="http" />

      <Heading level={2} id="signout">Sign Out</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Invalidate the current session.
      </p>
      <CodeBlock code={signOutRequest} lang="http" />

      <Heading level={2} id="reset-password">Reset Password</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Initiate password reset flow. Sends reset email to user.
      </p>
      <CodeBlock code={resetPasswordRequest} lang="http" />

      <Heading level={2} id="update-password">Update Password</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Complete password reset using token from email.
      </p>
      <CodeBlock code={updatePasswordRequest} lang="http" />

      <Heading level={2} id="errors">Error Responses</Heading>
      <p className="text-sm text-gray-400 mb-3">
        All endpoints return standard error responses:
      </p>
      <CodeBlock code={`{
  "detail": "Error message",
  "status_code": 400
}

Common status codes:
  400 - Bad Request (invalid input)
  401 - Unauthorized (invalid/missing token)
  403 - Forbidden (insufficient permissions)
  429 - Too Many Requests (rate limited)
  500 - Internal Server Error`} lang="json" />
    </article>
  );
}

