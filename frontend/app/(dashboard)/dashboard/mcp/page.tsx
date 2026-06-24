"use client";

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/fetch-utils';
import { useToast } from '@/lib/toast';

interface MCPInfo {
  enabled: boolean;
  status: string;
  endpoint: string;
  transport: string;
  authentication: string;
  supported_clients: string[];
  project: {
    id: string;
    name: string;
    slug: string;
  };
  version: string;
  phase: string;
}

export default function MCPPage() {
  const { showToast } = useToast();
  const [mcpInfo, setMcpInfo] = useState<MCPInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Get project ID from URL or localStorage
    const currentProject = localStorage.getItem('current_project_id');
    if (currentProject) {
      setProjectId(currentProject);
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
      showToast('Failed to load MCP information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, 'success');
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-12 h-12 mx-auto">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(255,107,0,0.15)' }} />
            <div className="relative w-12 h-12 rounded-full border-2 border-[#FF6B00]/30 border-t-[#FF6B00] animate-spin" />
          </div>
          <p className="text-sm text-[#A1A1AA] font-medium">Loading MCP configuration...</p>
        </div>
      </div>
    );
  }

  if (!mcpInfo) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,107,0,0.15)' }}>
            <svg className="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-white">MCP not available</p>
            <p className="text-sm text-[#A1A1AA] mt-1">MCP information is not available for this project</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 space-y-5">
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between pt-1 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <svg className="w-5 h-5 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Model Context Protocol
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#FF6B00]"
                style={{ background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.2)' }}>
                <span className="live-dot" style={{ width: 4, height: 4, background: '#FF6B00' }} /> NEW
              </div>
            </div>
            <p className="text-xs text-[#A1A1AA]">Connect to AI development tools · {mcpInfo.version} · Phase {mcpInfo.phase}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
              style={{ 
                background: mcpInfo.status === 'running' ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', 
                border: `1px solid ${mcpInfo.status === 'running' ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`,
                color: mcpInfo.status === 'running' ? '#22c55e' : '#f59e0b'
              }}>
              <div className={`w-1.5 h-1.5 rounded-full ${mcpInfo.status === 'running' ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
              {mcpInfo.status === 'running' ? 'Active' : 'Connecting'}
            </div>
          </div>
        </div>

        {/* ── MCP STATUS CARD ── */}
        <div className="relative rounded-2xl overflow-hidden animate-slide-up" style={{ 
          animationDelay: '60ms',
          background: 'rgba(0,0,0,0.85)', 
          border: '1px solid rgba(255,107,0,0.15)', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 1px 0 rgba(255,107,0,0.1) inset' 
        }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/40 to-transparent" />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.25)' }}>
                  <svg className="w-4 h-4 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{mcpInfo.project.name}</p>
                  <p className="text-[11px] text-[#A1A1AA] mt-0.5">{mcpInfo.transport.toUpperCase()} · {mcpInfo.authentication}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">Ready</p>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5">{mcpInfo.supported_clients.length} clients supported</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Endpoint */}
              <div>
                <div className="flex justify-between text-[11px] text-[#A1A1AA] mb-1.5">
                  <span>MCP Endpoint</span>
                  <button 
                    onClick={() => copyToClipboard(mcpInfo.endpoint, 'MCP endpoint')}
                    className="text-[#FF6B00] hover:text-[#e85e00] transition-colors">
                    Copy
                  </button>
                </div>
                <div className="p-2.5 rounded-lg text-xs font-mono text-[#E5E5E5] break-all"
                  style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,107,0,0.1)' }}>
                  {mcpInfo.endpoint}
                </div>
              </div>

              {/* Project ID */}
              <div>
                <div className="flex justify-between text-[11px] text-[#A1A1AA] mb-1.5">
                  <span>Project ID</span>
                  <button 
                    onClick={() => copyToClipboard(mcpInfo.project.id, 'Project ID')}
                    className="text-[#FF6B00] hover:text-[#e85e00] transition-colors">
                    Copy
                  </button>
                </div>
                <div className="p-2.5 rounded-lg text-xs font-mono text-[#E5E5E5]"
                  style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,107,0,0.1)' }}>
                  {mcpInfo.project.id}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SUPPORTED CLIENTS ── */}
        <div className="relative rounded-2xl overflow-hidden animate-slide-up" style={{ 
          animationDelay: '120ms',
          background: 'rgba(0,0,0,0.85)', 
          border: '1px solid rgba(255,107,0,0.15)', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 1px 0 rgba(255,107,0,0.1) inset' 
        }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/40 to-transparent" />
          <div className="p-5 space-y-4">
            <p className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-widest">Supported Clients</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {mcpInfo.supported_clients.map((client, index) => (
                <div key={index} className="p-3 rounded-xl text-center"
                  style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,107,0,0.1)' }}>
                  <div className="w-6 h-6 mx-auto mb-2 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.25)' }}>
                    <svg className="w-3 h-3 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-white">{client}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── QUICK SETUP ── */}
        <div className="relative rounded-2xl overflow-hidden animate-slide-up" style={{ 
          animationDelay: '180ms',
          background: 'rgba(0,0,0,0.85)', 
          border: '1px solid rgba(255,107,0,0.15)', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 1px 0 rgba(255,107,0,0.1) inset' 
        }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/40 to-transparent" />
          <div className="p-5 space-y-4">
            <p className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-widest">Quick Setup</p>
            
            <div className="space-y-4">
              {/* Cursor */}
              <div className="p-4 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,107,0,0.1)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.25)' }}>
                    <svg className="w-3 h-3 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">Cursor IDE</p>
                </div>
                <div className="space-y-2 text-xs text-[#D4D4D8]">
                  <p>• Install MCP extension from marketplace</p>
                  <p>• Add server: <span className="text-[#FF6B00] font-mono">{mcpInfo.endpoint}</span></p>
                  <p>• Configure auth with your API key</p>
                </div>
              </div>

              {/* Claude Desktop */}
              <div className="p-4 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,107,0,0.1)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.25)' }}>
                    <svg className="w-3 h-3 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">Claude Desktop</p>
                </div>
                <div className="space-y-2 text-xs text-[#D4D4D8]">
                  <p>• Add to <span className="font-mono">claude_desktop_config.json</span></p>
                  <p>• Use HTTP transport with endpoint above</p>
                  <p>• Include Bearer token authentication</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECURITY NOTICE ── */}
        <div className="relative rounded-2xl overflow-hidden animate-slide-up" style={{ 
          animationDelay: '240ms',
          background: 'rgba(251,191,36,0.08)', 
          border: '1px solid rgba(251,191,36,0.2)' 
        }}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)' }}>
                <svg className="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-yellow-200 mb-1">Security Notice</p>
                <p className="text-xs text-yellow-100/90 leading-relaxed">
                  MCP provides direct access to your project data. Only connect to trusted AI clients and never share your endpoint publicly. 
                  Authentication is required for all MCP operations.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}