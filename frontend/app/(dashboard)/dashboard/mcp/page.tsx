"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/fetch-utils';
import { toast } from 'react-hot-toast';

interface MCPInfo {
  endpoint: string;
  status: string;
  tools_available: number;
  project_keys: {
    jwt: string | null;
    anon_key: string | null;
    service_role: string | null;
  };
}

export default function MCPPage() {
  const router = useRouter();
  const [mcpInfo, setMcpInfo] = useState<MCPInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Get project ID from URL or storage
    const currentProject = localStorage.getItem('currentProject');
    if (currentProject) {
      const project = JSON.parse(currentProject);
      setProjectId(project.id);
    }
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchMCPInfo();
    }
  }, [projectId]);

  const fetchMCPInfo = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const response = await apiFetch(`/api/projects/${projectId}/mcp`);
      
      if (response.ok) {
        const data = await response.json();
        setMcpInfo(data);
      } else {
        throw new Error('Failed to fetch MCP information');
      }
    } catch (error: any) {
      console.error('Error fetching MCP info:', error);
      toast.error('Failed to load MCP information');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!mcpInfo) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">MCP Configuration</h1>
          <p className="text-gray-600">MCP information is not available for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Model Context Protocol (MCP)
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                NEW
              </span>
            </h1>
            <p className="text-gray-600 mt-1">
              Connect your ZendBX project to AI development tools like Cursor, Claude Desktop, and VS Code extensions.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                mcpInfo.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'
              }`}></div>
              <span className="text-sm text-gray-600 capitalize">{mcpInfo.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MCP Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Configuration</h2>
        
        <div className="space-y-4">
          {/* MCP Endpoint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">MCP Server URL</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={mcpInfo.endpoint}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(mcpInfo.endpoint, 'MCP endpoint')}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>

          {/* JWT Token */}
          {mcpInfo.project_keys.jwt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">JWT Token</label>
              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  value={mcpInfo.project_keys.jwt}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(mcpInfo.project_keys.jwt!, 'JWT token')}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Project ID */}
          {projectId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project ID</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={projectId}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(projectId, 'Project ID')}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Available Tools */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available MCP Tools</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-gray-700">{mcpInfo.tools_available} tools available</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'Database Query', description: 'Execute SQL queries on your project database' },
            { name: 'Table Management', description: 'Create, modify, and inspect database tables' },
            { name: 'Auth Management', description: 'Manage user authentication and authorization' },
            { name: 'Storage Operations', description: 'Upload, download, and manage file storage' },
            { name: 'API Generation', description: 'Generate REST API endpoints automatically' },
            { name: 'Schema Introspection', description: 'Explore and understand your database schema' },
          ].map((tool, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
              <h3 className="font-medium text-sm text-gray-900">{tool.name}</h3>
              <p className="text-xs text-gray-600 mt-1">{tool.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Setup Instructions</h2>
        
        <div className="space-y-6">
          {/* Cursor IDE */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">🎯 Cursor IDE</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Install the MCP extension from the Cursor marketplace</li>
                <li>Open Cursor settings and navigate to MCP configuration</li>
                <li>Add a new server with the endpoint URL above</li>
                <li>Set the authorization header: <code className="bg-gray-200 px-1 rounded">Bearer [JWT_TOKEN]</code></li>
                <li>Include project parameter: <code className="bg-gray-200 px-1 rounded">{`{"project": "${projectId}"}`}</code></li>
              </ol>
            </div>
          </div>

          {/* Claude Desktop */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">🤖 Claude Desktop</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-sm text-gray-700 mb-2">Add this configuration to your Claude Desktop MCP settings:</p>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto">
{`{
  "mcpServers": {
    "zendbx-${projectId}": {
      "command": "node",
      "args": ["-e", "/* MCP client script */"],
      "env": {
        "MCP_SERVER_URL": "${mcpInfo.endpoint}",
        "AUTHORIZATION": "Bearer ${mcpInfo.project_keys.jwt?.substring(0, 20)}...",
        "PROJECT_ID": "${projectId}"
      }
    }
  }
}`}
              </pre>
            </div>
          </div>

          {/* VS Code */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">📝 VS Code Extensions</h3>
            <div className="bg-gray-50 rounded-md p-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Install a compatible MCP extension (e.g., "Continue", "Codeium")</li>
                <li>Configure the MCP server in your extension settings</li>
                <li>Use the endpoint URL and JWT token from above</li>
                <li>Ensure project context is included in requests</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Security Notice</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Keep your JWT token secure and never share it publicly. This token provides full access to your project data.
                If compromised, regenerate it immediately from the API Keys page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}