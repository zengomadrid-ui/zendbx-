import { CodeBlock, Note, Heading, ParamTable, Badge } from '../../components';

export const metadata = { title: 'Python SDK Reference — ZenDBX Docs' };

const install = `pip install zendbx`;

const installVersion = `pip install zendbx==1.0.3`;

const createClientBasic = `import asyncio
from zendbx import ZenDBX

# Initialize client
client = ZenDBX(
    project_url="https://api.zendbx.in/p/your-project",
    anon_key="your-anon-key"
)

async def main():
    # Your code here
    await client.close()  # Always close when done

asyncio.run(main())`;

const createClientContext = `import asyncio
from zendbx import ZenDBX

async def main():
    # Using context manager (recommended)
    async with ZenDBX(
        project_url="https://api.zendbx.in/p/your-project",
        anon_key="your-anon-key"
    ) as client:
        # Your code here
        user = await client.auth.get_user()
        print(user)
    # Client automatically closed

asyncio.run(main())`;

const createClientEnv = `import os
from dotenv import load_dotenv
from zendbx import ZenDBX

load_dotenv()

async def main():
    async with ZenDBX(
        project_url=os.getenv("ZENDBX_PROJECT_URL"),
        anon_key=os.getenv("ZENDBX_ANON_KEY")
    ) as client:
        # Your code here
        pass

asyncio.run(main())`;

const signUp = `# Sign up a new user
response = await client.auth.sign_up(
    email="user@example.com",
    password="secure_password123",
    name="John Doe"  # Optional
)

if "access_token" in response:
    print(f"User created: {response['user']['email']}")
    print(f"Token: {response['access_token']}")
else:
    print(f"Error: {response}")`;

const signIn = `# Sign in existing user
response = await client.auth.sign_in(
    email="user@example.com",
    password="secure_password123"
)

if "access_token" in response:
    print("Sign in successful!")
else:
    print("Authentication failed")`;

const getUser = `# Get current authenticated user
user = await client.auth.get_user()

print(f"User ID: {user['id']}")
print(f"Email: {user['email']}")
print(f"Name: {user.get('name', 'N/A')}")`;

const sessionManagement = `# NEW in v1.0.3: Session Management

# Save session token
response = await client.auth.sign_in(
    email="user@example.com",
    password="password123"
)
access_token = response["access_token"]

# Later, restore session in new client
async with ZenDBX(project_url="...", anon_key="...") as new_client:
    # Restore session
    new_client.auth.set_session(access_token)
    
    # Now can make authenticated requests
    user = await new_client.auth.get_user()
    print(f"Restored session for: {user['email']}")
    
    # Clear session (local only, no backend call)
    new_client.auth.clear_session()`;

const signOut = `# Sign out current user
await client.auth.sign_out()
print("Signed out successfully")

# Note: sign_out() always clears local session
# even if backend call fails (resilient logout)`;

const selectBasic = `# Select all columns
response = await client.from_("users").select("*").execute()
print(response)

# Select specific columns
response = await client.from_("users").select("id, name, email").execute()`;

const selectWithFilters = `# With filters
response = await client.from_("users") \\
    .select("*") \\
    .eq("status", "active") \\
    .order_by("created_at", desc=True) \\
    .limit(20) \\
    .execute()`;

const filters = `# Equality
.eq("column", value)
.neq("column", value)

# Comparison
.gt("age", 18)
.gte("score", 90)
.lt("price", 100)
.lte("quantity", 50)

# String matching
.like("name", "%john%")
.ilike("email", "%@gmail.com")

# In list
.in_("status", ["active", "pending"])

# Between
.between("age", 18, 65)

# Ordering
.order_by("created_at", desc=True)  # descending
.order_by("name")  # ascending (default)

# Pagination
.limit(10)
.offset(20)`;

const insert = `# Insert one row
response = await client.from_("todos").insert({
    "title": "My first todo",
    "completed": False
}).execute()

# Insert multiple rows
response = await client.from_("todos").insert([
    {"title": "Task 1", "completed": False},
    {"title": "Task 2", "completed": True}
]).execute()`;

const update = `# Update with filter
response = await client.from_("todos") \\
    .update({"completed": True}) \\
    .eq("id", "some-uuid") \\
    .execute()

# Update multiple rows
response = await client.from_("todos") \\
    .update({"status": "archived"}) \\
    .eq("completed", True) \\
    .execute()`;

