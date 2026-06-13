import { CodeBlock, Note, Heading, ParamTable } from '../components';

export const metadata = { title: 'Authentication — ZendBX Docs' };

const signUp = `const { data, error } = await db.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  name: 'Jane Doe',
});
// data.user  — User object
// data.session — Session with access_token`;

const signIn = `const { data, error } = await db.auth.signIn({
  email: 'user@example.com',
  password: 'password123',
});

if (error) {
  // Invalid credentials, rate limited, etc.
  console.error(error.message);
  return;
}

const { user, session } = data;
console.log('Signed in as:', user.email);
console.log('Token:', session.access_token);`;

const getUser = `const { data: { user } } = await db.auth.getUser();

if (!user) {
  // Not authenticated
  redirect('/login');
}`;

const signOut = `await db.auth.signOut();
// Token cleared from memory and localStorage`;

const sessionPersist = `// Token is automatically persisted to localStorage['zendbx_token']
// On next page load, it's restored automatically

// To opt out of localStorage (SSR / Node.js):
const db = createClient({
  apiUrl, anonKey, projectSlug,
  storageKey: null,  // disables storage
  getAccessToken: () => mySessionStore.getToken(),
});`;

const passwordReset = `// Step 1: Request reset email
await db.auth.resetPassword('user@example.com');

// Step 2: After user clicks email link, update password
await db.auth.updatePassword(token, 'newpassword123');`;

const oauthCurl = `# Get OAuth login URL
curl https://api.zendbx.in/oauth/{provider}/login?project_slug=my-project`;

const signUpCurl = `curl -X POST https://api.zendbx.in/v1/auth/{project-id}/signup \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password123","name":"Jane"}'`;

const signInCurl = `curl -X POST https://api.zendbx.in/v1/auth/{project-id}/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@example.com","password":"password123"}'`;

const jwtPayload = `{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "iss": "zendbx",
  "project_id": "project-uuid",
  "iat": 1718000000,
  "exp": 1718604800
}`;

export default function AuthPage() {
  return (
    <article>
      <Heading level={1}>Authentication</Heading>
      <p className="text-sm text-gray-400 mb-8">
        ZendBX provides project-scoped authentication. Every project has its own user store,
        JWT secret, and session management — completely isolated from other projects.
      </p>

      <Heading level={2} id="how-it-works">How It Works</Heading>
      <p className="text-sm text-gray-400 mb-3">
        When a user signs up or signs in, ZendBX issues a JWT signed with your project's unique <code className="text-orange-400">jwt_secret</code>.
        This token is sent with every request as <code className="text-orange-400">Authorization: Bearer &lt;token&gt;</code>.
        The backend decodes it to establish the user's identity for RLS policies.
      </p>
      <Note>
        Platform tokens (dashboard logins) are signed with the platform's <code className="text-orange-400">SECRET_KEY</code>.
        Project tokens (SDK logins) are signed with the project's <code className="text-orange-400">jwt_secret</code>.
        The unified auth resolver accepts both.
      </Note>

      <Heading level={2} id="signup">Sign Up</Heading>
      <CodeBlock code={signUp} lang="typescript" />
      <ParamTable params={[
        { name: 'email', type: 'string', required: true, description: 'User email address.' },
        { name: 'password', type: 'string', required: true, description: 'Minimum 6 characters.' },
        { name: 'name', type: 'string', required: false, description: 'Display name. Defaults to email prefix.' },
      ]} />

      <Heading level={2} id="signin">Sign In</Heading>
      <CodeBlock code={signIn} lang="typescript" />

      <Heading level={2} id="getuser">Get Current User</Heading>
      <CodeBlock code={getUser} lang="typescript" />

      <Heading level={2} id="signout">Sign Out</Heading>
      <CodeBlock code={signOut} lang="typescript" />

      <Heading level={2} id="sessions">Session Persistence</Heading>
      <CodeBlock code={sessionPersist} lang="typescript" />

      <Heading level={2} id="password-reset">Password Reset</Heading>
      <CodeBlock code={passwordReset} lang="typescript" />

      <Heading level={2} id="jwt">JWT Structure</Heading>
      <p className="text-sm text-gray-400 mb-3">
        ZendBX JWTs are standard HS256 tokens. Here's what the payload looks like:
      </p>
      <CodeBlock code={jwtPayload} lang="json" />
      <Note type="warning">
        JWTs expire after 7 days. Call <code className="text-orange-400">db.auth.getSession()</code> to verify the token is still valid.
        If it returns <code className="text-orange-400">null</code>, redirect to login.
      </Note>

      <Heading level={2} id="oauth">OAuth Providers</Heading>
      <p className="text-sm text-gray-400 mb-3">
        OAuth is configured per-project in the Dashboard → Authentication → Providers.
        Supported providers: Google, GitHub.
      </p>
      <CodeBlock code={oauthCurl} lang="bash" title="Get OAuth redirect URL" />

      <Heading level={2} id="rest-examples">REST API Examples</Heading>
      <CodeBlock code={signUpCurl} lang="bash" title="Sign up" />
      <CodeBlock code={signInCurl} lang="bash" title="Sign in" />
    </article>
  );
}