const delete_ = `# Delete with filter
response = await client.from_("todos") \\
    .delete() \\
    .eq("id", "some-uuid") \\
    .execute()

# Delete multiple rows
response = await client.from_("todos") \\
    .delete() \\
    .eq("completed", True) \\
    .execute()`;

const storageUpload = `# Upload a file
with open("avatar.png", "rb") as f:
    response = await client.storage \\
        .from_("avatars") \\
        .upload(f, "user-123.png")
    
    if "error" not in response:
        print(f"Uploaded: {response['url']}")`;

const storageList = `# List files in bucket
response = await client.storage \\
    .from_("avatars") \\
    .list()

for file in response["files"]:
    print(f"{file['name']} - {file['size']} bytes")`;

const storageDelete = `# Delete a file
await client.storage \\
    .from_("avatars") \\
    .delete("file-uuid")

# Bulk delete
await client.storage \\
    .from_("avatars") \\
    .bulk_delete(["uuid-1", "uuid-2"])`;

const errorHandling = `from zendbx.exceptions import (
    ZenDBXAuthenticationError,
    ZenDBXPermissionError,
    ZenDBXNotFoundError,
    ZenDBXValidationError
)

try:
    response = await client.auth.sign_in(
        email="user@example.com",
        password="wrong_password"
    )
except ZenDBXAuthenticationError as e:
    print(f"Authentication failed: {e}")
except ZenDBXValidationError as e:
    print(f"Validation error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")`;

const flaskExample = `from flask import Flask, session, request, jsonify
from zendbx import ZenDBX
import asyncio
import os

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")

def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json()
    
    async def do_signup():
        async with ZenDBX(
            project_url=os.getenv("ZENDBX_PROJECT_URL"),
            anon_key=os.getenv("ZENDBX_ANON_KEY")
        ) as client:
            response = await client.auth.sign_up(
                email=data["email"],
                password=data["password"]
            )
            
            if "access_token" in response:
                session["access_token"] = response["access_token"]
                return {"user": response["user"]}, 201
            return {"error": "Signup failed"}, 400
    
    return jsonify(*run_async(do_signup()))

@app.route("/api/todos", methods=["GET"])
def get_todos():
    if "access_token" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    async def do_get_todos():
        async with ZenDBX(
            project_url=os.getenv("ZENDBX_PROJECT_URL"),
            anon_key=os.getenv("ZENDBX_ANON_KEY")
        ) as client:
            # Restore session
            client.auth.set_session(session["access_token"])
            
            # Get todos
            response = await client.from_("todos") \\
                .select("*") \\
                .order_by("created_at", desc=True) \\
                .execute()
            
            return {"todos": response}, 200
    
    return jsonify(*run_async(do_get_todos()))

if __name__ == "__main__":
    app.run(debug=True)`;

const fastAPIExample = `from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from zendbx import ZenDBX
import os

app = FastAPI()

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""

async def get_client():
    """Dependency to create ZenDBX client"""
    async with ZenDBX(
        project_url=os.getenv("ZENDBX_PROJECT_URL"),
        anon_key=os.getenv("ZENDBX_ANON_KEY")
    ) as client:
        yield client

@app.post("/auth/signup")
async def signup(
    data: SignupRequest,
    client: ZenDBX = Depends(get_client)
):
    response = await client.auth.sign_up(
        email=data.email,
        password=data.password,
        name=data.name
    )
    
    if "access_token" in response:
        return {"user": response["user"]}
    raise HTTPException(status_code=400, detail="Signup failed")

@app.get("/todos")
async def get_todos(
    access_token: str,
    client: ZenDBX = Depends(get_client)
):
    # Restore session
    client.auth.set_session(access_token)
    
    try:
        response = await client.from_("todos") \\
            .select("*") \\
            .order_by("created_at", desc=True) \\
            .execute()
        return {"todos": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))`;

export default function PythonSDKPage() {
  return (
    <article>
      <Heading level={1}>Python SDK Reference</Heading>
      <p className="text-sm text-gray-400 mb-2">
        The official Python SDK for ZenDBX. Async-first architecture with full support for authentication, database operations, and storage.
      </p>
      <div className="flex items-center gap-2 mb-8">
        <Badge color="orange">zendbx</Badge>
        <Badge color="green">v1.0.3</Badge>
        <Badge color="blue">Python 3.8+</Badge>
        <a href="https://pypi.org/project/zendbx/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
          View on PyPI →
        </a>
      </div>

      <Heading level={2} id="installation">Installation</Heading>
      <CodeBlock code={install} lang="bash" />
      <p className="text-sm text-gray-400 mb-3 mt-2">Or install a specific version:</p>
      <CodeBlock code={installVersion} lang="bash" />

      <Heading level={2} id="requirements">Requirements</Heading>
      <ul className="text-sm text-gray-400 mb-6 space-y-1">
        <li>• Python 3.8 or higher</li>
        <li>• aiohttp (async HTTP client)</li>
        <li>• pydantic (data validation)</li>
      </ul>

      <Heading level={2} id="initialize">Initialize Client</Heading>
      <p className="text-sm text-gray-400 mb-3">
        ZenDBX Python SDK is async-first. Always use <code className="text-orange-400">async/await</code> and close the client when done.
      </p>

      <Heading level={3} id="context-manager">Context Manager (Recommended)</Heading>
      <CodeBlock code={createClientContext} lang="python" />
      <Note>Using <code className="text-orange-400">async with</code> automatically closes the client and cleans up resources.</Note>

      <Heading level={3} id="manual-management">Manual Management</Heading>
      <CodeBlock code={createClientBasic} lang="python" />
      <Note variant="warning">Always call <code className="text-orange-400">await client.close()</code> to prevent memory leaks.</Note>

      <Heading level={3} id="environment-variables">With Environment Variables</Heading>
      <CodeBlock code={createClientEnv} lang="python" />
      <p className="text-sm text-gray-400 mt-2">Create a <code className="text-orange-400">.env</code> file:</p>
      <CodeBlock code={`ZENDBX_PROJECT_URL=https://api.zendbx.in/p/your-project
ZENDBX_ANON_KEY=your-anon-key`} lang="bash" />

      <ParamTable params={[
        { name: 'project_url', type: 'str', required: true, description: 'Your ZenDBX project URL (e.g., https://api.zendbx.in/p/your-project)' },
        { name: 'anon_key', type: 'str', required: true, description: 'Your project anon (public) key from dashboard' },
        { name: 'service_key', type: 'str', required: false, description: 'Service key for admin operations (server-side only)' },
        { name: 'timeout', type: 'int', required: false, description: 'Request timeout in seconds (default: 30)' },
      ]} />

      <Heading level={2} id="authentication">Authentication</Heading>

      <Heading level={3} id="auth-signup">Sign Up</Heading>
      <CodeBlock code={signUp} lang="python" />

      <Heading level={3} id="auth-signin">Sign In</Heading>
      <CodeBlock code={signIn} lang="python" />

      <Heading level={3} id="auth-getuser">Get Current User</Heading>
      <CodeBlock code={getUser} lang="python" />

      <Heading level={3} id="auth-session">Session Management (v1.0.3+)</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Save and restore authentication sessions across client instances.
      </p>
      <CodeBlock code={sessionManagement} lang="python" />

      <ParamTable params={[
        { name: 'set_session(access_token, refresh_token=None)', type: 'method', required: false, description: 'Restore authentication session in new client' },
        { name: 'clear_session()', type: 'method', required: false, description: 'Clear local session without backend call' },
      ]} />

      <Heading level={3} id="auth-signout">Sign Out</Heading>
      <CodeBlock code={signOut} lang="python" />

      <Heading level={2} id="database">Database Operations</Heading>

      <Heading level={3} id="select">SELECT</Heading>
      <CodeBlock code={selectBasic} lang="python" title="Basic select" />
      <CodeBlock code={selectWithFilters} lang="python" title="With filters and ordering" />

      <Heading level={3} id="filters">Query Filters</Heading>
      <CodeBlock code={filters} lang="python" />

      <Note>
        The Python SDK uses <code className="text-orange-400">desc=True</code> for descending order, and <code className="text-orange-400">in_()</code> (with underscore) to avoid Python keyword conflict.
      </Note>

      <Heading level={3} id="insert">INSERT</Heading>
      <CodeBlock code={insert} lang="python" />

      <Heading level={3} id="update">UPDATE</Heading>
      <CodeBlock code={update} lang="python" />

      <Note variant="warning">
        Always chain at least one filter before <code className="text-orange-400">.update()</code> to avoid modifying all rows.
      </Note>

      <Heading level={3} id="delete">DELETE</Heading>
      <CodeBlock code={delete_} lang="python" />

      <Note variant="warning">
        Always chain at least one filter before <code className="text-orange-400">.delete()</code> to avoid deleting all rows.
      </Note>

      <Heading level={2} id="storage">Storage</Heading>
      <p className="text-sm text-gray-400 mb-3">
        Upload, list, and delete files from your ZenDBX buckets.
      </p>

      <Heading level={3} id="storage-upload">Upload File</Heading>
      <CodeBlock code={storageUpload} lang="python" />

      <Heading level={3} id="storage-list">List Files</Heading>
      <CodeBlock code={storageList} lang="python" />

      <Heading level={3} id="storage-delete">Delete Files</Heading>
      <CodeBlock code={storageDelete} lang="python" />

      <Heading level={2} id="error-handling">Error Handling</Heading>
      <p className="text-sm text-gray-400 mb-3">
        The SDK provides typed exceptions for different error scenarios.
      </p>
      <CodeBlock code={errorHandling} lang="python" />

      <ParamTable params={[
        { name: 'ZenDBXError', type: 'Exception', required: false, description: 'Base exception class' },
        { name: 'ZenDBXAuthenticationError', type: 'Exception', required: false, description: 'Raised on 401 Unauthorized' },
        { name: 'ZenDBXPermissionError', type: 'Exception', required: false, description: 'Raised on 403 Forbidden' },
        { name: 'ZenDBXNotFoundError', type: 'Exception', required: false, description: 'Raised on 404 Not Found' },
        { name: 'ZenDBXValidationError', type: 'Exception', required: false, description: 'Raised on 400/422 validation errors' },
        { name: 'ZenDBXConflictError', type: 'Exception', required: false, description: 'Raised on 409 Conflict' },
        { name: 'ZenDBXRateLimitError', type: 'Exception', required: false, description: 'Raised on 429 Too Many Requests' },
        { name: 'ZenDBXTimeoutError', type: 'Exception', required: false, description: 'Raised on request timeout' },
      ]} />

      <Heading level={2} id="web-frameworks">Web Framework Integration</Heading>

      <Heading level={3} id="flask-integration">Flask Example</Heading>
      <CodeBlock code={flaskExample} lang="python" />
      <Note>
        Flask is synchronous, so we use <code className="text-orange-400">asyncio.run()</code> to run async ZenDBX operations.
      </Note>

      <Heading level={3} id="fastapi-integration">FastAPI Example</Heading>
      <CodeBlock code={fastAPIExample} lang="python" />
      <Note>
        FastAPI natively supports async, making it a perfect match for the ZenDBX Python SDK.
      </Note>

      <Heading level={2} id="best-practices">Best Practices</Heading>
      <ul className="text-sm text-gray-400 space-y-2 mb-6">
        <li>• Use <code className="text-orange-400">async with</code> context manager to ensure proper cleanup</li>
        <li>• Store credentials in environment variables, never hardcode them</li>
        <li>• Use <code className="text-orange-400">set_session()</code> for session persistence across requests</li>
        <li>• Handle specific exceptions (<code className="text-orange-400">ZenDBXAuthenticationError</code>, etc.)</li>
        <li>• Always await async functions</li>
        <li>• Don't share client instances across processes or threads</li>
        <li>• Don't forget to close clients in manual management</li>
        <li>• Don't commit <code className="text-orange-400">.env</code> files to version control</li>
      </ul>

      <Heading level={2} id="jupyter">Using in Jupyter Notebooks</Heading>
      <CodeBlock code={`# In Jupyter, the event loop is already running
# Use await directly instead of asyncio.run()

from zendbx import ZenDBX

async with ZenDBX(
    project_url="https://api.zendbx.in/p/your-project",
    anon_key="your-anon-key"
) as client:
    response = await client.auth.sign_in(
        email="user@example.com",
        password="password123"
    )
    print(response)
    
    # Query data
    todos = await client.from_("todos").select("*").execute()
    print(todos)`} lang="python" />

      <Heading level={2} id="links">Additional Resources</Heading>
      <ul className="text-sm text-gray-400 space-y-2">
        <li>
          <a href="https://pypi.org/project/zendbx/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            PyPI Package
          </a>
        </li>
        <li>
          <a href="https://github.com/zendbx/zendbx-python" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            GitHub Repository
          </a>
        </li>
        <li>
          <a href="/docs/quickstart" className="text-blue-400 hover:text-blue-300">
            Quick Start Guide
          </a>
        </li>
        <li>
          <a href="/docs/auth" className="text-blue-400 hover:text-blue-300">
            Authentication Guide
          </a>
        </li>
      </ul>
    </article>
  );
}
